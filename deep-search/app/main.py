import os
import logging
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from google.adk.cli.fast_api import get_fast_api_app

from app.api_routes import router as custom_api_router

from app.config import config
from fastapi import Request
from fastapi.responses import JSONResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("allmighty")

# The ADK get_fast_api_app expects agents_dir pointing to the package
# that exports root_agent. Our app/ package has __init__.py with:
#   from app.agent import root_agent
AGENTS_DIR = os.path.dirname(os.path.abspath(__file__))

app = get_fast_api_app(
    agents_dir=AGENTS_DIR,
    session_service_uri="sqlite+aiosqlite:///./data/sessions.db",
    allow_origins=["*"],
    web=True,
)

# Auth Middleware: Protect critical /api routes
@app.middleware("http")
async def security_barrier(request: Request, call_next):
    # Only protect API and RPC routes
    if request.url.path.startswith("/api") or request.url.path.startswith("/rpc"):
        token = request.headers.get("X-Access-Token")
        if token != config.access_token:
            return JSONResponse(
                status_code=401,
                content={"detail": "Access Denied: Please provide a valid 2026-Style access token."}
            )
    response = await call_next(request)
    return response

# Mount our platform's custom API routes under /api
app.include_router(custom_api_router)

# Resolve and mount the frontend directory
# In the Docker container, this is at /app/frontend/dist
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_dir = os.path.join(base_dir, "frontend", "dist")

if os.path.exists(frontend_dir):
    logger.info(f"Mounting Allmighty Frontend from {frontend_dir}")
    app.mount("/app", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    logger.warning(f"Frontend dist directory not found at {frontend_dir}. UI will not be served.")

# Root redirect to the frontend application
@app.get("/")
async def root_redirect():
    return RedirectResponse(url="/app/")

# Standard health check endpoint for Cloud Run
@app.get("/healthz")
async def health_check():
    return {"status": "allmighty_operating_normally"}
