# Simulation Backend (Azure World / OASIS engine)

This is the Python/Flask backend that powers the `/simulation` page in the main
Next.js app. It runs the **OASIS** multi-agent social-simulation engine plus the
graph-build, profile-generation, and report-agent pipelines.

It **cannot** run on Vercel (long-running, compute-heavy, needs Python 3.11 and
the OASIS native deps). It is vendored here so everything lives in one repo, but
it deploys as its own service. The Next.js `/simulation` page talks to it only
through the app's authenticated `/api/sim-proxy` route, which reaches this
service at the server-only `SIMULATION_API_URL`.

## What it exposes

- `GET  /health` — health check
- `/api/graph/*` — ontology + knowledge-graph build (Step 1)
- `/api/simulation/*` — env setup, profiles, run control, posts/timeline (Steps 2–3, interviews)
- `/api/report/*` — report generation + Report-Agent chat (Steps 4–5)

Default port: `5001`.

> **Security:** this service is internet-facing. `/api/*` requires the shared
> secret `SIMULATION_API_SECRET` (sent by the main app's `/api/sim-proxy` route
> as the `X-Simulation-Secret` header); without it configured, `/api/*` is
> refused unless `FLASK_DEBUG=True`. CORS is closed by default. Never run with
> `FLASK_DEBUG=True` in production — debug mode exposes a remote-code-execution
> console. Only `/health` is public.

## Required environment

Copy `.env.example` to `.env` and fill in:

| Var | Required | Notes |
|-----|----------|-------|
| `LLM_API_KEY` | yes | Eliza Cloud API key for primary simulation inference |
| `LLM_BASE_URL` | yes | Set to `https://www.elizacloud.ai/api/v1` for Eliza Cloud |
| `LLM_MODEL_NAME` | yes | Main simulation model; use `anthropic/claude-opus-4.7` |
| `LLM_FALLBACK_*` | recommended | Secondary provider/model; use DeepSeek for fallback |
| `REPORT_LLM_MODEL_NAME` | recommended | Report generation/chat model; use `anthropic/claude-haiku-4.5` |
| `INTERVIEW_LLM_MODEL_NAME` | recommended | Step 5 persona interview model; use `anthropic/claude-haiku-4.5` |
| `ZEP_API_KEY` | yes | Zep Cloud (long-term agent memory) |
| `SIMULATION_API_SECRET` | yes (prod) | Shared secret; must match the main app's `SIMULATION_API_SECRET`. `openssl rand -hex 32` |
| `SIMULATION_ALLOWED_ORIGINS` | optional | Comma-separated CORS allowlist; leave empty (proxy is server-to-server) |
| `LLM_BOOST_*` | optional | Stronger model for heavy steps |
| `FLASK_PORT` | optional | Defaults to `5001` |
| `FLASK_DEBUG` | optional | Defaults to `False`; never `True` in production |

The app refuses to start without `LLM_API_KEY` and `ZEP_API_KEY` (see
`Config.validate()`).

## Run locally

```bash
cd simulation-backend
cp .env.example .env   # then edit
pip install -e .       # Python 3.11 required (OASIS does not support 3.12+)
python run.py          # serves http://localhost:5001
```

Then in the main app's `.env.local` (server-only — no `NEXT_PUBLIC_`):

```
SIMULATION_API_URL=http://localhost:5001
SIMULATION_API_SECRET=<same value as the backend's SIMULATION_API_SECRET>
```

## Deploy (Railway / Render / Fly / any Docker host)

A `Dockerfile` is included (python:3.11-slim, exposes 5001).

**Railway / Render:**
1. New service from this repo, root directory `simulation-backend`.
2. It will detect the `Dockerfile`. No build command needed.
3. Add the env vars from the table above.
4. Expose port `5001` (Render: set `PORT`? — the app reads `FLASK_PORT`, so set
   `FLASK_PORT` to the platform's assigned port, or leave 5001 and map it).
5. Copy the public URL into the main app as `SIMULATION_API_URL`, and set a
   matching `SIMULATION_API_SECRET` on both this service and the main app.

**Docker directly:**
```bash
docker build -t mwa-simulation ./simulation-backend
docker run -p 5001:5001 --env-file ./simulation-backend/.env mwa-simulation
```

## Notes / gotchas

- **Python version:** OASIS (`camel-oasis`) requires Python ≥3.11, <3.12. The
  Dockerfile pins 3.11. On 3.12+ the simulation runner silently disables itself
  (graph/report still work, live sims won't).
- **State:** projects, uploads, and simulation data are written under
  `app/uploads/`. For a real deployment, mount a persistent volume there or the
  data resets on redeploy.
- **Long requests:** ontology generation and simulation runs take minutes. The
  frontend polls task-status endpoints rather than blocking; keep the platform's
  request timeout generous for the few synchronous calls.
- **Live OASIS interviews:** actions executed inside a running simulation share
  its initialized `LLM_MODEL_NAME`. Step 5 interactive persona interviews use
  the lighter `INTERVIEW_LLM_MODEL_NAME` path instead.
