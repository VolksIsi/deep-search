# === Stage 1: Build Frontend ===
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit
COPY frontend/ ./
RUN npm run build

# === Stage 2: Python Runtime ===
FROM python:3.12-slim AS runtime

# Install system deps for WeasyPrint + matplotlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 \
    libffi-dev libcairo2 libglib2.0-0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir uv && \
    uv pip install --system --no-cache . && \
    rm -rf /root/.cache

# Copy application code
COPY app/ ./app/
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Create data directory
RUN mkdir -p /app/data

# Environment
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DATA_DIR=/app/data
ENV MEMORY_DB_PATH=/app/data/memory.db
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

# Start the ADK API server with frontend static files
CMD ["python", "-m", "uvicorn", "app.agent_engine_app:agent_engine", "--host", "0.0.0.0", "--port", "8080"]
