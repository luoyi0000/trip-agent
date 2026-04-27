"""认证模块 - 密码哈希、JWT签发验证、获取当前用户"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings

settings = get_settings()
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """对密码进行 bcrypt 哈希"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """验证密码与哈希是否匹配"""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    """签发 JWT token"""
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiration_hours)
    payload.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_access_token(token: str) -> dict:
    """验证 JWT token，返回 payload"""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 已过期，请重新登录",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 Token",
        )


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_user_id: Optional[str] = Header(None, alias="x-user-id"),
) -> str:
    """
    获取当前用户 ID，支持两种模式：
    1. 已登录用户：从 Authorization: Bearer <token> 解码 user_id
    2. 匿名用户：从 x-user-id header 读取
    """
    if credentials:
        payload = verify_access_token(credentials.credentials)
        return payload.get("user_id", "")
    if x_user_id:
        return x_user_id
    return ""


def require_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_user_id: Optional[str] = Header(None, alias="x-user-id"),
) -> str:
    """
    强制要求用户标识（用于需要登录或匿名标识的路由）
    与 get_current_user_id 区别：如果两者都没有则生成一个匿名 ID
    """
    if credentials:
        payload = verify_access_token(credentials.credentials)
        return payload.get("user_id", "")
    if x_user_id:
        return x_user_id
    return f"anon_{uuid.uuid4().hex[:12]}"
