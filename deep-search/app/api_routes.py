# API routes for export, upload, memory, scheduling, and competitive intelligence
import logging
import json
import os
import shutil
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from .export import export_to_pdf, export_to_docx, export_to_html, export_to_txt
from .memory import (
    get_reports, get_report_by_id, get_recent_sessions,
    recall_memories, get_scheduled_tasks, add_scheduled_task,
    get_competitors, add_competitor, get_competitive_alerts
)
from .competitive_intel import run_competitive_scan, get_competitor_dashboard
from .scheduler import add_job, list_jobs, get_scheduler_status
from .config import config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# --- Models ---
class ExportRequest(BaseModel):
    content: str
    title: str = "Research Report"


class ScheduleRequest(BaseModel):
    query: str
    schedule: str = "daily"
    task_type: str = "report"


class CompetitorRequest(BaseModel):
    company: str
    domain: str = ""
    keywords: str = ""


class MemorySearchRequest(BaseModel):
    query: str
    user_id: str = "u_999"
    limit: int = 10


# --- Export Routes ---
@router.post("/export/pdf")
async def export_pdf(req: ExportRequest):
    """Export a report as PDF."""
    try:
        pdf_bytes = export_to_pdf(req.content, req.title)
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{req.title}.pdf"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF export failed: {str(e)}")


@router.post("/export/docx")
async def export_docx(req: ExportRequest):
    """Export a report as DOCX."""
    try:
        docx_bytes = export_to_docx(req.content, req.title)
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{req.title}.docx"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOCX export failed: {str(e)}")


@router.post("/export/html")
async def export_html(req: ExportRequest):
    """Export a report as HTML."""
    try:
        html_bytes = export_to_html(req.content, req.title)
        return StreamingResponse(
            io.BytesIO(html_bytes),
            media_type="text/html",
            headers={"Content-Disposition": f'attachment; filename="{req.title}.html"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HTML export failed: {str(e)}")


@router.post("/export/txt")
async def export_txt(req: ExportRequest):
    """Export a report as TXT."""
    try:
        txt_bytes = export_to_txt(req.content, req.title)
        return StreamingResponse(
            io.BytesIO(txt_bytes),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{req.title}.txt"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TXT export failed: {str(e)}")


# --- File Upload ---
@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    """Upload documents for RAG search."""
    uploaded = []
    for file in files:
        if file.filename:
            dest = config.data_dir / file.filename
            with open(dest, "wb") as f:
                content = await file.read()
                f.write(content)
            uploaded.append(file.filename)
            logger.info(f"Uploaded: {file.filename} ({len(content)} bytes)")
    return {"uploaded": uploaded, "total": len(uploaded)}


# --- Memory Routes ---
@router.get("/memory/sessions")
async def get_sessions(user_id: str = "u_999"):
    """Get recent research sessions."""
    return {"sessions": get_recent_sessions(user_id)}


@router.get("/memory/reports")
async def list_reports(user_id: str = "u_999"):
    """Get past research reports."""
    return {"reports": get_reports(user_id)}


@router.get("/memory/reports/{report_id}")
async def get_report(report_id: int):
    """Get a specific report by ID."""
    report = get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.post("/memory/search")
async def search_memories(req: MemorySearchRequest):
    """Search across past research memories."""
    memories = recall_memories(req.user_id, req.query, req.limit)
    return {"memories": memories, "count": len(memories)}


# --- Scheduler Routes ---
@router.get("/scheduler/status")
async def scheduler_status():
    """Get scheduler status."""
    return get_scheduler_status()


@router.get("/scheduler/tasks")
async def get_tasks(user_id: str = "u_999"):
    """Get scheduled tasks."""
    return {"tasks": get_scheduled_tasks(user_id)}


@router.post("/scheduler/tasks")
async def create_task(req: ScheduleRequest, user_id: str = "u_999"):
    """Create a new scheduled research task."""
    task_id = add_scheduled_task(user_id, req.query, req.schedule, req.task_type)
    add_job(str(task_id), req.query, user_id, req.schedule)
    return {"task_id": task_id, "status": "scheduled"}


# --- Competitive Intelligence Routes ---
@router.get("/intel/dashboard")
async def intel_dashboard(user_id: str = "u_999"):
    """Get competitive intelligence dashboard."""
    return get_competitor_dashboard(user_id)


@router.get("/intel/alerts")
async def get_alerts(user_id: str = "u_999", unread_only: bool = False):
    """Get competitive alerts."""
    alerts = get_competitive_alerts(user_id, unread_only)
    return {"alerts": alerts, "count": len(alerts)}


@router.post("/intel/competitors")
async def add_competitor_target(req: CompetitorRequest, user_id: str = "u_999"):
    """Add a competitor to monitor."""
    comp_id = add_competitor(user_id, req.company, req.domain, req.keywords)
    return {"competitor_id": comp_id, "status": "monitoring_active"}


@router.post("/intel/scan")
async def trigger_scan(user_id: str = "u_999"):
    """Trigger a competitive intelligence scan."""
    result = await run_competitive_scan(user_id)
    return result
