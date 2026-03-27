# Persistent Memory System — Cross-session recall with SQLite
import sqlite3
import json
import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DB_PATH = Path(os.getenv("MEMORY_DB_PATH", "./data/memory.db"))


def _get_connection() -> sqlite3.Connection:
    """Get a thread-safe SQLite connection."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_memory_db() -> None:
    """Initialize the memory database schema."""
    conn = _get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            topic TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            memory_type TEXT NOT NULL DEFAULT 'fact',
            content TEXT NOT NULL,
            metadata TEXT DEFAULT '{}',
            importance REAL DEFAULT 0.5,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (session_id) REFERENCES sessions(session_id)
        );

        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            user_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            report_content TEXT NOT NULL,
            report_format TEXT DEFAULT 'markdown',
            sources_json TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            task_type TEXT NOT NULL DEFAULT 'report',
            query TEXT NOT NULL,
            schedule_cron TEXT NOT NULL,
            last_run TEXT,
            next_run TEXT,
            is_active INTEGER DEFAULT 1,
            config_json TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS competitive_targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            company_name TEXT NOT NULL,
            domain TEXT,
            keywords TEXT,
            monitoring_active INTEGER DEFAULT 1,
            last_checked TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS competitive_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_id INTEGER NOT NULL,
            alert_type TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            source_url TEXT,
            significance REAL DEFAULT 0.5,
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (target_id) REFERENCES competitive_targets(id)
        );

        CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
        CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
        CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
        CREATE INDEX IF NOT EXISTS idx_competitive_alerts_target ON competitive_alerts(target_id);
    """)
    conn.commit()
    conn.close()
    logger.info("Memory database initialized.")


# --- Session Memory ---
def save_session(session_id: str, user_id: str, topic: str) -> None:
    conn = _get_connection()
    conn.execute(
        "INSERT OR REPLACE INTO sessions (session_id, user_id, topic, updated_at) VALUES (?, ?, ?, datetime('now'))",
        (session_id, user_id, topic)
    )
    conn.commit()
    conn.close()


def store_memory(session_id: str, user_id: str, content: str, 
                 memory_type: str = "fact", importance: float = 0.5,
                 metadata: dict | None = None) -> int:
    """Store a memory fragment from a research session."""
    conn = _get_connection()
    cur = conn.execute(
        "INSERT INTO memories (session_id, user_id, memory_type, content, metadata, importance) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, user_id, memory_type, content, json.dumps(metadata or {}), importance)
    )
    conn.commit()
    memory_id = cur.lastrowid
    conn.close()
    return memory_id


def recall_memories(user_id: str, query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Recall relevant memories using keyword matching across sessions."""
    conn = _get_connection()
    keywords = query.lower().split()
    
    # Build a WHERE clause that matches any keyword in content
    conditions = " OR ".join(["LOWER(content) LIKE ?" for _ in keywords])
    params = [f"%{kw}%" for kw in keywords]
    
    rows = conn.execute(
        f"""SELECT m.id, m.session_id, m.memory_type, m.content, m.importance, m.created_at, s.topic
            FROM memories m
            LEFT JOIN sessions s ON m.session_id = s.session_id
            WHERE m.user_id = ? AND ({conditions})
            ORDER BY m.importance DESC, m.created_at DESC
            LIMIT ?""",
        [user_id] + params + [limit]
    ).fetchall()
    conn.close()
    
    return [
        {
            "id": r[0], "session_id": r[1], "type": r[2], "content": r[3],
            "importance": r[4], "created_at": r[5], "topic": r[6]
        }
        for r in rows
    ]


def get_recent_sessions(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    conn = _get_connection()
    rows = conn.execute(
        "SELECT session_id, topic, created_at, updated_at FROM sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
        (user_id, limit)
    ).fetchall()
    conn.close()
    return [{"session_id": r[0], "topic": r[1], "created_at": r[2], "updated_at": r[3]} for r in rows]


# --- Report Storage ---
def save_report(session_id: str, user_id: str, topic: str, content: str, 
                sources: dict | None = None, fmt: str = "markdown") -> int:
    conn = _get_connection()
    cur = conn.execute(
        "INSERT INTO reports (session_id, user_id, topic, report_content, report_format, sources_json) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, user_id, topic, content, fmt, json.dumps(sources or {}))
    )
    conn.commit()
    rid = cur.lastrowid
    conn.close()
    return rid


def get_reports(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    conn = _get_connection()
    rows = conn.execute(
        "SELECT id, topic, report_format, created_at, LENGTH(report_content) as size FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        (user_id, limit)
    ).fetchall()
    conn.close()
    return [{"id": r[0], "topic": r[1], "format": r[2], "created_at": r[3], "size": r[4]} for r in rows]


def get_report_by_id(report_id: int) -> dict[str, Any] | None:
    conn = _get_connection()
    row = conn.execute(
        "SELECT id, session_id, user_id, topic, report_content, report_format, sources_json, created_at FROM reports WHERE id = ?",
        (report_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0], "session_id": row[1], "user_id": row[2], "topic": row[3],
        "content": row[4], "format": row[5], "sources": json.loads(row[6]), "created_at": row[7]
    }


# --- Scheduled Tasks ---
def add_scheduled_task(user_id: str, query: str, cron: str, task_type: str = "report", config: dict | None = None) -> int:
    conn = _get_connection()
    cur = conn.execute(
        "INSERT INTO scheduled_tasks (user_id, task_type, query, schedule_cron, config_json) VALUES (?, ?, ?, ?, ?)",
        (user_id, task_type, query, cron, json.dumps(config or {}))
    )
    conn.commit()
    tid = cur.lastrowid
    conn.close()
    return tid


def get_scheduled_tasks(user_id: str) -> list[dict[str, Any]]:
    conn = _get_connection()
    rows = conn.execute(
        "SELECT id, task_type, query, schedule_cron, last_run, next_run, is_active FROM scheduled_tasks WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,)
    ).fetchall()
    conn.close()
    return [{"id": r[0], "type": r[1], "query": r[2], "cron": r[3], "last_run": r[4], "next_run": r[5], "active": bool(r[6])} for r in rows]


def update_task_last_run(task_id: int) -> None:
    conn = _get_connection()
    conn.execute("UPDATE scheduled_tasks SET last_run = datetime('now') WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()


# --- Competitive Intelligence ---
def add_competitor(user_id: str, company: str, domain: str = "", keywords: str = "") -> int:
    conn = _get_connection()
    cur = conn.execute(
        "INSERT INTO competitive_targets (user_id, company_name, domain, keywords) VALUES (?, ?, ?, ?)",
        (user_id, company, domain, keywords)
    )
    conn.commit()
    cid = cur.lastrowid
    conn.close()
    return cid


def get_competitors(user_id: str) -> list[dict[str, Any]]:
    conn = _get_connection()
    rows = conn.execute(
        "SELECT id, company_name, domain, keywords, monitoring_active, last_checked FROM competitive_targets WHERE user_id = ? ORDER BY company_name",
        (user_id,)
    ).fetchall()
    conn.close()
    return [{"id": r[0], "company": r[1], "domain": r[2], "keywords": r[3], "active": bool(r[4]), "last_checked": r[5]} for r in rows]


def add_competitive_alert(target_id: int, alert_type: str, title: str, summary: str, 
                          source_url: str = "", significance: float = 0.5) -> int:
    conn = _get_connection()
    cur = conn.execute(
        "INSERT INTO competitive_alerts (target_id, alert_type, title, summary, source_url, significance) VALUES (?, ?, ?, ?, ?, ?)",
        (target_id, alert_type, title, summary, source_url, significance)
    )
    conn.commit()
    aid = cur.lastrowid
    conn.close()
    return aid


def get_competitive_alerts(user_id: str, unread_only: bool = False, limit: int = 50) -> list[dict[str, Any]]:
    conn = _get_connection()
    query = """
        SELECT a.id, a.alert_type, a.title, a.summary, a.source_url, a.significance, a.is_read, a.created_at, t.company_name
        FROM competitive_alerts a
        JOIN competitive_targets t ON a.target_id = t.id
        WHERE t.user_id = ?
    """
    if unread_only:
        query += " AND a.is_read = 0"
    query += " ORDER BY a.created_at DESC LIMIT ?"
    
    rows = conn.execute(query, (user_id, limit)).fetchall()
    conn.close()
    return [{
        "id": r[0], "type": r[1], "title": r[2], "summary": r[3], "url": r[4],
        "significance": r[5], "read": bool(r[6]), "created_at": r[7], "company": r[8]
    } for r in rows]


# Initialize on import
init_memory_db()
