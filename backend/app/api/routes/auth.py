"""认证 API 路由 - 注册、登录、获取当前用户"""

from typing import Optional

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

from ...auth import (
    create_access_token,
    get_current_user_id,
    hash_password,
    verify_password,
)
from ...db import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    migrate_anonymous_data,
)

router = APIRouter(prefix="/auth", tags=["认证"])


class RegisterRequest(BaseModel):
    email: str = Field(..., description="邮箱")
    password: str = Field(..., description="密码（至少6位）")
    username: str = Field(..., description="用户名")


class LoginRequest(BaseModel):
    email: str = Field(..., description="邮箱")
    password: str = Field(..., description="密码")


@router.post("/register")
async def register(
    body: RegisterRequest,
    anonymous_id: Optional[str] = Header(None, alias="x-anonymous-id"),
):
    """用户注册"""
    email, password, username = body.email, body.password, body.username

    if not email or not password or not username:
        return {
            "success": False,
            "message": "邮箱、密码、用户名不能为空",
        }

    if len(password) < 6:
        return {
            "success": False,
            "message": "密码长度不能少于6位",
        }

    # 检查邮箱是否已注册
    existing = get_user_by_email(email)
    if existing:
        return {
            "success": False,
            "message": "该邮箱已被注册",
        }

    # 创建用户
    password_hash = hash_password(password)
    try:
        user = create_user(email, username, password_hash)
    except ValueError as e:
        return {"success": False, "message": str(e)}

    user_id = user["id"]

    # 迁移匿名数据
    migrated = 0
    if anonymous_id:
        migrated = migrate_anonymous_data(anonymous_id, user_id)

    # 签发 token
    token = create_access_token({"user_id": user_id, "email": email})

    return {
        "success": True,
        "message": "注册成功",
        "data": {
            "token": token,
            "user": user,
            "migrated_count": migrated,
        },
    }


@router.post("/login")
async def login(body: LoginRequest):
    """用户登录"""
    email, password = body.email, body.password

    if not email or not password:
        return {
            "success": False,
            "message": "邮箱和密码不能为空",
        }

    user = get_user_by_email(email)
    if not user:
        return {
            "success": False,
            "message": "邮箱或密码错误",
        }

    if not verify_password(password, user["password_hash"]):
        return {
            "success": False,
            "message": "邮箱或密码错误",
        }

    user_id = str(user["id"])
    token = create_access_token({"user_id": user_id, "email": email})

    return {
        "success": True,
        "message": "登录成功",
        "data": {
            "token": token,
            "user": {"id": user_id, "email": user["email"], "username": user["username"]},
        },
    }


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id)):
    """获取当前登录用户信息（需 Bearer token）"""
    if not user_id:
        return {"success": False, "message": "未登录"}

    user = get_user_by_id(user_id)
    if not user:
        return {"success": False, "message": "用户不存在"}

    return {
        "success": True,
        "data": {
            "id": str(user["id"]),
            "email": user["email"],
            "username": user["username"],
        },
    }
