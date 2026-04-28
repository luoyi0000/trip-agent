"""
智能旅行助手 — 记忆模块

提供三层记忆能力：
1. ChatMemoryManager     — 基于摘要的对话记忆（不依赖 langchain.memory）
2. UserPreferenceManager — 跨会话的用户偏好提取与持久化
3. TripContextManager     — 用户历史行程参考
"""

import json
from typing import Dict, List, Any, Optional, Tuple

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage

from ..services.llm_service import get_llm
from ..db import (
    set_user_preference as db_set_pref,
    get_user_preferences as db_get_prefs,
    delete_user_preference as db_del_pref,
    get_history_detail,
)

# ========================================================================
# 2a. ChatMemoryManager — 单次会话内的对话记忆
# ========================================================================

SUMMARIZE_PROMPT = """请将以下对话内容总结为一段简洁的摘要，保留重要的事实、用户偏好和关键信息。

对话内容：
{conversation}

摘要："""


class _SessionMemory:
    """单个会话的记忆存储

    维护消息列表，超出 token 限制时自动摘要旧消息。
    Token 数按字符数的 1/4 估算（中文场景的近似值）。
    """

    def __init__(self, llm, max_token_limit: int = 2000):
        self.llm = llm
        self.max_token_limit = max_token_limit
        self.messages: List[BaseMessage] = []  # 所有消息
        self.summary: str = ""  # 已摘要的旧消息

    def add_user_message(self, text: str):
        self.messages.append(HumanMessage(content=text))

    def add_ai_message(self, text: str):
        self.messages.append(AIMessage(content=text))

    def _estimate_tokens(self, text: str) -> int:
        """估算 token 数（中文字符约占 1.5 token，英文约 0.25 token）"""
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other_chars = len(text) - chinese_chars
        return int(chinese_chars * 1.5 + other_chars * 0.25)

    def _total_estimated_tokens(self) -> int:
        """估算所有消息 + 摘要的总 token 数"""
        total = self._estimate_tokens(self.summary) if self.summary else 0
        for msg in self.messages:
            total += self._estimate_tokens(msg.content)
        return total

    def prune_if_needed(self):
        """如果超出 token 限制，摘要最旧的一半消息"""
        if self._total_estimated_tokens() <= self.max_token_limit:
            return

        # 取最旧的一半消息进行摘要
        split = max(1, len(self.messages) // 2)
        old_messages = self.messages[:split]
        self.messages = self.messages[split:]

        # 构建摘要文本
        conversation_text = "\n".join(
            f"{'用户' if isinstance(m, HumanMessage) else 'AI'}: {m.content}"
            for m in old_messages
        )

        if self.summary:
            conversation_text = f"历史摘要：{self.summary}\n\n后续对话：\n{conversation_text}"

        try:
            response = self.llm.invoke(SUMMARIZE_PROMPT.format(conversation=conversation_text))
            self.summary = response.content if hasattr(response, "content") else str(response)
        except Exception as e:
            print(f"[WARN] 消息摘要失败: {e}")
            # 摘要失败时回退：保留最近的消息直到不超限
            self.messages = self.messages[:max(1, len(self.messages) - 1)]

    def get_context_messages(self) -> List[BaseMessage]:
        """获取用于 LLM 调用的完整上下文消息列表"""
        result = []
        if self.summary:
            result.append(SystemMessage(content=f"对话历史摘要：{self.summary}"))
        result.extend(self.messages)
        return result

    def save_context(self, user_msg: str, ai_msg: str):
        """保存一轮对话并触发自动摘要"""
        self.add_user_message(user_msg)
        self.add_ai_message(ai_msg)
        self.prune_if_needed()


# 偏好提取提示词
PREFERENCE_EXTRACTION_PROMPT = """你是一个旅行偏好分析器。从以下对话中提取用户的旅行偏好。

以 JSON 格式返回（不要包含任何其他文本和代码块标记）：
{{
  "dietary": "饮食偏好（如：川菜/海鲜/素食/无辣等），如果不明确填'不适用'",
  "budget_level": "预算等级：经济/舒适/豪华，如果不明确填'不适用'",
  "transport_preference": "交通偏好（如：公共交通/自驾/包车），如果不明确填'不适用'",
  "travel_style": "旅行风格（如：深度游/休闲度假/打卡/探险/亲子），如果不明确填'不适用'",
  "accommodation_preference": "住宿偏好（如：经济型酒店/民宿/星级酒店），如果不明确填'不适用'"
}}

对话：
{conversation}
"""


class ChatMemoryManager:
    """基于摘要的对话记忆管理器

    按 session_id 维护对话历史，超出 token 限制时自动摘要旧消息。
    不依赖 langchain.memory 模块，使用自定义实现。
    """

    _instances: Dict[int, _SessionMemory] = {}

    def get_or_create(
        self,
        session_id: int,
        llm,
        existing_messages: Optional[List[Dict[str, str]]] = None,
    ) -> _SessionMemory:
        """获取或创建指定会话的记忆实例"""
        if session_id not in self._instances:
            memory = _SessionMemory(llm=llm, max_token_limit=2000)
            if existing_messages:
                for msg in existing_messages:
                    role = msg.get("role", "")
                    text = msg.get("text", "")
                    if role == "user":
                        memory.add_user_message(text)
                    elif role == "assistant" or role == "ai":
                        memory.add_ai_message(text)
            self._instances[session_id] = memory
        return self._instances[session_id]

    def load_context(self, session_id: int, llm) -> List[BaseMessage]:
        """加载会话的对话历史（含自动摘要），返回消息列表"""
        memory = self.get_or_create(session_id, llm)
        return memory.get_context_messages()

    def save_context(self, session_id: int, user_msg: str, ai_msg: str, llm) -> None:
        """保存一轮对话到记忆"""
        memory = self.get_or_create(session_id, llm)
        memory.save_context(user_msg, ai_msg)

    def clear(self, session_id: int) -> None:
        """清除指定会话的记忆"""
        self._instances.pop(session_id, None)


# ========================================================================
# 2b. UserPreferenceManager — 用户偏好提取与持久化
# ========================================================================

class UserPreferenceManager:
    """从用户对话中提取并持久化旅行偏好"""

    def __init__(self, llm=None):
        self._llm = llm

    def _get_llm(self):
        if self._llm is None:
            self._llm = get_llm()
        return self._llm

    def extract_from_messages(self, messages: List[Dict[str, str]]) -> Dict[str, str]:
        """从消息列表中提取用户偏好

        Args:
            messages: 聊天消息列表，每项为 {"role": "user"|"ai", "text": "..."}

        Returns:
            偏好字典，如 {"dietary": "川菜", "budget_level": "舒适"}
        """
        if not messages:
            return {}

        # 只对最近的消息进行提取（最近的10轮）
        recent = messages[-20:] if len(messages) > 20 else messages
        conversation_text = self._format_conversation(recent)

        llm = self._get_llm()
        prompt = PREFERENCE_EXTRACTION_PROMPT.format(conversation=conversation_text)

        try:
            response = llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)
            # 清理可能的 markdown 代码块
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[-1]
                content = content.rsplit("\n", 1)[0]
                if content.endswith("```"):
                    content = content[:-3]
            preferences = json.loads(content.strip())
            # 过滤掉"不适用"的值
            return {k: v for k, v in preferences.items() if v and v != "不适用"}
        except Exception as e:
            print(f"[WARN] 偏好提取失败: {e}")
            return {}

    def save_preferences(self, user_id: str, preferences: Dict[str, str]) -> None:
        """批量保存用户偏好

        Args:
            user_id: 用户 ID
            preferences: 偏好字典
        """
        for key, value in preferences.items():
            category = self._key_to_category(key)
            db_set_pref(user_id, key, value, category)

    def load_preferences(self, user_id: str) -> Dict[str, str]:
        """从数据库加载用户偏好

        Returns:
            偏好字典
        """
        rows = db_get_prefs(user_id)
        return {row["key"]: row["value"] for row in rows}

    def build_preference_prompt(self, user_id: str) -> str:
        """生成可注入 Prompt 的偏好文本

        如用户有偏好则返回描述文本，否则返回空字符串
        """
        preferences = self.load_preferences(user_id)
        if not preferences:
            return ""

        parts = []
        mapping = {
            "dietary": "饮食偏好",
            "budget_level": "预算等级",
            "transport_preference": "交通偏好",
            "travel_style": "旅行风格",
            "accommodation_preference": "住宿偏好",
        }
        for key, value in preferences.items():
            label = mapping.get(key, key)
            parts.append(f"- {label}: {value}")

        return "用户已知旅行偏好：\n" + "\n".join(parts)

    @staticmethod
    def _key_to_category(key: str) -> str:
        """将偏好 key 映射到分类"""
        category_map = {
            "dietary": "饮食",
            "budget_level": "预算",
            "transport_preference": "交通",
            "travel_style": "风格",
            "accommodation_preference": "住宿",
        }
        return category_map.get(key, "general")

    @staticmethod
    def _format_conversation(messages: List[Dict[str, str]]) -> str:
        """格式化消息列表为纯文本"""
        lines = []
        for msg in messages:
            role = "用户" if msg.get("role") == "user" else "AI"
            text = msg.get("text", "")
            lines.append(f"{role}: {text}")
        return "\n".join(lines)


# ========================================================================
# 2c. TripContextManager — 历史行程参考
# ========================================================================

class TripContextManager:
    """从 trip_history 表读取用户的历史行程，为下一次规划提供上下文"""

    @staticmethod
    def get_recent_trips(user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
        """查询用户最近的历史行程

        Args:
            user_id: 用户 ID
            limit: 返回条数

        Returns:
            行程摘要列表
        """
        from ..db import get_history_list, get_history_detail

        trips = get_history_list(user_id, limit=limit)
        result = []
        for trip in trips:
            detail = get_history_detail(trip["task_id"])
            if detail and detail.get("plan_data"):
                plan = detail["plan_data"]
                result.append({
                    "city": trip["city"],
                    "travel_days": trip["travel_days"],
                    "status": trip["status"],
                    "suggestions": plan.get("overall_suggestions", "")[:100] if isinstance(plan, dict) else "",
                })
            else:
                result.append({
                    "city": trip["city"],
                    "travel_days": trip["travel_days"],
                    "status": trip["status"],
                    "suggestions": "",
                })
        return result

    @staticmethod
    def build_context_prompt(user_id: str) -> str:
        """生成可注入 Prompt 的历史行程参考文本

        如用户有历史行程则返回描述，否则返回空字符串
        """
        trips = TripContextManager.get_recent_trips(user_id)
        if not trips:
            return ""

        lines = ["用户历史行程参考："]
        for i, trip in enumerate(trips, 1):
            lines.append(f"  {i}. {trip['city']}（{trip['travel_days']}天，状态：{trip['status']}）")
        return "\n".join(lines)
