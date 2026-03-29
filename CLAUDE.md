# CLAUDE.md - Allmighty Deep Search Platform

## Workflow: Claude Code = Architekt & Chief, Google Agent = Executor

Dieses Projekt nutzt einen **Two-Agent-Workflow**:

1. **Claude Code** (Architekt & Chief Engineer)
   - Plant Features, Reviews Code, debuggt Fehler
   - Schreibt Prompts/Anweisungen für den Google IDX/Firebase Agent ("Antigravity Agent")
   - Reviewed die Ergebnisse des Antigravity Agents
   - Entscheidet über Architektur, Patterns, und nächste Schritte
   - Führt Git-Operationen und Deployment-Befehle aus

2. **Google Antigravity Agent** (IDX/Firebase Studio Agent)
   - Führt die von Claude geschriebenen Prompts aus
   - Hat direkten Zugriff auf Google Cloud, ADK, Firebase
   - Baut Features, fixt Bugs, deployt nach Anweisung
   - Nutzt GEMINI.md als seine Coding-Referenz

### Ablauf

```
[User meldet Problem/Feature-Wunsch]
        ↓
[Claude Code] analysiert, plant, schreibt Prompt
        ↓
[User] kopiert Prompt → Google Antigravity Agent
        ↓
[Antigravity Agent] führt aus, produziert Code/Output
        ↓
[User] teilt Ergebnis/Logs mit Claude Code
        ↓
[Claude Code] reviewed, korrigiert, schreibt nächsten Prompt
        ↓
  ... Iteration bis fertig ...
```

## Projekt-Überblick

**Allmighty Deep Search** ist eine Multi-Agent Research Platform auf Google ADK.

### Tech Stack
- **Backend**: Python 3.10+, FastAPI, Google ADK, Gemini 2.0/2.5
- **Frontend**: React 18, TypeScript, Vite, Tailwind, shadcn/ui
- **Infra**: Docker, Google Cloud Run, Vertex AI Agent Engine
- **DB**: SQLite (Sessions, Memory, Reports, Scheduler, Competitive Intel)

### Kern-Architektur (7-Stage Agent Pipeline)
1. **Plan Generator** → Erstellt 5-Punkte Forschungsplan
2. **Interactive Planner** → User approves/modifies Plan (Human-in-the-Loop)
3. **Section Planner** → Erstellt Markdown-Outline
4. **Section Researcher** → Recherchiert via Web Search, Scraping, RAG
5. **Research Evaluator** → Qualitätsprüfung (pass/fail)
6. **Enhanced Search Executor** → Nachrecherche bei "fail" (max 5 Iterationen)
7. **Report Composer** → Finaler Report mit Citations

### Wichtige Dateien
| Datei | Zweck |
|-------|-------|
| `deep-search/app/agent.py` | Alle Agent-Definitionen, Tools, Callbacks, Pipeline |
| `deep-search/app/main.py` | FastAPI Entry Point, ADK Integration |
| `deep-search/app/config.py` | Konfiguration, Environment Variables |
| `deep-search/app/memory.py` | SQLite Schema, Session/Memory Persistence |
| `deep-search/app/api_routes.py` | REST API: Export, Upload, Memory, Scheduler |
| `deep-search/app/export.py` | PDF/DOCX Report-Generierung |
| `deep-search/app/scheduler.py` | APScheduler für automatisierte Reports |
| `deep-search/app/competitive_intel.py` | Competitor Monitoring & Alerts |
| `deep-search/frontend/src/App.tsx` | React Hauptkomponente |
| `deep-search/Dockerfile` | Multi-Stage Build (Node + Python) |
| `deep-search/GEMINI.md` | Referenz-Guide für den Antigravity Agent |

### Deployment
- **Project ID**: project-3ca39165-fb2e-4579-84e
- **Region**: us-central1
- **Registry**: us-central1-docker.pkg.dev/project-3ca39165-fb2e-4579-84e/deep-search-repo/allmighty-deep-search
- **Cloud Run Service**: allmighty-deep-search
- **Specs**: 2 vCPU, 2 GiB RAM, Timeout 3600s, 0-10 Instanzen

### Prompt-Format für Antigravity Agent

Wenn Claude einen Prompt für den Antigravity Agent schreibt, nutze dieses Format:

```
## Aufgabe: [Kurztitel]

### Kontext
[Was wurde bisher gemacht, aktueller Stand]

### Anweisung
[Schritt-für-Schritt was der Agent tun soll]

### Erwartetes Ergebnis
[Was soll am Ende rauskommen]

### Wichtig
[Warnungen, Constraints, was NICHT gemacht werden soll]
```

### Regeln
- Claude ändert Code nur nach Review oder wenn der User es direkt anfordert
- Antigravity Agent bekommt immer vollständige, ausführbare Prompts
- Jede Änderung wird vor Deployment reviewed
- Bei Deployment-Fehlern: Logs posten → Claude analysiert → neuer Prompt
- GEMINI.md ist die Referenz des Antigravity Agents - bei Bedarf dort updaten
