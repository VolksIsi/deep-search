# Scheduler — APScheduler-based automated report generation
import asyncio
import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

# In-memory scheduler state (can be backed by memory.py for persistence)
_scheduled_jobs: dict[str, dict[str, Any]] = {}
_scheduler_running = False


async def run_scheduled_research(task_id: str, query: str, user_id: str) -> None:
    """Execute a scheduled research task.
    
    This function would typically invoke the agent pipeline directly.
    For now, it logs the execution and stores results via the memory module.
    """
    from .memory import update_task_last_run, save_report
    
    logger.info(f"[Scheduler] Executing task {task_id}: '{query}' for user {user_id}")
    
    try:
        # In a full implementation, this would trigger the agent pipeline
        # For now, we mark the task as executed
        update_task_last_run(int(task_id))
        
        # The actual research execution would happen here:
        # result = await run_agent_pipeline(query, user_id)
        # save_report(session_id, user_id, query, result)
        
        logger.info(f"[Scheduler] Task {task_id} completed successfully")
    except Exception as e:
        logger.error(f"[Scheduler] Task {task_id} failed: {e}")


def parse_cron_schedule(cron_expr: str) -> dict[str, str]:
    """Parse a simple cron expression into components.
    
    Supports: 'daily', 'weekly', 'hourly', or standard 5-field cron.
    """
    presets = {
        "daily": {"hour": "9", "minute": "0"},
        "weekly": {"day_of_week": "mon", "hour": "9", "minute": "0"},
        "hourly": {"minute": "0"},
        "every_6h": {"hour": "*/6", "minute": "0"},
        "every_12h": {"hour": "*/12", "minute": "0"},
    }
    
    if cron_expr.lower() in presets:
        return presets[cron_expr.lower()]
    
    # Parse standard 5-field cron: minute hour day month day_of_week
    parts = cron_expr.split()
    if len(parts) == 5:
        return {
            "minute": parts[0],
            "hour": parts[1],
            "day": parts[2],
            "month": parts[3],
            "day_of_week": parts[4],
        }
    
    return {"hour": "9", "minute": "0"}  # Default to daily at 9 AM


def add_job(task_id: str, query: str, user_id: str, schedule: str) -> dict[str, Any]:
    """Add a scheduled research job."""
    _scheduled_jobs[task_id] = {
        "id": task_id,
        "query": query,
        "user_id": user_id,
        "schedule": schedule,
        "schedule_parsed": parse_cron_schedule(schedule),
        "created_at": datetime.now().isoformat(),
        "last_run": None,
        "active": True,
    }
    
    logger.info(f"[Scheduler] Job added: {task_id} — '{query}' @ {schedule}")
    return _scheduled_jobs[task_id]


def remove_job(task_id: str) -> bool:
    """Remove a scheduled job."""
    if task_id in _scheduled_jobs:
        del _scheduled_jobs[task_id]
        logger.info(f"[Scheduler] Job removed: {task_id}")
        return True
    return False


def list_jobs() -> list[dict[str, Any]]:
    """List all scheduled jobs."""
    return list(_scheduled_jobs.values())


def get_scheduler_status() -> dict[str, Any]:
    """Get current scheduler status."""
    return {
        "running": _scheduler_running,
        "total_jobs": len(_scheduled_jobs),
        "active_jobs": sum(1 for j in _scheduled_jobs.values() if j.get("active")),
        "jobs": list_jobs(),
    }
