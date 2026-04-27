"""AI 对话 API 路由 — 支持会话管理和消息持久化"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from ...services.llm_service import get_llm
from ...auth import get_current_user_id
from ...db import (
    create_chat_session,
    get_chat_sessions,
    get_chat_messages,
    add_chat_message,
    update_chat_session_title,
    delete_chat_session,
)

router = APIRouter(prefix="/chat", tags=["AI对话"])


class ChatRequest(BaseModel):
    """对话请求"""
    message: str = Field(..., description="用户消息", example="北京有什么好玩的景点？")
    history: list[dict] = Field(default=[], description="历史对话记录")
    context: str = Field(default="", description="上下文主题")
    session_id: Optional[int] = Field(default=None, description="会话ID，无则创建新会话")


class ChatResponse(BaseModel):
    """对话响应"""
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


@router.post(
    "/",
    response_model=ChatResponse,
    summary="AI 对话",
    description="与智能旅行助手进行对话，自动保存消息历史"
)
async def chat(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    AI 对话接口

    Args:
        request: 对话请求（含可选的 session_id）

    Returns:
        AI 回复 + session_id
    """
    try:
        llm = get_llm()

        # 无 session_id 则创建新会话
        session_id = request.session_id
        if session_id is None and user_id:
            title = request.message[:30] if len(request.message) > 30 else request.message
            session_id = create_chat_session(user_id=user_id, title=title, topic=request.context)

        # 保存用户消息
        if session_id:
            add_chat_message(session_id=session_id, role="user", text=request.message)

        # 构建消息
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

        messages = [SystemMessage(content=SYSTEM_PROMPT)]

        # 添加上下文
        if request.context:
            messages.append(HumanMessage(
                content=f"当前上下文：用户正在关注「{request.context}」，请围绕这个主题回答。"
            ))
            messages.append(AIMessage(content="明白，我会围绕这个主题为您提供帮助。"))

        # 添加历史记录
        for msg in request.history[-6:]:  # 只保留最近6轮
            role = msg.get("role", "")
            content = msg.get("text", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "ai":
                messages.append(AIMessage(content=content))

        # 添加当前消息
        messages.append(HumanMessage(content=request.message))

        # 调用 LLM
        response = llm.invoke(messages)
        reply = response.content if hasattr(response, "content") else str(response)

        # 保存 AI 回复
        if session_id:
            add_chat_message(session_id=session_id, role="ai", text=reply)

        return ChatResponse(
            success=True,
            message="回复成功",
            reply=reply,
            session_id=session_id,
        )

    except Exception as e:
        print(f"❌ 对话失败: {str(e)}")
        import traceback
        traceback.print_exc()

        # 兜底回复
        fallback_reply = (
            f"收到你的问题！「{request.message}」\n\n"
            "💡 我是智能旅行助手，可以帮你：\n"
            "• 详细分析具体景点\n"
            "• 推荐周边美食\n"
            "• 优化行程安排\n"
            "• 提供实时天气提醒\n\n"
            "（当前AI服务暂时不可用，请稍后重试）"
        )

        # 即使 LLM 挂掉也保存兜底回复
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
