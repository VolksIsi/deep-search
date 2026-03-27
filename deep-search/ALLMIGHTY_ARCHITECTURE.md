# 🔥 ALLMIGHTY Deep Search — Architecture & Deployment Guide

## Overview

Allmighty Deep Search is a **production-grade, autonomous multi-agent research platform** powered by Google's ADK framework. It orchestrates parallel research workers, maintains persistent memory across sessions, monitors competitors daily, generates publication-quality reports with data visualizations, and exports to PDF/Word — all deployable to Google Cloud Run with a single command.

---

## 🚀 Core Capabilities

### 1. Multi-Agent Orchestration
- **Parallel Research Workers**: Up to 3 concurrent research agents (`MAX_PARALLEL_WORKERS`) working on different report sections simultaneously
- **Agent Pipeline**: `plan_generator` → `section_planner` → `section_researcher` → `research_evaluator` → `enhanced_search_executor` → `report_composer`
- **Quality Loop**: Iterative refinement with automatic escalation when research passes quality gates

### 2. Multi-Model Support
- **Gemini 2.0 Flash** / **Gemini 2.5 Pro** (default)
- **GPT-4o** (via LiteLLM)
- **Claude 3.5 Sonnet** (via LiteLLM)
- Dynamic model switching from the sidebar UI

### 3. Extended Tool Suite
| Tool | Description |
|------|-------------|
| `google_search` | Web search via Google's native tool |
| `web_scrape` | Deep content extraction with BeautifulSoup |
| `search_uploaded_docs` | RAG search across PDF, DOCX, TXT, MD, JSON |
| `mcp_query` | Model Context Protocol server connectivity |
| `recall_past_research` | Cross-session memory recall |
| `generate_chart` | Data visualization (bar, line, pie, scatter) |

### 4. Persistent Memory (SQLite)
- **Sessions**: Track all research sessions per user
- **Memories**: Store key findings with importance scoring for future recall
- **Reports**: Full report storage with source tracking
- **Auto-persistence**: Reports and findings automatically saved on completion

### 5. Data Visualization
- **Chart Types**: Bar, line, pie, scatter charts
- **Dark Theme**: Custom-styled for the Allmighty UI aesthetic
- **Matplotlib Backend**: Server-side rendering with base64 PNG output

### 6. Export Engine
- **PDF Export**: WeasyPrint-powered with premium typography (Inter font), tables, code blocks
- **DOCX Export**: python-docx with proper heading hierarchy, bold/italic support
- **Branded**: All exports include "Allmighty Deep Search Report" branding

### 7. Voice Input/Output
- **Voice Input**: Web Speech API continuous recognition
- **Voice Output**: SpeechSynthesis API for reading reports aloud
- **Controls**: Toggle in sidebar and research header

### 8. Competitive Intelligence
- **Competitor Monitoring**: Add companies to track
- **Automated Scanning**: News discovery via web scraping
- **Alert System**: Significance-scored alerts with read/unread tracking
- **Dashboard**: Aggregated view with alerts grouped by company

### 9. Report Scheduling
- **Cron-based**: `daily`, `weekly`, `hourly`, or custom 5-field cron expressions
- **Job Management**: Add, remove, list scheduled research tasks
- **Auto-execution**: Triggers full agent pipeline on schedule

---

## 📁 Project Structure

```
deep-search/
├── app/
│   ├── agent.py              # Core multi-agent pipeline + tools
│   ├── config.py             # Platform configuration
│   ├── memory.py             # SQLite persistent memory system
│   ├── export.py             # PDF/DOCX export engine
│   ├── scheduler.py          # APScheduler-based automation
│   ├── competitive_intel.py  # Competitor monitoring engine
│   ├── api_routes.py         # FastAPI REST endpoints
│   └── agent_engine_app.py   # ADK App entry point
├── frontend/
│   └── src/
│       ├── App.tsx            # Main app with sidebar, voice, export
│       └── components/
│           ├── ActivityTimeline.tsx
│           ├── ChatMessagesView.tsx
│           └── WelcomeScreen.tsx
├── Dockerfile                 # Multi-stage production build
├── cloudbuild.yaml            # Cloud Build CI/CD pipeline
├── Makefile                   # Development + deployment commands
└── pyproject.toml             # Python dependencies
```

---

## 🛠️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CRITIC_MODEL` | Evaluation model | `gemini-2.0-flash` |
| `WORKER_MODEL` | Research model | `gemini-2.0-flash` |
| `MAX_PARALLEL_WORKERS` | Parallel research agents | `3` |
| `MAX_SEARCH_ITERATIONS` | Quality refinement loops | `5` |
| `DATA_DIR` | RAG document storage | `./data` |
| `MEMORY_DB_PATH` | SQLite memory database | `./data/memory.db` |
| `ENABLE_SCHEDULER` | Enable report automation | `false` |
| `ENABLE_COMPETITIVE_INTEL` | Enable competitor monitoring | `false` |
| `MCP_SERVERS` | Comma-separated MCP server commands | `""` |
| `GCP_PROJECT_ID` | Google Cloud project | `""` |
| `GCP_REGION` | Deployment region | `us-central1` |

---

## 🚀 Deployment

### Local Development
```bash
make install    # Install all dependencies
make dev        # Start backend + frontend dev servers
```

### Docker
```bash
make docker-build   # Build production image
make docker-run     # Run locally with persistent data volume
```

### Google Cloud Run
```bash
# One-command deployment via Cloud Build
make cloud-deploy

# Or direct source deployment
make cloud-run-direct
```

### Cloud Run Specs
- **Memory**: 2 GiB
- **CPU**: 2 vCPU
- **Timeout**: 3600s (for long research sessions)
- **Concurrency**: 80 requests
- **Auto-scaling**: 0-10 instances

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/export/pdf` | Export report as PDF |
| POST | `/api/export/docx` | Export report as DOCX |
| POST | `/api/upload` | Upload RAG documents |
| GET | `/api/memory/sessions` | List past sessions |
| GET | `/api/memory/reports` | List past reports |
| GET | `/api/memory/reports/:id` | Get specific report |
| POST | `/api/memory/search` | Search across memories |
| GET | `/api/scheduler/status` | Scheduler status |
| GET | `/api/scheduler/tasks` | List scheduled tasks |
| POST | `/api/scheduler/tasks` | Create scheduled task |
| GET | `/api/intel/dashboard` | Competitive intel dashboard |
| GET | `/api/intel/alerts` | Get competitor alerts |
| POST | `/api/intel/competitors` | Add competitor to monitor |
| POST | `/api/intel/scan` | Trigger competitor scan |
