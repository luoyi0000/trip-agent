"""国内图片搜索服务 - 搜狗/Bing, 无需 API Key"""

import re
import json
import requests
from typing import List, Optional
from urllib.parse import quote


class DomesticImageService:
    """
    国内图片聚合搜索服务

    搜索优先级:
    1. 搜狗图片搜索 (免费, 无需 Key, 国内访问快)
    2. Bing 图片搜索 (免费, 无需 Key)
    3. Wikipedia (被墙, 偶尔可用)
    4. Unsplash (需要 Key, 英文搜索)
    """

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        })

    # ============ 搜狗图片搜索 ============

    def _search_sogou(self, keyword: str, num: int = 5) -> List[dict]:
        """搜狗图片搜索"""
        try:
            url = "https://pic.sogou.com/pics"
            params = {
                "query": keyword,
                "mood": "0",
                "picformat": "0",
                "mode": "1",
                "di": "0",
                "start": "0",
                "reqType": "ajax",
                "tn": "0",
                "ds": "1",
            }
            resp = self.session.get(url, params=params, timeout=8)
            resp.raise_for_status()

            data = resp.json()
            items = data.get("items", [])[:num]

            photos = []
            for item in items:
                # sogou 返回的图片 URL 可能有防盗链,优先用 thumbUrl 或 ori_pic_url
                img_url = item.get("thumbUrl") or item.get("pic_url") or item.get("ori_pic_url")
                if img_url:
                    photos.append({
                        "url": img_url,
                        "title": item.get("title", ""),
                        "source": "sogou",
                    })
            return photos

        except Exception:
            return []

    # ============ Bing 图片搜索 ============

    def _search_bing(self, keyword: str, num: int = 5) -> List[dict]:
        """Bing 图片搜索 (网页版 AJAX)"""
        try:
            url = "https://cn.bing.com/images/async"
            params = {
                "q": keyword,
                "first": "0",
                "count": str(num),
                "mmasync": "1",
                "dgState": "x*0_y*0_h*0_c*4_i*106_r*22",
            }
            resp = self.session.get(url, params=params, timeout=8)
            resp.raise_for_status()

            html = resp.text
            # 从 HTML 中提取图片 URL (murl=xxx)
            # 格式: murl="https://..."
            urls = re.findall(r'murl=\"([^\"]+)\"', html)

            photos = []
            for u in urls[:num]:
                # 解码 URL
                decoded = u.replace("\\/", "/")
                if decoded.startswith("http"):
                    photos.append({
                        "url": decoded,
                        "title": "",
                        "source": "bing",
                    })
            return photos

        except Exception:
            return []

    # ============ 对外接口 ============

    def search(self, keyword: str, num: int = 5) -> List[dict]:
        """
        聚合搜索图片

        Args:
            keyword: 搜索关键词(中文或英文)
            num: 返回数量

        Returns:
            图片列表, 每个元素包含 url/title/source
        """
        # 优先搜狗(国内最快)
        results = self._search_sogou(keyword, num)
        if results:
            return results

        # fallback 到 Bing
        results = self._search_bing(keyword, num)
        if results:
            return results

        return []

    def get_photo_url(self, keyword: str) -> Optional[str]:
        """
        获取单张图片 URL

        Args:
            keyword: 搜索关键词

        Returns:
            图片URL
        """
        photos = self.search(keyword, num=1)
        if photos:
            return photos[0]["url"]
        return None


# 全局实例
_domestic_service = None


def get_domestic_image_service() -> DomesticImageService:
    """获取国内图片服务实例"""
    global _domestic_service
    if _domestic_service is None:
        _domestic_service = DomesticImageService()
    return _domestic_service
