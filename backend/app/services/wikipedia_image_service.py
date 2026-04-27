"""Wikipedia 图片服务"""

import re
import requests
from typing import Optional

# 常见后缀, Wikipedia 词条名不需要这些
_NOISE_WORDS = ["landmark", "scenery", "tourism", "travel", "attraction", "sight", "spot"]


def _clean_keyword(keyword: str) -> str:
    """清理 keyword,去掉 Wikipedia 不需要的后缀"""
    cleaned = keyword.strip()
    lower = cleaned.lower()
    for word in _NOISE_WORDS:
        # 去掉单词本身(前后有空格或标点)
        cleaned = re.sub(rf'\s+{word}\b', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(rf'\b{word}\s+', '', cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


class WikipediaImageService:
    """通过 Wikipedia API 获取景点图片"""

    def __init__(self):
        self.zh_base = "https://zh.wikipedia.org/api/rest_v1/page/summary"
        self.en_base = "https://en.wikipedia.org/api/rest_v1/page/summary"

    def _search(self, title: str, lang: str = "zh") -> Optional[str]:
        """
        搜索 Wikipedia 获取图片

        Args:
            title: 词条标题(中文或英文)
            lang: 语言 zh/en

        Returns:
            图片URL
        """
        try:
            base = self.zh_base if lang == "zh" else self.en_base
            # 处理空格为下划线
            query = title.strip().replace(" ", "_")
            url = f"{base}/{query}"

            response = requests.get(url, timeout=8, headers={
                "User-Agent": "LangChain-TripPlanner/1.0"
            })

            if response.status_code == 404:
                return None

            response.raise_for_status()
            data = response.json()

            # 提取缩略图
            thumbnail = data.get("thumbnail", {})
            if thumbnail and "source" in thumbnail:
                img_url = thumbnail["source"]
                # 尝试替换为更大尺寸
                if "px-" in img_url:
                    img_url = re.sub(r'\d+px-', '640px-', img_url, count=1)
                return img_url

            return None

        except requests.exceptions.Timeout:
            # 超时是网络问题,静默返回 None,让上层 fallback
            return None
        except requests.exceptions.ConnectionError:
            # 连接失败(被墙),静默返回 None
            return None
        except Exception:
            # 其他错误也静默处理
            return None

    def get_photo_url(self, name: str, keyword: str = None) -> Optional[str]:
        """
        获取景点图片,多策略尝试

        Args:
            name: 中文景点名
            keyword: 英文关键词/词条名

        Returns:
            图片URL
        """
        # 先清理 keyword
        if keyword:
            keyword = _clean_keyword(keyword)

        # 策略1: 用英文 keyword 搜英文 Wikipedia(最准)
        if keyword:
            url = self._search(keyword, lang="en")
            if url:
                return url

        # 策略2: 用中文名搜中文 Wikipedia
        url = self._search(name, lang="zh")
        if url:
            return url

        # 策略3: keyword 太长时,只取前两个词尝试
        if keyword and " " in keyword:
            parts = keyword.split()
            if len(parts) > 2:
                short = " ".join(parts[:2])
                url = self._search(short, lang="en")
                if url:
                    return url

        return None


# 全局服务实例
_wiki_service = None


def get_wikipedia_image_service() -> WikipediaImageService:
    """获取 Wikipedia 图片服务实例(单例模式)"""
    global _wiki_service

    if _wiki_service is None:
        _wiki_service = WikipediaImageService()

    return _wiki_service
