"""SQLite 数据库模块 - 行程历史、收藏、对话记录持久化"""

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

# 数据库文件路径（放在 backend 目录下）
DB_PATH = Path(__file__).parent / "data" / "travel_planner.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_conn() -> sqlite3.Connection:
    """获取数据库连接（单连接模式，适合小项目）"""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """初始化数据库表结构"""
    conn = get_conn()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS trip_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT NOT NULL,
                task_id     TEXT UNIQUE NOT NULL,
                city        TEXT NOT NULL,
                start_date  TEXT NOT NULL,
                end_date    TEXT NOT NULL,
                travel_days INTEGER NOT NULL,
                plan_data   TEXT,
                status      TEXT NOT NULL DEFAULT 'pending',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_trip_user_created ON trip_history(user_id, created_at DESC)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_trip_task ON trip_history(task_id)"
        )

        # 收藏表
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS favorites (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT NOT NULL,
                type        TEXT NOT NULL,
                title       TEXT NOT NULL,
                subtitle    TEXT DEFAULT '',
                tag         TEXT DEFAULT '',
                source_id   TEXT DEFAULT '',
                raw_data    TEXT DEFAULT '',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_fav_user ON favorites(user_id, created_at DESC)"
        )

        # 对话会话表
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT NOT NULL,
                title       TEXT DEFAULT '新对话',
                topic       TEXT DEFAULT '',
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_session_user ON chat_sessions(user_id, updated_at DESC)"
        )

        # 对话消息表
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  INTEGER NOT NULL,
                role        TEXT NOT NULL,
                text        TEXT NOT NULL,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_msg_session ON chat_messages(session_id, created_at)"
        )

        # 用户表
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email         TEXT UNIQUE NOT NULL,
                username      TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)"
        )

        conn.commit()
        print("[DB] 数据库初始化完成")
    finally:
        conn.close()


# ============ CRUD ============

def create_history(
    user_id: str,
    task_id: str,
    city: str,
    start_date: str,
    end_date: str,
    travel_days: int,
    status: str = "pending",
    plan_data: Optional[Dict[str, Any]] = None,
) -> None:
    """创建历史记录"""
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO trip_history
            (user_id, task_id, city, start_date, end_date, travel_days, status, plan_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                task_id,
                city,
                start_date,
                end_date,
                travel_days,
                status,
                json.dumps(plan_data, ensure_ascii=False) if plan_data else None,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def _serialize_plan_data(plan_data: Any) -> str:
    """将 plan_data（可能是 Pydantic 模型或 dict）序列化为 JSON 字符串"""
    if hasattr(plan_data, "model_dump"):
        # Pydantic v2
        return json.dumps(plan_data.model_dump(mode="json"), ensure_ascii=False)
    elif hasattr(plan_data, "dict"):
        # Pydantic v1
        return json.dumps(plan_data.dict(), ensure_ascii=False, default=str)
    else:
        return json.dumps(plan_data, ensure_ascii=False, default=str)


def update_history_status(
    task_id: str,
    status: str,
    plan_data: Any = None,
) -> None:
    """更新任务状态和结果数据"""
    conn = get_conn()
    try:
        if plan_data is not None:
            conn.execute(
                """
                UPDATE trip_history
                SET status = ?, plan_data = ?
                WHERE task_id = ?
                """,
                (status, _serialize_plan_data(plan_data), task_id),
            )
        else:
            conn.execute(
                "UPDATE trip_history SET status = ? WHERE task_id = ?",
                (status, task_id),
            )
        conn.commit()
    finally:
        conn.close()


def get_history_list(
    user_id: str, limit: int = 50, offset: int = 0
) -> List[Dict[str, Any]]:
    """查询用户的历史记录列表"""
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT id, task_id, city, start_date, end_date,
                   travel_days, status, created_at
            FROM trip_history
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (user_id, limit, offset),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_history_detail(task_id: str) -> Optional[Dict[str, Any]]:
    """查询单条历史记录详情（含 plan_data）"""
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM trip_history WHERE task_id = ?",
            (task_id,),
        ).fetchone()
        if not row:
            return None
        result = dict(row)
        if result.get("plan_data"):
            result["plan_data"] = json.loads(result["plan_data"])
        return result
    finally:
        conn.close()


def delete_history(task_id: str, user_id: str) -> bool:
    """删除历史记录，返回是否成功"""
    conn = get_conn()
    try:
        cursor = conn.execute(
            "DELETE FROM trip_history WHERE task_id = ? AND user_id = ?",
            (task_id, user_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def history_count(user_id: str) -> int:
    """统计用户历史记录数量"""
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM trip_history WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        return row["cnt"] if row else 0
    finally:
        conn.close()


# ============ FAVORITES CRUD ============

def add_favorite(
    user_id: str,
    type: str,
    title: str,
    subtitle: str = "",
    tag: str = "",
    source_id: str = "",
    raw_data: str = "",
) -> int:
    """添加收藏，返回新记录的 id"""
    conn = get_conn()
    try:
        cursor = conn.execute(
            """
            INSERT INTO favorites (user_id, type, title, subtitle, tag, source_id, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, type, title, subtitle, tag, source_id, raw_data),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_favorites(user_id: str) -> List[Dict[str, Any]]:
    """查询用户收藏列表"""
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT id, type, title, subtitle, tag, source_id, raw_data, created_at
            FROM favorites
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def delete_favorite(fav_id: int, user_id: str) -> bool:
    """删除收藏，返回是否成功"""
    conn = get_conn()
    try:
        cursor = conn.execute(
            "DELETE FROM favorites WHERE id = ? AND user_id = ?",
            (fav_id, user_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


# ============ CHAT CRUD ============

def create_chat_session(user_id: str, title: str = "新对话", topic: str = "") -> int:
    """创建新会话，返回 session_id"""
    conn = get_conn()
    try:
        cursor = conn.execute(
            "INSERT INTO chat_sessions (user_id, title, topic) VALUES (?, ?, ?)",
            (user_id, title, topic),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_chat_sessions(user_id: str) -> List[Dict[str, Any]]:
    """查询用户的历史会话列表"""
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT s.id, s.title, s.topic, s.created_at, s.updated_at,
                   (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) as msg_count
            FROM chat_sessions s
            WHERE s.user_id = ?
            ORDER BY s.updated_at DESC
            """,
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_chat_messages(session_id: int) -> List[Dict[str, Any]]:
    """查询单个会话的消息列表"""
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT id, role, text, created_at
            FROM chat_messages
            WHERE session_id = ?
            ORDER BY created_at ASC
            """,
            (session_id,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def add_chat_message(session_id: int, role: str, text: str) -> int:
    """添加一条消息，返回 message_id"""
    conn = get_conn()
    try:
        cursor = conn.execute(
            "INSERT INTO chat_messages (session_id, role, text) VALUES (?, ?, ?)",
            (session_id, role, text),
        )
        # 同时更新会话的 updated_at
        conn.execute(
            "UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def update_chat_session_title(session_id: int, title: str) -> None:
    """更新会话标题"""
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (title, session_id),
        )
        conn.commit()
    finally:
        conn.close()


def delete_chat_session(session_id: int, user_id: str) -> bool:
    """删除会话及关联消息（CASCADE），返回是否成功"""
    conn = get_conn()
    try:
        cursor = conn.execute(
            "DELETE FROM chat_sessions WHERE id = ? AND user_id = ?",
            (session_id, user_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


# ============ USER CRUD ============


def create_user(email: str, username: str, password_hash: str) -> dict:
    """创建用户，返回用户信息"""
    conn = get_conn()
    try:
        cursor = conn.execute(
            "INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)",
            (email, username, password_hash),
        )
        conn.commit()
        user_id = cursor.lastrowid
        return {"id": str(user_id), "email": email, "username": username}
    except sqlite3.IntegrityError:
        raise ValueError("该邮箱已被注册")
    finally:
        conn.close()


def get_user_by_email(email: str) -> Optional[dict]:
    """按邮箱查询用户"""
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id, email, username, password_hash, created_at FROM users WHERE email = ?",
            (email,),
        ).fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def get_user_by_id(user_id: str) -> Optional[dict]:
    """按 ID 查询用户"""
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id, email, username, created_at FROM users WHERE id = ?",
            (int(user_id),),
        ).fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def migrate_anonymous_data(from_anon_id: str, to_user_id: str) -> int:
    """
    将匿名用户的数据迁移到真实用户。
    更新 trip_history、favorites、chat_sessions 的 user_id。
    返回迁移的记录总数。
    """
    conn = get_conn()
    total = 0
    try:
        # 行程历史
        cur = conn.execute(
            "UPDATE trip_history SET user_id = ? WHERE user_id = ?",
            (to_user_id, from_anon_id),
        )
        total += cur.rowcount

        # 收藏
        cur = conn.execute(
            "UPDATE favorites SET user_id = ? WHERE user_id = ?",
            (to_user_id, from_anon_id),
        )
        total += cur.rowcount

        # 对话会话
        cur = conn.execute(
            "UPDATE chat_sessions SET user_id = ? WHERE user_id = ?",
            (to_user_id, from_anon_id),
        )
        total += cur.rowcount

        conn.commit()
        return total
    finally:
        conn.close()


# 初始化数据库
init_db()
