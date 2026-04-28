"""旅行规划API路由"""

import asyncio
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from ...models.schemas import (
    TripRequest,
    TripPlanTaskResponse,
    TripPlanTaskStatus,
    TripPlan,
)
from ...agents.trip_planner_agent import get_trip_planner_agent
from ...auth import get_current_user_id, require_user_id
from ...db import (
    create_history,
    update_history_status,
    get_history_list,
    get_history_detail,
    delete_history,
    history_count,
)

router = APIRouter(prefix="/trip", tags=["旅行规划"])

# 全局任务存储 (内存中, 用于实时状态查询, 服务重启后从数据库恢复)
_trip_tasks: dict[str, dict] = {}


async def _background_plan_task(task_id: str, request: TripRequest, user_id: str):
    """后台执行旅行规划任务"""
    _trip_tasks[task_id]["status"] = "processing"
    try:
        agent = get_trip_planner_agent()
        # 在线程池中执行同步的 plan_trip, 避免阻塞事件循环
        trip_plan = await asyncio.to_thread(agent.plan_trip, request)
        _trip_tasks[task_id] = {
            "status": "completed",
            "data": trip_plan,
            "message": "旅行计划生成成功"
        }
        # 持久化到数据库
        update_history_status(task_id, "completed", trip_plan)
        print(f"✅ 任务 {task_id} 完成并已持久化")
    except Exception as e:
        print(f"❌ 任务 {task_id} 失败: {str(e)}")
        import traceback
        traceback.print_exc()
        _trip_tasks[task_id] = {
            "status": "failed",
            "data": None,
            "message": f"生成旅行计划失败: {str(e)}"
        }
        # 持久化失败状态
        update_history_status(task_id, "failed")


@router.post(
    "/plan",
    response_model=TripPlanTaskResponse,
    summary="提交旅行计划任务",
    description="提交旅行规划任务, 立即返回任务ID, 通过轮询接口查询结果"
)
async def plan_trip(request: TripRequest, user_id: str = Depends(require_user_id)):
    """
    提交旅行计划生成任务
    """
    try:
        # 生成或获取用户ID
        _user_id = user_id or f"anon_{uuid.uuid4().hex[:12]}"

        print(f"\n{'='*60}")
        print(f"📥 收到旅行规划请求:")
        print(f"   用户: {_user_id}")
        print(f"   城市: {request.city}")
        print(f"   日期: {request.start_date} - {request.end_date}")
        print(f"   天数: {request.travel_days}")
        print(f"{'='*60}\n")

        # 生成唯一任务ID
        task_id = str(uuid.uuid4())
        _trip_tasks[task_id] = {
            "status": "pending",
            "data": None,
            "message": "任务已提交, 正在排队处理"
        }

        # 先写入数据库（pending 状态）
        create_history(
            user_id=_user_id,
            task_id=task_id,
            city=request.city,
            start_date=request.start_date,
            end_date=request.end_date,
            travel_days=request.travel_days,
            status="pending",
        )

        # 将用户 ID 注入请求，供记忆模块使用
        request.user_id = _user_id

        # 启动后台任务
        asyncio.create_task(_background_plan_task(task_id, request, _user_id))

        print(f"🚀 任务 {task_id} 已提交, 后台执行中...")

        return TripPlanTaskResponse(
            success=True,
            message="旅行规划任务已提交",
            task_id=task_id,
            status="processing",
            user_id=_user_id,  # 返回给前端存储
        )

    except Exception as e:
        print(f"❌ 提交任务失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"提交旅行规划任务失败: {str(e)}"
        )


@router.get(
    "/plan/status/{task_id}",
    response_model=TripPlanTaskStatus,
    summary="查询旅行计划任务状态",
    description="根据任务ID查询旅行规划任务的执行状态和结果"
)
async def get_plan_status(task_id: str):
    """
    查询旅行计划任务状态
    优先从内存查（实时）, 内存无则从数据库恢复
    """
    # 内存中有实时数据
    if task_id in _trip_tasks:
        task = _trip_tasks[task_id]
        return TripPlanTaskStatus(
            task_id=task_id,
            status=task["status"],
            data=task.get("data"),
            message=task.get("message", "")
        )

    # 内存中无, 尝试从数据库恢复（服务重启后）
    db_record = get_history_detail(task_id)
    if db_record:
        data = db_record.get("plan_data")
        return TripPlanTaskStatus(
            task_id=task_id,
            status=db_record["status"],
            data=TripPlan(**data) if data and db_record["status"] == "completed" else None,
            message="已从历史记录恢复" if db_record["status"] == "completed" else db_record.get("message", ""),
        )

    raise HTTPException(
        status_code=404,
        detail=f"任务不存在: {task_id}"
    )


# ============ 历史记录 API ============

@router.get(
    "/history",
    summary="查询历史行程列表",
    description="查询当前用户的历史行程记录, 按时间倒序"
)
async def get_trip_history(
    user_id: str = Depends(get_current_user_id),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    获取历史行程列表
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="缺少用户标识")

    items = get_history_list(user_id, limit, offset)
    total = history_count(user_id)

    return {
        "success": True,
        "message": "查询成功",
        "data": items,
        "total": total,
    }


@router.get(
    "/history/{task_id}",
    response_model=TripPlanTaskStatus,
    summary="查询历史行程详情",
    description="根据任务ID查询历史行程的完整详情"
)
async def get_trip_history_detail(task_id: str):
    """
    获取单条历史行程详情
    """
    # 优先查内存（实时）
    if task_id in _trip_tasks:
        task = _trip_tasks[task_id]
        return TripPlanTaskStatus(
            task_id=task_id,
            status=task["status"],
            data=task.get("data"),
            message=task.get("message", ""),
        )

    # 查数据库
    db_record = get_history_detail(task_id)
    if not db_record:
        raise HTTPException(status_code=404, detail=f"历史记录不存在: {task_id}")

    data = db_record.get("plan_data")
    return TripPlanTaskStatus(
        task_id=task_id,
        status=db_record["status"],
        data=TripPlan(**data) if data and db_record["status"] == "completed" else None,
        message=db_record.get("message", ""),
    )


@router.delete(
    "/history/{task_id}",
    summary="删除历史行程",
    description="删除指定历史行程记录"
)
async def remove_trip_history(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    删除历史行程
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="缺少用户标识")

    success = delete_history(task_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="记录不存在或无权限删除")

    # 同时清理内存中的任务
    if task_id in _trip_tasks:
        del _trip_tasks[task_id]

    return {
        "success": True,
        "message": "删除成功",
    }


@router.get(
    "/health",
    summary="健康检查",
    description="检查旅行规划服务是否正常"
)
async def health_check():
    """健康检查"""
    try:
        # 检查Agent是否可用
        get_trip_planner_agent()

        return {
            "status": "healthy",
            "service": "trip-planner"
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"服务不可用: {str(e)}"
        )
