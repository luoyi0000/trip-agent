"""AI 对话 API 路由 — 支持会话管理和消息持久化，集成记忆模块"""

import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, AsyncGenerator
from ...services.llm_service import get_chat_llm
from ...auth import get_current_user_id
from ...db import (
    create_chat_session,
    get_chat_sessions,
    get_chat_messages,
    add_chat_message,
    update_chat_session_title,
    delete_chat_session,
)
from ...agents.memory import ChatMemoryManager, UserPreferenceManager

router = APIRouter(prefix="/chat", tags=["AI对话"])

# 全局记忆管理器实例（单例）
_chat_memory = ChatMemoryManager()
_pref_mgr = UserPreferenceManager()


class ChatRequest(BaseModel):
    """对话请求"""
    message: str = Field(..., description="用户消息", example="北京有什么好玩的景点？")
    history: list[dict] = Field(default=[], description="历史对话记录")
    context: str = Field(default="", description="上下文主题")
    session_id: Optional[int] = Field(default=None, description="会话ID，无则创建新会话")


class ChatResponse(BaseModel):
    """对话响应（用于非流式接口）"""
    success: bool
    message: str
    reply: str
    session_id: Optional[int] = None


SYSTEM_PROMPT = """你是智能旅行助手，一个专业的旅行规划专家。

你的能力：
1. 推荐全球各地的旅游景点和路线
2. 提供美食、住宿、交通建议
3. 分享旅行避坑指南和实用技巧
4. 回答旅行相关的各种问题

回答风格：
- 友好、热情、专业
- 使用emoji让回答更生动
- 给出具体、实用的建议
- 如果不确定，坦诚告知用户
"""

# 记录每个 session 的对话轮数，用于触发偏好提取
_session_msg_count: dict[int, int] = {}


def _build_messages(request: ChatRequest, user_id: str, llm):
    """构建 LLM 消息列表（共用逻辑）"""
    from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

    messages = [SystemMessage(content=SYSTEM_PROMPT)]

    # 注入用户偏好上下文（跨会话记忆）
    if user_id:
        pref_context = _pref_mgr.build_preference_prompt(user_id)
        if pref_context:
            messages.append(SystemMessage(content=pref_context))

    # 添加上下文
    if request.context:
        messages.append(HumanMessage(
            content=f"当前上下文：用户正在关注「{request.context}」，请围绕这个主题回答。"
        ))
        messages.append(AIMessage(content="明白，我会围绕这个主题为您提供帮助。"))

    # 使用 ChatMemoryManager 加载会话记忆（含自动摘要）
    if request.session_id:
        history_messages = _chat_memory.load_context(request.session_id, llm)
        if history_messages:
            messages.extend(history_messages)
        else:
            for msg in request.history[-10:]:
                role = msg.get("role", "")
                content = msg.get("text", "")
                if role == "user":
                    messages.append(HumanMessage(content=content))
                elif role == "ai":
                    messages.append(AIMessage(content=content))
                if request.session_id and role in ("user", "ai"):
                    _chat_memory.get_or_create(request.session_id, llm, request.history)
    else:
        for msg in request.history[-6:]:
            role = msg.get("role", "")
            content = msg.get("text", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "ai":
                messages.append(AIMessage(content=content))

    # 添加当前消息
    messages.append(HumanMessage(content=request.message))
    return messages


async def _background_extract_preferences(session_id: int, user_id: str):
    """后台提取用户偏好（不阻塞响应）"""
    try:
        _session_msg_count[session_id] = _session_msg_count.get(session_id, 0) + 1
        if _session_msg_count[session_id] % 3 == 0:
            db_messages = get_chat_messages(session_id)
            preferences = _pref_mgr.extract_from_messages(db_messages)
            if preferences:
                _pref_mgr.save_preferences(user_id, preferences)
                print(f"[MEM] 已提取用户偏好: {preferences}")
    except Exception as e:
        print(f"[WARN] 偏好提取异常: {e}")


# ═══════════════════════════════════════════════════════════════
# 流式对话接口（推荐使用）
# ═══════════════════════════════════════════════════════════════

async def _stream_chat(
    request: ChatRequest,
    user_id: str,
) -> AsyncGenerator[str, None]:
    """流式生成 SSE 事件"""
    llm = get_chat_llm()
    session_id = request.session_id
    created_new_session = False

    try:
        # 无 session_id 则创建新会话
        if session_id is None and user_id:
            title = (
                request.message[:30]
                if len(request.message) > 30
                else request.message
            )
            session_id = create_chat_session(
                user_id=user_id, title=title, topic=request.context
            )
            created_new_session = True
            # 先发 session_id 让前端知道
            yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

        # 保存用户消息
        if session_id:
            add_chat_message(session_id=session_id, role="user", text=request.message)

        # 构建消息
        messages = _build_messages(request, user_id, llm)

        # 流式调用 LLM
        full_reply = ""
        async for chunk in llm.astream(messages):
            token = chunk.content if hasattr(chunk, "content") else str(chunk)
            if token:
                full_reply += token
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

        # 保存 AI 回复到数据库
        if session_id and full_reply:
            add_chat_message(session_id=session_id, role="ai", text=full_reply)
            # 保存到 ChatMemoryManager
            _chat_memory.save_context(session_id, request.message, full_reply, llm)

        # 后台提取偏好
        if session_id and user_id and full_reply:
            asyncio.create_task(
                _background_extract_preferences(session_id, user_id)
            )

        # 发送结束事件
        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"

    except Exception as e:
        print(f"[ERR] 流式对话失败: {str(e)}")
        import traceback

        traceback.print_exc()
        fallback = "当前AI服务暂时不可用，请稍后重试。"
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"


@router.post(
    "/stream",
    summary="AI 对话（流式）",
    description="与智能旅行助手进行流式对话，通过 SSE 逐 token 返回回复",
)
async def chat_stream(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    """流式对话接口（推荐使用）"""
    return StreamingResponse(
        _stream_chat(request, user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ═══════════════════════════════════════════════════════════════
# 非流式对话接口（向后兼容）
# ═══════════════════════════════════════════════════════════════

@router.post(
    "/",
    response_model=ChatResponse,
    summary="AI 对话（非流式）",
    description="与智能旅行助手进行对话，自动保存消息历史（非流式，向后兼容）",
)
async def chat(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    AI 对话接口（非流式，向后兼容）
    建议优先使用 /chat/stream 获得更好的交互体验
    """
    try:
        llm = get_chat_llm()

        # 无 session_id 则创建新会话
        session_id = request.session_id
        if session_id is None and user_id:
            title = request.message[:30] if len(request.message) > 30 else request.message
            session_id = create_chat_session(user_id=user_id, title=title, topic=request.context)

        # 保存用户消息
        if session_id:
            add_chat_message(session_id=session_id, role="user", text=request.message)

        # 构建消息
        messages = _build_messages(request, user_id, llm)

        # 调用 LLM
        response = llm.invoke(messages)
        reply = response.content if hasattr(response, "content") else str(response)

        # 保存 AI 回复
        if session_id:
            add_chat_message(session_id=session_id, role="ai", text=reply)
            _chat_memory.save_context(session_id, request.message, reply, llm)

        # 后台提取偏好
        if session_id and user_id:
            asyncio.create_task(
                _background_extract_preferences(session_id, user_id)
            )

        return ChatResponse(
            success=True,
            message="回复成功",
            reply=reply,
            session_id=session_id,
        )

    except Exception as e:
        print(f"[ERR] 对话失败: {str(e)}")
        import traceback

        traceback.print_exc()

        fallback_reply = (
            f"收到你的问题！「{request.message}」\n\n"
            "💡 我是智能旅行助手，可以帮你：\n"
            "• 详细分析具体景点\n"
            "• 推荐周边美食\n"
            "• 优化行程安排\n"
            "• 提供实时天气提醒\n\n"
            "（当前AI服务暂时不可用，请稍后重试）"
        )

        if session_id:
            add_chat_message(session_id=session_id, role="ai", text=fallback_reply)

        return ChatResponse(
            success=True,
            message="使用兜底回复",
            reply=fallback_reply,
            session_id=session_id,
        )


@router.get("/sessions")
async def list_sessions(
    user_id: str = Depends(get_current_user_id),
):
    """查询用户的历史会话列表"""
    if not user_id:
        return {"success": True, "data": []}
    try:
        sessions = get_chat_sessions(user_id=user_id)
        return {"success": True, "data": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}")
async def get_session_messages(session_id: int):
    """查询单个会话的消息列表"""
    try:
        messages = get_chat_messages(session_id=session_id)
        return {"success": True, "data": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def remove_session(
    session_id: int,
    user_id: str = Depends(get_current_user_id),
):
    """删除会话"""
    if not user_id:
        return {"success": False, "message": "未登录"}
    ok = delete_chat_session(session_id=session_id, user_id=user_id)
    if not ok:
        return {"success": False, "message": "会话不存在或无权删除"}
    return {"success": True, "message": "删除成功"}
