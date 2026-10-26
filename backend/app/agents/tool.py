import json
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx
from langchain_core.tools import BaseTool
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

from ..services.llm_service import get_llm
from ..services.amap_service import get_amap_service
from ..models.schemas import TripRequest, TripPlan, DayPlan, Attraction, Meal, WeatherInfo, Location, Hotel
from ..config import get_settings



# ============ LangChain 工具定义 ============

class AmapTextSearchTool(BaseTool):
    """高德地图文本搜索工具"""

    name: str = "amap_maps_text_search"
    description: str = (
        "高德地图文本搜索工具。用于搜索指定城市中的POI（兴趣点），如景点、酒店、餐厅等。\n"
        "输入参数:\n"
        "  - keywords: 搜索关键词，例如'故宫'、'酒店'、'公园'\n"
        "  - city: 城市名称，例如'北京'、'上海'"
    )

    def _run(self, keywords: str, city: str) -> str:
        settings = get_settings()
        url = "https://restapi.amap.com/v3/place/text"
        params = {
            "key": settings.amap_api_key,
            "keywords": keywords,
            "city": city,
            "citylimit": "true",
            "offset": 10,
            "page": 1,
            "extensions": "all",
        }
        try:
            response = httpx.get(url, params=params, timeout=30)
            data = response.json()
            if data.get("status") == "1":
                pois = data.get("pois", [])
                results = []
                for poi in pois[:8]:
                    loc_str = poi.get("location", ",")
                    lng, lat = loc_str.split(",") if "," in loc_str else ("0", "0")
                    results.append(
                        {
                            "poi_id": poi.get("id"),
                            "name": poi.get("name"),
                            "address": poi.get("address"),
                            "location": {"longitude": float(lng), "latitude": float(lat)},
                            "type": poi.get("type"),
                            "tel": poi.get("tel"),
                        }
                    )
                return json.dumps({"results": results, "count": len(results)}, ensure_ascii=False)
            return json.dumps({"error": data.get("info", "未知错误")}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)


class AmapWeatherTool(BaseTool):
    """高德地图天气查询工具"""

    name: str = "amap_maps_weather"
    description: str = (
        "高德地图天气查询工具。用于查询指定城市的天气预报信息。\n"
        "输入参数:\n"
        "  - city: 城市名称，例如'北京'、'上海'、'杭州'"
    )

    def _run(self, city: str) -> str:
        settings = get_settings()
        # 先获取城市adcode
        geo_url = "https://restapi.amap.com/v3/geocode/geo"
        geo_params = {"key": settings.amap_api_key, "address": city}
        try:
            geo_resp = httpx.get(geo_url, params=geo_params, timeout=30)
            geo_data = geo_resp.json()
            adcode = city  # 默认用城市名
            if geo_data.get("status") == "1":
                geocodes = geo_data.get("geocodes", [])
                if geocodes:
                    adcode = geocodes[0].get("adcode", city)
        except Exception:
            pass

        # 查询天气
        weather_url = "https://restapi.amap.com/v3/weather/weatherInfo"
        weather_params = {"key": settings.amap_api_key, "city": adcode, "extensions": "all"}
        try:
            response = httpx.get(weather_url, params=weather_params, timeout=30)
            data = response.json()
            if data.get("status") == "1":
                forecasts = data.get("forecasts", [])
                if forecasts:
                    casts = forecasts[0].get("casts", [])
                    results = []
                    for cast in casts[:7]:
                        results.append(
                            {
                                "date": cast.get("date"),
                                "day_weather": cast.get("dayweather"),
                                "night_weather": cast.get("nightweather"),
                                "day_temp": cast.get("daytemp"),
                                "night_temp": cast.get("nighttemp"),
                                "wind_direction": cast.get("daywind"),
                                "wind_power": cast.get("daypower"),
                            }
                        )
                    return json.dumps({"city": city, "forecasts": results}, ensure_ascii=False)
            return json.dumps({"error": data.get("info", "未知错误")}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)


