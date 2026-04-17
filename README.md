# Lance — Real-Time Workstation Safety Monitor

> Luxshare Smart Manufacturing Hackathon Project

Lance uses your laptop webcam, **OpenAI GPT-4o** for AI vision analysis, and a local **Ollama LLM** for personalized coaching to detect and alert on workstation safety hazards in real time.

## Features

- **Live webcam monitoring** — captures frames every 3 seconds
- **GPT-4o vision analysis** — detects persons, food/drink, loose cables, tools, components, hazards, and fire exits with normalised bounding boxes
- **Posture & housekeeping checks** — flags forward neck lean, clutter, spills, and trip hazards
- **Ollama-powered coaching** — generates actionable coaching messages locally (no data leaves your machine)
- **Real-time WebSocket alerts** — instant push to all connected clients
- **Worker Dashboard** — charts by severity, category, and hour-of-day with pattern-repeat alerts
- **Demo mode** — 5 built-in scenarios (Hazard, Posture, Housekeeping, All Clear, Multi Violation)
- **Incident management** — filter, review, and resolve incidents

---

## Project Structure

```
watchdog/
  backend/          FastAPI + GPT-4o + Ollama
  frontend/         React 18 + Vite 5 + Tailwind v4 + shadcn/ui + Recharts
  .env.example      Environment variable template
```

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 20+ (npm included) |
| Ollama | latest |
| An OpenAI API key | [platform.openai.com](https://platform.openai.com) |

---

### 1 — Clone & configure

```bash
git clone https://github.com/Hqroon/watchdog.git
cd watchdog
cp .env.example backend/.env
# Edit backend/.env and add your OPENAI_API_KEY
```

---

### 2 — Backend setup

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

---

### 3 — Ollama setup

```bash
# Install Ollama from https://ollama.com
ollama pull llama3        # or any model you prefer
ollama serve              # runs on http://localhost:11434
```

Set `OLLAMA_MODEL=llama3` in `backend/.env` (or whichever model you pulled).

---

### 4 — Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

Key frontend packages (all installed via `npm install`):

| Package | Purpose |
|---------|---------|
| `react` + `vite` | UI framework + build tool |
| `tailwindcss` v4 + `@tailwindcss/vite` | Utility CSS (Vite plugin, no PostCSS config needed) |
| `shadcn` + `radix-ui` | Component library (button, card, badge, tabs, table, etc.) |
| `class-variance-authority` + `clsx` + `tailwind-merge` | shadcn variant helpers |
| `lucide-react` | Icons |
| `sonner` | Toast notifications |
| `recharts` | Dashboard charts |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | **required** |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model name | `llama3` |

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/analyze` | Submit a JPEG frame for analysis |
| `GET` | `/incidents` | List recent incidents |
| `POST` | `/incidents/{id}/resolve` | Resolve an incident |
| `GET` | `/stats` | Aggregated statistics |
| `WS` | `/ws` | Real-time event stream |

---

## Architecture

```
Webcam → CameraFeed (React)
          │ POST /analyze (base64 JPEG)
          ▼
      FastAPI backend
          │
          ├─ GPT-4o vision     →  detections + posture/housekeeping JSON
          └─ Ollama            →  coaching message (local)
                │
                ├─ IncidentStore (in-memory ring buffer, 200 max)
                └─ WebSocket broadcast → AlertPanel / WorkerDashboard
```

---

## Hackathon Notes

- All OpenAI calls are made server-side — the API key never reaches the browser.
- Ollama runs fully locally — frame data does not leave the machine.
- The incident store is in-memory; swap for SQLite/PostgreSQL for production.
