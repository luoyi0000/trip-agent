"""POI相关API路由"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from ...services.amap_service import get_amap_service
from ...services.unsplash_service import get_unsplash_service
from ...services.wikipedia_image_service import get_wikipedia_image_service
from ...services.domestic_image_service import get_domestic_image_service

router = APIRouter(prefix="/poi", tags=["POI"])


class POIDetailResponse(BaseModel):
    """POI详情响应"""
    success: bool
    message: str
    data: Optional[dict] = None


@router.get(
    "/detail/{poi_id}",
    response_model=POIDetailResponse,
    summary="获取POI详情",
    description="根据POI ID获取详细信息,包括图片"
)
async def get_poi_detail(poi_id: str):
    """
    获取POI详情
    
    Args:
        poi_id: POI ID
        
    Returns:
        POI详情响应
    """
    try:
        amap_service = get_amap_service()
        
        # 调用高德地图POI详情API
        result = amap_service.get_poi_detail(poi_id)
        
        return POIDetailResponse(
            success=True,
            message="获取POI详情成功",
            data=result
        )
        
    except Exception as e:
        print(f"❌ 获取POI详情失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"获取POI详情失败: {str(e)}"
        )


@router.get(
    "/search",
    summary="搜索POI",
    description="根据关键词搜索POI"
)
async def search_poi(keywords: str, city: str = "北京"):
    """
    搜索POI

    Args:
        keywords: 搜索关键词
        city: 城市名称

    Returns:
        搜索结果
    """
    try:
        amap_service = get_amap_service()
        result = amap_service.search_poi(keywords, city)

        return {
            "success": True,
            "message": "搜索成功",
            "data": result
        }

    except Exception as e:
        print(f"❌ 搜索POI失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"搜索POI失败: {str(e)}"
        )


@router.get(
    "/photo",
    summary="获取景点图片",
    description="根据景点名称获取图片，使用Unsplash搜索"
)
async def get_attraction_photo(name: str, keyword: str = None, city: str = None):
    """
    获取景点图片

    策略:
    1. Unsplash (稳定可靠)

    Args:
        name: 景点名称(中文)
        keyword: 英文关键词(用于Unsplash)
        city: 城市名称

    Returns:
        图片URL
    """
    photo_url = None
    source = None

    try:
        # ========== Unsplash 图片搜索 ==========
        unsplash_service = get_unsplash_service()

        # 优化搜索关键词策略
        # 优先使用后端提供的英文关键词（更准确）
        # 如果没有英文关键词，简化中文名称搜索
        
        search_queries = []
        
        if keyword:
            # 使用LLM生成的英文关键词（最准确）
            search_queries.append(keyword)
            # 添加备选关键词
            search_queries.append(f"{keyword} China")
            search_queries.append(f"{keyword} landmark")
        
        if city:
            # 用城市名搜索
            search_queries.append(f"{city} landmark")
            search_queries.append(f"{city} tourism")
        
        # 如果以上都没结果，尝试简化景点名
        # 去掉"中国"、"市"等冗余词
        simplified_name = name.replace("中国", "").replace("市", "").strip()
        if simplified_name != name:
            search_queries.append(simplified_name)
        
        # 去重并尝试搜索
        seen_queries = set()
        for query in search_queries:
            query = query.strip()
            if query and query not in seen_queries:
                seen_queries.add(query)
                photo_url = unsplash_service.get_photo_url(query)
                if photo_url:
                    source = "unsplash"
                    print(f"✅ 使用关键词 '{query}' 找到图片")
                    break
        
        # 最后的兜底：用原景点名
        if not photo_url:
            photo_url = unsplash_service.get_photo_url(name)
            if photo_url:
                source = "unsplash"

        if photo_url:
            print(f"✅ 获取图片成功 [{source}]: {name}")
        else:
            print(f"⚠️  未找到图片: {name}")

        return {
            "success": True,
            "message": "获取图片成功",
            "data": {
                "name": name,
                "photo_url": photo_url,
                "source": source
            }
        }

    except Exception as e:
        print(f"❌ 获取景点图片失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"获取景点图片失败: {str(e)}"
        )

