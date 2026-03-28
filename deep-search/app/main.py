import os
import logging
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from app.agent import app as adk_app
from app.api_routes import router as custom_api_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("allmighty")

# Initialize FastAPI from ADK's built-in server
# This provides the standard research endpoints used by the ADK app
app = adk_app.api_server()

# Mount our platform's custom API routes (Export, Memory, Scheduler, Intel)
# These are mounted with the /api prefix as expected by the frontend
app.include_router(custom_api_router)

# Resolve the frontend directory
# In production (Docker), this is at /app/frontend/dist
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_dir = os.path.join(base_dir, "frontend", "dist")

if os.path.exists(frontend_dir):
    logger.info(f"🚀 Mounting Allmighty Frontend from {frontend_dir}")
    # Serve the React app at the /app path
    app.mount("/app", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    logger.warning(f"⚠️ Frontend dist directory not found at {frontend_dir}. UI will not be served.")

# Root redirect for convenience
@app.get("/")
async def root_redirect():
    return RedirectResponse(url="/app/")

# System health endpoint
@app.get("/healthz")
async def health_check():
    return {"status": "allmighty_operating_normally"}
