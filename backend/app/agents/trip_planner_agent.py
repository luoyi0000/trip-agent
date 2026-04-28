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
from .promt import ATTRACTION_AGENT_PROMPT,WEATHER_AGENT_PROMPT,HOTEL_AGENT_PROMPT,PLANNER_AGENT_PROMPT

from .tool import AmapTextSearchTool,AmapWeatherTool

from .memory import UserPreferenceManager, TripContextManager

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
        """构建行程规划查询（含用户记忆注入）"""
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

        # 注入用户偏好记忆（跨会话）
        if request.user_id:
            try:
                pref_mgr = UserPreferenceManager()
                pref_context = pref_mgr.build_preference_prompt(request.user_id)
                if pref_context:
                    query += f"\n\n{pref_context}"

                trip_ctx = TripContextManager()
                trip_context = trip_ctx.build_context_prompt(request.user_id)
                if trip_context:
                    query += f"\n\n{trip_context}"
            except Exception as mem_err:
                print(f"[WARN] 记忆注入失败: {mem_err}")

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
