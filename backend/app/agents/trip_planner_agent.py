"""多智能体旅行规划系统 - LangChain 版本"""

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


# ============ Agent 提示词 ============

ATTRACTION_AGENT_PROMPT = """你是景点搜索专家。你的任务是根据城市和用户偏好搜索合适的景点。

**重要提示:**
你必须使用工具来搜索景点！不要自己编造景点信息！

**可用工具:**
- `amap_maps_text_search`: 高德地图文本搜索，用于搜索城市中的景点

**使用方法:**
当用户要求搜索某城市的景点时，直接调用 `amap_maps_text_search` 工具，传入合适的 keywords 和 city 参数。

**示例:**
用户要求搜索北京的历史文化景点，你应该调用工具：
- keywords: "历史文化 景点"
- city: "北京"

**注意:**
1. 必须使用工具，不要直接回答
2. 将工具返回的搜索结果整理成简洁的文本返回给用户
3. 如果搜索结果为空，说明没有找到相关景点
"""

WEATHER_AGENT_PROMPT = """你是天气查询专家。你的任务是查询指定城市的天气信息。

**重要提示:**
你必须使用工具来查询天气！不要自己编造天气信息！

**可用工具:**
- `amap_maps_weather`: 高德地图天气查询工具

**使用方法:**
当用户要求查询某城市的天气时，直接调用 `amap_maps_weather` 工具，传入 city 参数。

**示例:**
用户要求查询北京天气，你应该调用工具：
- city: "北京"

**注意:**
1. 必须使用工具，不要直接回答
2. 将工具返回的天气信息整理成简洁的文本返回
3. 返回每天的天气概况，包括日期、天气、温度
"""

HOTEL_AGENT_PROMPT = """你是酒店推荐专家。你的任务是根据城市和景点位置推荐合适的酒店。

**重要提示:**
你必须使用工具来搜索酒店！不要自己编造酒店信息！

**可用工具:**
- `amap_maps_text_search`: 高德地图文本搜索，用于搜索酒店

**使用方法:**
当用户要求搜索某城市的酒店时，直接调用 `amap_maps_text_search` 工具，传入合适的 keywords 和 city 参数。

**示例:**
用户要求搜索北京的舒适型酒店，你应该调用工具：
- keywords: "舒适型酒店"
- city: "北京"

**注意:**
1. 必须使用工具，不要直接回答
2. keywords 必须包含用户指定的酒店类型（如舒适型、豪华型、经济型等）
3. 将搜索结果整理成简洁的文本返回
"""

PLANNER_AGENT_PROMPT = """你是行程规划专家。你的任务是根据城市和用户偏好，生成详细的旅行计划。

请严格按照以下JSON格式返回旅行计划:
```json
{
  "city": "城市名称",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "day_index": 0,
      "description": "第1天行程概述",
      "transportation": "交通方式",
      "accommodation": "住宿类型",
      "hotel": {
        "name": "酒店名称",
        "address": "酒店地址",
        "location": {"longitude": <该城市酒店经度>, "latitude": <该城市酒店纬度>},
        "price_range": "300-500元",
        "rating": "4.5",
        "type": "经济型酒店",
        "estimated_cost": 400
      },
      "attractions": [
        {
          "name": "景点名称",
          "address": "详细地址",
          "location": {"longitude": <该城市景点经度>, "latitude": <该城市景点纬度>},
          "visit_duration": 120,
          "description": "景点详细描述",
          "category": "景点类别",
          "ticket_price": 60,
          "poi_id": "高德POI ID",
          "image_search_keyword": "景点英文名 城市名 landmark"
        }
      ],
      "meals": [
        {"type": "breakfast", "name": "早餐推荐", "description": "早餐描述", "estimated_cost": 30},
        {"type": "lunch", "name": "午餐推荐", "description": "午餐描述", "estimated_cost": 50},
        {"type": "dinner", "name": "晚餐推荐", "description": "晚餐描述", "estimated_cost": 80}
      ]
    }
  ],
  "weather_info": [
    {
      "date": "YYYY-MM-DD",
      "day_weather": "晴",
      "night_weather": "多云",
      "day_temp": 25,
      "night_temp": 15,
      "wind_direction": "南风",
      "wind_power": "1-3级"
    }
  ],
  "overall_suggestions": "总体建议",
  "budget": {
    "total_attractions": 180,
    "total_hotels": 1200,
    "total_meals": 480,
    "total_transportation": 200,
    "total": 2060
  }
}
```

**重要提示:**
1. weather_info数组必须包含每一天的天气信息
2. 温度必须是纯数字(不要带°C等单位)
3. 每天安排2-3个景点
4. 考虑景点之间的距离和游览时间
5. 每天必须包含早中晚三餐
6. 提供实用的旅行建议
7. **必须包含预算信息**:
   - 景点门票价格(ticket_price)
   - 餐饮预估费用(estimated_cost)
   - 酒店预估费用(estimated_cost)
   - 预算汇总(budget)包含各项总费用
8. 如果提供的景点/天气/酒店数据不完整或为空，请基于你的通用知识推荐该城市的真实景点和酒店，不要留空
9. **所有景点和酒店的经纬度坐标必须使用该城市真实景点的实际坐标**，禁止复用示例中的占位坐标。如果不知道精确坐标，请基于该城市的中心经纬度合理估算
10. **如果搜索返回的景点包含 `poi_id`，必须原样保留该字段**，这是获取景点真实图片的关键标识
11. **每个景点必须包含 `image_search_keyword` 字段**: 用英文描述该景点，格式为 "景点英文名 城市名 landmark"，例如 "Forbidden City Beijing landmark"、"Great Wall Beijing scenery"。这个字段作为后备图片搜索方案
"""


# ============ LangChain Agent 封装 ============

class LangChainToolAgent:
    """基于 LangChain 的工具调用 Agent"""

    def __init__(self, llm, tools: List[BaseTool], system_prompt: str, name: str = "Agent"):
        self.name = name
        self.llm = llm.bind_tools(tools)
        self.tools = {tool.name: tool for tool in tools}
        self.system_prompt = system_prompt

    def run(self, query: str) -> str:
        """执行 Agent 任务"""
        messages = [SystemMessage(content=self.system_prompt), HumanMessage(content=query)]
        response = self.llm.invoke(messages)

        # 处理工具调用循环
        max_iterations = 5
        iteration = 0
        while response.tool_calls and iteration < max_iterations:
            messages.append(response)

            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                tool_call_id = tool_call["id"]

                if tool_name in self.tools:
                    try:
                        result = self.tools[tool_name].invoke(tool_args)
                    except Exception as e:
                        result = f"工具调用失败: {str(e)}"
                else:
                    result = f"工具 {tool_name} 未找到"

                messages.append(ToolMessage(content=str(result), tool_call_id=tool_call_id))

            response = self.llm.invoke(messages)
            iteration += 1

        return response.content


# ============ 多智能体旅行规划系统 ============

class MultiAgentTripPlanner:
    """多智能体旅行规划系统"""

    def __init__(self):
        """初始化多智能体系统"""
        print("[INIT] 开始初始化多智能体旅行规划系统...")

        try:
            self.llm = get_llm()

            # 创建共享工具
            print("  - 创建共享工具...")
            self.search_tool = AmapTextSearchTool()
            self.weather_tool = AmapWeatherTool()

            # 创建景点搜索Agent
            print("  - 创建景点搜索Agent...")
            self.attraction_agent = LangChainToolAgent(
                llm=self.llm,
                tools=[self.search_tool],
                system_prompt=ATTRACTION_AGENT_PROMPT,
                name="景点搜索专家",
            )

            # 创建天气查询Agent
            print("  - 创建天气查询Agent...")
            self.weather_agent = LangChainToolAgent(
                llm=self.llm,
                tools=[self.weather_tool],
                system_prompt=WEATHER_AGENT_PROMPT,
                name="天气查询专家",
            )

            # 创建酒店推荐Agent
            print("  - 创建酒店推荐Agent...")
            self.hotel_agent = LangChainToolAgent(
                llm=self.llm,
                tools=[self.search_tool],
                system_prompt=HOTEL_AGENT_PROMPT,
                name="酒店推荐专家",
            )

            # 创建行程规划Agent(不需要工具)
            print("  - 创建行程规划Agent...")
            self.planner_agent = LangChainToolAgent(
                llm=self.llm,
                tools=[],
                system_prompt=PLANNER_AGENT_PROMPT,
                name="行程规划专家",
            )

            # 创建线程池用于并行执行 Agent
            print("  - 创建线程池...")
            self.executor = ThreadPoolExecutor(max_workers=5)

            print(f"[OK] 多智能体系统初始化成功")

        except Exception as e:
            print(f"[ERR] 多智能体系统初始化失败: {str(e)}")
            import traceback

            traceback.print_exc()
            raise

    def plan_trip(self, request: TripRequest) -> TripPlan:
        """
        使用多智能体协作生成旅行计划

        Args:
            request: 旅行请求

        Returns:
            旅行计划
        """
        try:
            print(f"\n{'='*60}")
            print(f"[START] 开始多智能体协作规划旅行...")
            print(f"目的地: {request.city}")
            print(f"日期: {request.start_date} 至 {request.end_date}")
            print(f"天数: {request.travel_days}天")
            print(f"偏好: {', '.join(request.preferences) if request.preferences else '无'}")
            print(f"{'='*60}\n")

            # 步骤1-3: 并行执行景点搜索、天气查询、酒店搜索
            print("[SEARCH] 并行执行景点/天气/酒店搜索...")
            attraction_query = self._build_attraction_query(request)
            weather_query = f"请查询{request.city}的天气信息"
            hotel_query = f"请搜索{request.city}的{request.accommodation}酒店"

            futures = {
                self.executor.submit(self.attraction_agent.run, attraction_query): "attraction",
                self.executor.submit(self.weather_agent.run, weather_query): "weather",
                self.executor.submit(self.hotel_agent.run, hotel_query): "hotel",
            }

            attraction_response = ""
            weather_response = ""
            hotel_response = ""

            for future in as_completed(futures):
                task_name = futures[future]
                try:
                    result = future.result()
                    if task_name == "attraction":
                        attraction_response = result
                        print("[OK] 景点搜索完成")
                    elif task_name == "weather":
                        weather_response = result
                        print("[OK] 天气查询完成")
                    elif task_name == "hotel":
                        hotel_response = result
                        print("[OK] 酒店搜索完成")
                except Exception as e:
                    print(f"[WARN]  {task_name} 搜索失败: {str(e)}")
                    if task_name == "attraction":
                        attraction_response = f"【景点】数据获取失败: {str(e)}"
                    elif task_name == "weather":
                        weather_response = f"【天气】数据获取失败: {str(e)}"
                    elif task_name == "hotel":
                        hotel_response = f"【酒店】数据获取失败: {str(e)}"

            attraction_clean = self._truncate_result(attraction_response, "景点")
            weather_clean = self._truncate_result(weather_response, "天气")
            hotel_clean = self._truncate_result(hotel_response, "酒店")
            print(f"景点搜索结果(已处理): {attraction_clean[:200]}...\n")
            print(f"天气查询结果(已处理): {weather_clean[:200]}...\n")
            print(f"酒店搜索结果(已处理): {hotel_clean[:200]}...\n")

            # 步骤4: 行程规划Agent整合信息生成计划
            print("[PLAN] 步骤4: 生成行程计划...")
            planner_query = self._build_planner_query(request, attraction_clean, weather_clean, hotel_clean)
            planner_response = self.planner_agent.run(planner_query)
            print(f"行程规划结果: {planner_response[:300]}...\n")

            # 解析最终计划
            trip_plan = self._parse_response(planner_response, request)

            # 用高德POI详情获取真实图片
            self._enrich_attraction_photos(trip_plan)

            print(f"{'='*60}")
            print(f"[OK] 旅行计划生成完成!")
            print(f"{'='*60}\n")

            return trip_plan

        except Exception as e:
            print(f"[ERR] 生成旅行计划失败: {str(e)}")
            import traceback

            traceback.print_exc()
            return self._create_fallback_plan(request)

    def _build_attraction_query(self, request: TripRequest) -> str:
        """构建景点搜索查询"""
        keywords = request.preferences[0] if request.preferences else "景点"
        query = f"请使用工具搜索{request.city}的{keywords}相关景点。"
        return query

    def _truncate_result(self, result: str, label: str) -> str:
        """
        截断并清理Agent结果，避免超长提示词拖垮Planner Agent

        Args:
            result: Agent原始响应
            label: 结果标签（景点/天气/酒店）

        Returns:
            截断并清理后的结果
        """
        if not result or len(result.strip()) < 10:
            return f"【{label}】未获取到有效数据。"

        # 检测失败/错误关键词
        fail_keywords = [
            "失败", "未找到", "timeout", "timed out", "错误", "[ERR]", "工具未找到",
            "抱歉", "missing", "not found", "unavailable", "error",
        ]
        result_lower = result.lower()
        if any(kw.lower() in result_lower for kw in fail_keywords):
            return f"【{label}】数据获取失败，请基于通用知识推荐。"

        # 截断到合理长度（800字符）
        max_len = 800
        if len(result) > max_len:
            return result[:max_len] + "...（已截断）"
        return result

    def _build_planner_query(self, request: TripRequest, attractions: str, weather: str, hotels: str = "") -> str:
        """构建行程规划查询"""
        query = f"""请为{request.city}生成{request.travel_days}天旅行计划:

基本信息:
- 城市: {request.city}
- 日期: {request.start_date} 至 {request.end_date}
- 天数: {request.travel_days}天
- 交通方式: {request.transportation}
- 住宿偏好: {request.accommodation}
- 旅行偏好: {', '.join(request.preferences) if request.preferences else '无'}

参考景点信息:
{attractions}

参考天气信息:
{weather}

参考酒店信息:
{hotels}

要求:
1. 每天安排2-3个景点，必须是该城市真实存在的著名景点
2. 每天包含早中晚三餐
3. 每天推荐一个酒店
4. 考虑景点间距离合理规划路线
5. 返回完整JSON格式数据
6. 如参考数据为空或不足，请直接基于你的知识推荐真实的景点和酒店
"""
        if request.free_text_input:
            query += f"\n额外要求: {request.free_text_input}"

        return query

    def _parse_response(self, response: str, request: TripRequest) -> TripPlan:
        """
        解析Agent响应

        Args:
            response: Agent响应文本
            request: 原始请求

        Returns:
            旅行计划
        """
        try:
            # 尝试从响应中提取JSON
            # 查找JSON代码块
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                json_str = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.find("```") + 3
                json_end = response.find("```", json_start)
                json_str = response[json_start:json_end].strip()
            elif "{" in response and "}" in response:
                # 直接查找JSON对象
                json_start = response.find("{")
                json_end = response.rfind("}") + 1
                json_str = response[json_start:json_end]
            else:
                raise ValueError("响应中未找到JSON数据")

            # 解析JSON
            data = json.loads(json_str)

            # 转换为TripPlan对象
            trip_plan = TripPlan(**data)

            return trip_plan

        except Exception as e:
            print(f"[WARN]  解析响应失败: {str(e)}")
            print(f"   将使用备用方案生成计划")
            return self._create_fallback_plan(request)

    def _enrich_attraction_photos(self, trip_plan: TripPlan) -> None:
        """用高德POI详情中的真实图片丰富景点信息"""
        try:
            amap_service = get_amap_service()

            def fetch_photo(day_idx: int, attr_idx: int, poi_id: str):
                try:
                    detail = amap_service.get_poi_detail(poi_id)
                    photos = detail.get("photos", [])
                    if photos and len(photos) > 0:
                        return day_idx, attr_idx, photos[0].get("url")
                except Exception as e:
                    print(f"[WARN] 获取POI详情失败 {poi_id}: {e}")
                return day_idx, attr_idx, None

            # 收集所有需要获取图片的景点
            tasks = []
            for i, day in enumerate(trip_plan.days):
                for j, attraction in enumerate(day.attractions):
                    if getattr(attraction, "poi_id", None):
                        tasks.append((i, j, attraction.poi_id))

            if not tasks:
                print("[INFO] 无poi_id，跳过图片获取")
                return

            # 并行获取
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = {
                    executor.submit(fetch_photo, d, a, pid): (d, a)
                    for d, a, pid in tasks
                }
                for future in as_completed(futures):
                    d, a, url = future.result()
                    if url:
                        trip_plan.days[d].attractions[a].image_url = url
                        print(f"[OK] 获取真实图片: {trip_plan.days[d].attractions[a].name}")

        except Exception as e:
            print(f"[WARN] 丰富图片失败: {e}")

    @staticmethod
    def _get_city_coords(city: str) -> tuple:
        """根据城市名返回近似中心坐标"""
        city_coords = {
            "北京": (116.4, 39.9),
            "上海": (121.5, 31.2),
            "广州": (113.3, 23.1),
            "深圳": (114.1, 22.5),
            "成都": (104.1, 30.6),
            "杭州": (120.2, 30.3),
            "武汉": (114.3, 30.6),
            "西安": (108.9, 34.3),
            "重庆": (106.5, 29.6),
            "南京": (118.8, 32.1),
            "苏州": (120.6, 31.3),
            "天津": (117.2, 39.1),
            "长沙": (113.0, 28.2),
            "郑州": (113.7, 34.8),
            "东莞": (113.8, 23.0),
            "青岛": (120.4, 36.1),
            "沈阳": (123.4, 41.8),
            "宁波": (121.5, 29.9),
            "昆明": (102.7, 25.0),
            "大连": (121.6, 38.9),
            "厦门": (118.1, 24.5),
            "合肥": (117.3, 31.8),
            "佛山": (113.1, 23.0),
            "福州": (119.3, 26.1),
            "哈尔滨": (126.6, 45.8),
            "济南": (117.0, 36.7),
            "温州": (120.7, 28.0),
            "长春": (125.3, 43.9),
            "石家庄": (114.5, 38.0),
            "常州": (119.9, 31.8),
            "泉州": (118.6, 24.9),
            "南宁": (108.4, 22.8),
            "贵阳": (106.7, 26.6),
            "南昌": (115.9, 28.7),
            "太原": (112.5, 37.9),
            "烟台": (121.4, 37.5),
            "嘉兴": (120.8, 30.8),
            "南通": (120.9, 32.0),
            "金华": (119.6, 29.1),
            "珠海": (113.6, 22.3),
            "惠州": (114.4, 23.1),
            "徐州": (117.2, 34.3),
            "海口": (110.3, 20.0),
            "乌鲁木齐": (87.6, 43.8),
            "绍兴": (120.6, 30.0),
            "中山": (113.4, 22.5),
            "台州": (121.4, 28.7),
            "兰州": (103.8, 36.0),
        }
        # 默认返回北京坐标，但以城市名为 key 做模糊匹配
        for key, coord in city_coords.items():
            if key in city or city in key:
                return coord
        return (116.4, 39.9)

    def _create_fallback_plan(self, request: TripRequest) -> TripPlan:
        """创建备用计划(当Agent失败时)"""
        from datetime import datetime, timedelta

        # 解析日期
        start_date = datetime.strptime(request.start_date, "%Y-%m-%d")

        # 创建每日行程
        days = []
        for i in range(request.travel_days):
            current_date = start_date + timedelta(days=i)

            day_plan = DayPlan(
                date=current_date.strftime("%Y-%m-%d"),
                day_index=i,
                description=f"第{i+1}天行程",
                transportation=request.transportation,
                accommodation=request.accommodation,
                attractions=[
                    Attraction(
                        name=f"{request.city}景点{j+1}",
                        address=f"{request.city}市",
                        location=Location(longitude=self._get_city_coords(request.city)[0] + i * 0.02 + j * 0.01, latitude=self._get_city_coords(request.city)[1] + i * 0.02 + j * 0.01),
                        visit_duration=120,
                        description=f"这是{request.city}的著名景点",
                        category="景点",
                    )
                    for j in range(2)
                ],
                meals=[
                    Meal(type="breakfast", name=f"第{i+1}天早餐", description="当地特色早餐"),
                    Meal(type="lunch", name=f"第{i+1}天午餐", description="午餐推荐"),
                    Meal(type="dinner", name=f"第{i+1}天晚餐", description="晚餐推荐"),
                ],
            )
            days.append(day_plan)

        return TripPlan(
            city=request.city,
            start_date=request.start_date,
            end_date=request.end_date,
            days=days,
            weather_info=[],
            overall_suggestions=f"这是为您规划的{request.city}{request.travel_days}日游行程,建议提前查看各景点的开放时间。",
        )


# 全局多智能体系统实例
_multi_agent_planner = None


def get_trip_planner_agent() -> MultiAgentTripPlanner:
    """获取多智能体旅行规划系统实例(单例模式)"""
    global _multi_agent_planner

    if _multi_agent_planner is None:
        _multi_agent_planner = MultiAgentTripPlanner()

    return _multi_agent_planner
