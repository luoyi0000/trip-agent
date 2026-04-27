"""Unsplash图片服务"""

import requests
from typing import List, Optional
from ..config import get_settings

class UnsplashService:
    """Unsplash图片服务类"""
    
    def __init__(self):
        """初始化服务"""
        settings = get_settings()
        self.access_key = settings.unsplash_access_key
        self.base_url = "https://api.unsplash.com"
    
    def search_photos(self, query: str, per_page: int = 5) -> List[dict]:
        """
        搜索图片
        
        Args:
            query: 搜索关键词
            per_page: 每页数量
            
        Returns:
            图片列表
        """
        try:
            url = f"{self.base_url}/search/photos"
            params = {
                "query": query,
                "per_page": per_page,
                "client_id": self.access_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            results = data.get("results", [])
            
            # 提取图片URL
            photos = []
            for photo in results:
                photos.append({
                    "id": photo.get("id"),
                    "url": photo.get("urls", {}).get("regular"),
                    "thumb": photo.get("urls", {}).get("thumb"),
                    "description": photo.get("description") or photo.get("alt_description"),
                    "photographer": photo.get("user", {}).get("name")
                })
            
            return photos
            
        except Exception as e:
            print(f"❌ Unsplash搜索失败: {str(e)}")
            return []
    
    def get_photo_url(self, query: str, fallback_queries: List[str] = None) -> Optional[str]:
        """
        获取单张图片URL,支持多关键词尝试和过滤

        Args:
            query: 主搜索关键词(推荐英文,如 "Forbidden City Beijing landmark")
            fallback_queries: 备选搜索关键词列表

        Returns:
            图片URL
        """
        all_queries = [query]
        if fallback_queries:
            all_queries.extend(fallback_queries)

        for q in all_queries:
            photos = self.search_photos(q, per_page=5)
            if not photos:
                continue

            # 过滤: 优先选择描述中包含 landmark/tourism/travel/scenery 的图片
            preferred_keywords = ["landmark", "tourism", "travel", "scenery", "architecture", "historical"]
            for photo in photos:
                desc = (photo.get("description") or "") + " " + (photo.get("alt_description") or "")
                desc_lower = desc.lower()
                # 如果描述包含优先关键词,直接返回
                if any(kw in desc_lower for kw in preferred_keywords):
                    return photo.get("url")

            # 没有匹配到优先关键词,返回第一个
            return photos[0].get("url")

        return None


# 全局服务实例
_unsplash_service = None


def get_unsplash_service() -> UnsplashService:
    """获取Unsplash服务实例(单例模式)"""
    global _unsplash_service
    
    if _unsplash_service is None:
        _unsplash_service = UnsplashService()
    
    return _unsplash_service

