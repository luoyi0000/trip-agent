"""用户偏好记忆管理 API 路由"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Dict
from ...auth import get_current_user_id
from ...db import (
    get_user_preferences as db_get_prefs,
    set_user_preference as db_set_pref,
    delete_user_preference as db_del_pref,
    clear_user_preferences as db_clear_prefs,
)

router = APIRouter(prefix="/user/preferences", tags=["用户偏好记忆"])


class PreferenceUpdateRequest(BaseModel):
    """更新偏好请求"""
    key: str = Field(..., description="偏好键名", example="dietary")
    value: str = Field(..., description="偏好值", example="川菜")
    category: str = Field(default="general", description="分类")


class PreferencesBatchRequest(BaseModel):
    """批量更新偏好请求"""
    preferences: Dict[str, str] = Field(..., description="偏好字典", example={"dietary": "川菜", "budget_level": "舒适"})


@router.get("/")
async def list_preferences(
    user_id: str = Depends(get_current_user_id),
):
    """获取当前用户的所有偏好"""
    if not user_id:
        return {"success": True, "data": []}
    try:
        prefs = db_get_prefs(user_id=user_id)
        return {"success": True, "data": prefs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/")
async def update_preference(
    request: PreferenceUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    """更新单条偏好"""
    if not user_id:
        return {"success": False, "message": "未登录"}
    try:
        db_set_pref(
            user_id=user_id,
            key=request.key,
            value=request.value,
            category=request.category,
        )
        return {"success": True, "message": "偏好已更新"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/batch")
async def batch_update_preferences(
    request: PreferencesBatchRequest,
    user_id: str = Depends(get_current_user_id),
):
    """批量更新偏好"""
    if not user_id:
        return {"success": False, "message": "未登录"}
    try:
        for key, value in request.preferences.items():
            # 自动推断分类
            category_map = {
                "dietary": "饮食",
                "budget_level": "预算",
                "transport_preference": "交通",
                "travel_style": "风格",
                "accommodation_preference": "住宿",
            }
            category = category_map.get(key, "general")
            db_set_pref(user_id=user_id, key=key, value=value, category=category)
        return {"success": True, "message": "偏好已批量更新"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{key}")
async def remove_preference(
    key: str,
    user_id: str = Depends(get_current_user_id),
):
    """删除单条偏好"""
    if not user_id:
        return {"success": False, "message": "未登录"}
    ok = db_del_pref(user_id=user_id, key=key)
    if not ok:
        return {"success": False, "message": "偏好不存在"}
    return {"success": True, "message": "偏好已删除"}


@router.delete("/")
async def clear_preferences(
    user_id: str = Depends(get_current_user_id),
):
    """清空所有偏好"""
    if not user_id:
        return {"success": False, "message": "未登录"}
    count = db_clear_prefs(user_id=user_id)
    return {"success": True, "message": f"已清空 {count} 条偏好"}
