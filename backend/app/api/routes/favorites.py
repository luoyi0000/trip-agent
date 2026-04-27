"""收藏功能 API 路由"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from ...auth import get_current_user_id
from ...db import add_favorite, get_favorites, delete_favorite

router = APIRouter(prefix="/favorites", tags=["收藏"])


class AddFavoriteRequest(BaseModel):
    """添加收藏请求"""
    type: str = Field(..., description="类型：spot/food/hotel/tip")
    title: str = Field(..., description="标题")
    subtitle: str = Field(default="", description="子标题")
    tag: str = Field(default="", description="标签")
    source_id: str = Field(default="", description="关联ID")
    raw_data: str = Field(default="", description="原始数据快照（JSON）")


@router.post("/")
async def add_fav(
    request: AddFavoriteRequest,
    user_id: str = Depends(get_current_user_id),
):
    """添加收藏"""
    if not user_id:
        return {"success": False, "message": "未登录"}
    try:
        fav_id = add_favorite(
            user_id=user_id,
            type=request.type,
            title=request.title,
            subtitle=request.subtitle,
            tag=request.tag,
            source_id=request.source_id,
            raw_data=request.raw_data,
        )
        return {"success": True, "message": "收藏成功", "data": {"id": fav_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def list_favs(
    user_id: str = Depends(get_current_user_id),
):
    """查询收藏列表"""
    if not user_id:
        return {"success": True, "message": "查询成功", "data": []}
    try:
        items = get_favorites(user_id=user_id)
        return {"success": True, "message": "查询成功", "data": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{fav_id}")
async def delete_fav(
    fav_id: int,
    user_id: str = Depends(get_current_user_id),
):
    """删除收藏"""
    if not user_id:
        return {"success": False, "message": "未登录"}
    ok = delete_favorite(fav_id=fav_id, user_id=user_id)
    if not ok:
        return {"success": False, "message": "收藏不存在或无权删除"}
    return {"success": True, "message": "删除成功"}
