"""高德地图服务封装 - 直接HTTP API版本"""

import re
from typing import List, Dict, Any, Optional

import httpx

from ..config import get_settings
from ..models.schemas import Location, POIInfo, WeatherInfo


class AmapService:
    """高德地图服务封装类"""

    def __init__(self):
        """初始化服务"""
        self.settings = get_settings()
        self.api_key = self.settings.amap_api_key
        self._available_tools = [
            {"name": "maps_text_search", "description": "POI文本搜索"},
            {"name": "maps_weather", "description": "天气查询"},
            {"name": "maps_direction_walking_by_address", "description": "步行路线规划（按地址）"},
            {"name": "maps_direction_driving_by_address", "description": "驾车路线规划（按地址）"},
            {"name": "maps_direction_transit_integrated_by_address", "description": "公交路线规划（按地址）"},
            {"name": "maps_geo", "description": "地理编码"},
            {"name": "maps_search_detail", "description": "POI详情"},
        ]

    def _request(self, url: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """发送HTTP请求"""
        params["key"] = self.api_key
        response = httpx.get(url, params=params, timeout=30)
        response.raise_for_status()
        return response.json()

    def search_poi(self, keywords: str, city: str, citylimit: bool = True) -> List[POIInfo]:
        """
        搜索POI

        Args:
            keywords: 搜索关键词
            city: 城市
            citylimit: 是否限制在城市范围内

        Returns:
            POI信息列表
        """
        url = "https://restapi.amap.com/v3/place/text"
        params = {
            "keywords": keywords,
            "city": city,
            "citylimit": "true" if citylimit else "false",
            "offset": 20,
            "page": 1,
            "extensions": "all",
        }
        try:
            data = self._request(url, params)
            if data.get("status") == "1":
                pois = data.get("pois", [])
                results = []
                for poi in pois:
                    loc_str = poi.get("location", ",")
                    lng, lat = loc_str.split(",") if "," in loc_str else ("0", "0")
                    results.append(
                        POIInfo(
                            id=poi.get("id", ""),
                            name=poi.get("name", ""),
                            type=poi.get("type", ""),
                            address=poi.get("address", ""),
                            location=Location(longitude=float(lng), latitude=float(lat)),
                            tel=poi.get("tel"),
                        )
                    )
                return results
            return []
        except Exception as e:
            print(f"❌ POI搜索失败: {str(e)}")
            return []

    def get_weather(self, city: str) -> List[WeatherInfo]:
        """
        查询天气

        Args:
            city: 城市名称

        Returns:
            天气信息列表
        """
        # 先获取城市adcode
        adcode = city
        try:
            geo_data = self._request(
                "https://restapi.amap.com/v3/geocode/geo",
                {"address": city},
            )
            if geo_data.get("status") == "1":
                geocodes = geo_data.get("geocodes", [])
                if geocodes:
                    adcode = geocodes[0].get("adcode", city)
        except Exception:
            pass

        url = "https://restapi.amap.com/v3/weather/weatherInfo"
        params = {"city": adcode, "extensions": "all"}
        try:
            data = self._request(url, params)
            if data.get("status") == "1":
                forecasts = data.get("forecasts", [])
                if forecasts:
                    casts = forecasts[0].get("casts", [])
                    results = []
                    for cast in casts:
                        results.append(
                            WeatherInfo(
                                date=cast.get("date", ""),
                                day_weather=cast.get("dayweather", ""),
                                night_weather=cast.get("nightweather", ""),
                                day_temp=cast.get("daytemp", 0),
                                night_temp=cast.get("nighttemp", 0),
                                wind_direction=cast.get("daywind", ""),
                                wind_power=cast.get("daypower", ""),
                            )
                        )
                    return results
            return []
        except Exception as e:
            print(f"❌ 天气查询失败: {str(e)}")
            return []

    def plan_route(
        self,
        origin_address: str,
        destination_address: str,
        origin_city: Optional[str] = None,
        destination_city: Optional[str] = None,
        route_type: str = "walking",
    ) -> Dict[str, Any]:
        """
        规划路线

        Args:
            origin_address: 起点地址
            destination_address: 终点地址
            origin_city: 起点城市
            destination_city: 终点城市
            route_type: 路线类型 (walking/driving/transit)

        Returns:
            路线信息
        """
        try:
            # 地理编码获取起点和终点坐标
            origin_full = f"{origin_city}{origin_address}" if origin_city else origin_address
            dest_full = f"{destination_city}{destination_address}" if destination_city else destination_address

            origin_geo = self.geocode(origin_address, origin_city)
            dest_geo = self.geocode(destination_address, destination_city)

            if not origin_geo or not dest_geo:
                return {"error": "无法获取起点或终点的地理坐标"}

            origin_loc = f"{origin_geo.longitude},{origin_geo.latitude}"
            dest_loc = f"{dest_geo.longitude},{dest_geo.latitude}"

            route_urls = {
                "walking": "https://restapi.amap.com/v3/direction/walking",
                "driving": "https://restapi.amap.com/v3/direction/driving",
                "transit": "https://restapi.amap.com/v3/direction/transit/integrated",
            }

            url = route_urls.get(route_type, route_urls["walking"])
            params = {"origin": origin_loc, "destination": dest_loc}

            if route_type == "transit":
                if origin_city:
                    params["city"] = origin_city
                if destination_city:
                    params["cityd"] = destination_city

            data = self._request(url, params)
            if data.get("status") == "1":
                route_data = data.get("route", {})
                paths = route_data.get("paths", [])
                if paths:
                    path = paths[0]
                    return {
                        "distance": float(path.get("distance", 0)),
                        "duration": int(path.get("duration", 0)),
                        "route_type": route_type,
                        "description": f"{route_type}路线，距离{path.get('distance', 0)}米，预计{int(int(path.get('duration', 0))/60)}分钟",
                        "steps": path.get("steps", []),
                    }
            return {"error": data.get("info", "路线规划失败")}

        except Exception as e:
            print(f"❌ 路线规划失败: {str(e)}")
            return {"error": str(e)}

    def geocode(self, address: str, city: Optional[str] = None) -> Optional[Location]:
        """
        地理编码(地址转坐标)

        Args:
            address: 地址
            city: 城市

        Returns:
            经纬度坐标
        """
        try:
            params = {"address": address}
            if city:
                params["city"] = city

            data = self._request("https://restapi.amap.com/v3/geocode/geo", params)
            if data.get("status") == "1":
                geocodes = data.get("geocodes", [])
                if geocodes:
                    loc_str = geocodes[0].get("location", ",")
                    lng, lat = loc_str.split(",") if "," in loc_str else ("0", "0")
                    return Location(longitude=float(lng), latitude=float(lat))
            return None

        except Exception as e:
            print(f"❌ 地理编码失败: {str(e)}")
            return None

    def get_poi_detail(self, poi_id: str) -> Dict[str, Any]:
        """
        获取POI详情

        Args:
            poi_id: POI ID

        Returns:
            POI详情信息
        """
        try:
            # 高德地图没有独立的detail接口，使用搜索接口通过ID查询
            url = "https://restapi.amap.com/v3/place/detail"
            params = {"id": poi_id}
            data = self._request(url, params)
            if data.get("status") == "1":
                pois = data.get("pois", [])
                if pois:
                    poi = pois[0]
                    loc_str = poi.get("location", ",")
                    lng, lat = loc_str.split(",") if "," in loc_str else ("0", "0")
                    return {
                        "id": poi.get("id"),
                        "name": poi.get("name"),
                        "type": poi.get("type"),
                        "address": poi.get("address"),
                        "location": {"longitude": float(lng), "latitude": float(lat)},
                        "tel": poi.get("tel"),
                        "photos": poi.get("photos", []),
                    }
            return {"error": data.get("info", "未找到POI详情")}

        except Exception as e:
            print(f"❌ 获取POI详情失败: {str(e)}")
            return {"error": str(e)}


# 创建全局服务实例
_amap_service = None


def get_amap_service() -> AmapService:
    """获取高德地图服务实例(单例模式)"""
    global _amap_service

    if _amap_service is None:
        settings = get_settings()
        if not settings.amap_api_key:
            raise ValueError("高德地图API Key未配置,请在.env文件中设置AMAP_API_KEY")
        _amap_service = AmapService()
        print(f"[OK] 高德地图服务初始化成功")

    return _amap_service
