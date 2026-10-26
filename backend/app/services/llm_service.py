"""LLM服务模块 - LangChain版本"""

import os
from langchain_openai import ChatOpenAI
from ..config import get_settings

# 全局LLM实例
_llm_instance = None
_chat_llm_instance = None


def get_llm() -> ChatOpenAI:
    """
    获取LLM实例(单例模式)，用于需深度推理的任务（如旅行规划）

    Returns:
        ChatOpenAI实例（大模型，max_tokens=4096）
    """
    global _llm_instance

    if _llm_instance is None:
        settings = get_settings()

        api_key = (
            os.getenv("OPENAI_API_KEY")
            or os.getenv("LLM_API_KEY")
            or settings.openai_api_key
        )
        base_url = (
            os.getenv("OPENAI_BASE_URL")
            or os.getenv("LLM_BASE_URL")
            or settings.openai_base_url
        )
        model = (
            os.getenv("OPENAI_MODEL")
            or os.getenv("LLM_MODEL_ID")
            or settings.openai_model
        )

        _llm_instance = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url,
            temperature=0.7,
            max_tokens=4096,
        )

        print(f"[OK] LLM服务初始化成功")
        print(f"   模型: {model}")
        print(f"   Base URL: {base_url}")

    return _llm_instance


def get_chat_llm() -> ChatOpenAI:
    """
    获取聊天专用的LLM实例（单例模式），使用更快的小模型 + 更低的max_tokens

    优先读取 CHAT_LLM_MODEL / CHAT_LLM_BASE_URL / CHAT_LLM_API_KEY 环境变量，
    未设置时回退到与 get_llm() 相同的配置，但使用更低的 max_tokens。

    Returns:
        ChatOpenAI实例（小模型，max_tokens=2048）
    """
    global _chat_llm_instance

    if _chat_llm_instance is None:
        settings = get_settings()

        # 优先读取聊天专用配置，未设置则回退到通用配置
        api_key = (
            os.getenv("CHAT_LLM_API_KEY")
            or os.getenv("OPENAI_API_KEY")
            or os.getenv("LLM_API_KEY")
            or settings.openai_api_key
        )
        base_url = (
            os.getenv("CHAT_LLM_BASE_URL")
            or os.getenv("OPENAI_BASE_URL")
            or os.getenv("LLM_BASE_URL")
            or settings.openai_base_url
        )
        model = (
            os.getenv("CHAT_LLM_MODEL")
            or os.getenv("OPENAI_MODEL")
            or os.getenv("LLM_MODEL_ID")
            or settings.openai_model
        )

        _chat_llm_instance = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=base_url,
            temperature=0.7,
            max_tokens=2048,  # 聊天场景不需要太长回复
        )

        print(f"[OK] 聊天LLM服务初始化成功")
        print(f"   模型: {model}（max_tokens=2048）")
        print(f"   Base URL: {base_url}")

    return _chat_llm_instance


def reset_llm():
    """重置LLM实例(用于测试或重新配置)"""
    global _llm_instance, _chat_llm_instance
    _llm_instance = None
    _chat_llm_instance = None
