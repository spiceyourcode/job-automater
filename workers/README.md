# Workers — Celery + LangGraph + Playwright

**Status:** Not scaffolded. Start with task **P1.5** in `.agent-settings/phase-orchestrator.md`.

## Contract

Read `docs/contracts/phase-1-foundation.md` and `08-skills/job-agent-skill.md`.

## Planned structure

```
workers/
├── celery_app.py
├── tasks/
├── agents/
│   ├── extract_normalize/
│   ├── match_score/
│   ├── generate_docs/
│   └── submit_verify/
├── collectors/
└── pyproject.toml
```

## Run (after scaffold)

```bash
cd workers
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev]"
celery -A celery_app worker --loglevel=info
```

Queue payloads must match `contracts/queue-payloads.schema.json`.
