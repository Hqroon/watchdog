# Lance — Personal Wellness Monitor

> Luxshare Smart Manufacturing Hackathon Project

Lance is a personal wellness monitor that uses your laptop webcam to track posture, eye strain, hydration, drowsiness, and overwork in real time. It uses **OpenAI GPT-4o** for per-frame vision analysis and a local **Ollama LLM** for personalized coaching.

## Features

- **Live webcam monitoring** — captures frames every 3 seconds
- **GPT-4o wellness analysis** — scores posture (0–100), detects eye strain, checks for water, assesses focus state, and flags environment issues
- **Time-based reminders** — hydration timer (20 min), stand-up alerts (every 45 min), overwork warnings, posture streak detection, drowsiness detection, sudden absence / collapse risk
- **Ollama coaching** — generates encouraging, actionable coaching messages locally (no data leaves your machine)
- **Real-time WebSocket push** — instant alerts to all connected clients
- **Session Dashboard** — posture timeline, alert history, session KPIs
- **Demo mode** — 5 built-in scenarios (Good Session, Poor Posture, Drowsy, Overwork, Sudden Absence)
- **Session reset** — clear all state and start fresh with `POST /reset-session`

---

## Project Structure

```
watchdog/
  backend/          FastAPI + GPT-4o + Ollama + WellnessTracker
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
| `POST` | `/analyze` | Submit a JPEG frame for wellness analysis |
| `GET` | `/incidents` | List recent wellness alerts |
| `POST` | `/incidents/{id}/resolve` | Resolve an alert |
| `GET` | `/stats` | Aggregated statistics |
| `POST` | `/reset-session` | Reset WellnessTracker timing state |
| `WS` | `/ws` | Real-time event stream |

---

## Wellness Indicators

| Indicator | What it detects |
|-----------|----------------|
| **Posture** | Forward head, slouching, rounded shoulders, neck tilt — scored 0–100 |
| **Eye Strain** | Squinting, face too close to screen — none / mild / severe |
| **Hydration** | Water bottle / glass visible on desk |
| **Focus State** | Focused / drowsy / distracted / away |
| **Environment** | Lighting quality, monitor height |
| **Presence** | Person detected or empty seat |

## Time-Based Alerts (WellnessTracker)

| Alert | Trigger |
|-------|---------|
| Hydration reminder | No water seen for 20 minutes |
| Stand-up reminder | Every 45 minutes of sitting |
| Overwork warning | >90 min continuous presence, repeats every 60 min |
| Posture streak | 5 consecutive poor-posture frames (~30 seconds) |
| Drowsiness | 3 consecutive drowsy frames (~18 seconds) |
| Sudden absence | Presence drops after 3+ consecutive present frames |

---

## Architecture

```
Webcam → CameraFeed (React)
          │ POST /analyze (base64 JPEG)
          ▼
      FastAPI backend
          │
          ├─ GPT-4o vision      →  wellness JSON (posture, eye strain, hydration, focus…)
          ├─ WellnessTracker    →  time-based alerts (hydration, stand-up, overwork…)
          └─ Ollama             →  coaching message (local)
                │
                ├─ IncidentStore (in-memory ring buffer, 200 max)
                └─ WebSocket broadcast → WellnessPanel / SessionDashboard
```

---

## Hackathon Notes

- All OpenAI calls are made server-side — the API key never reaches the browser.
- Ollama runs fully locally — frame data does not leave the machine.
- The incident store is in-memory; swap for SQLite/PostgreSQL for production.
- `POST /reset-session` reinitialises the WellnessTracker timing state without restarting the server.
