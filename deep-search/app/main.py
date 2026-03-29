import os
import logging
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from google.adk.cli.fast_api import get_fast_api_app

from app.api_routes import router as custom_api_router

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
