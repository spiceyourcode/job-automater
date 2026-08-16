# Workers — Celery + collectors + agents

**Status:** P1.5 + P2.2 collectors + P2.3 extract_normalize + **P2.4 match_score**.

## Contract

- `docs/contracts/phase-2-collection.md`
- `08-skills/job-agent-skill.md`
- `contracts/queue-payloads.schema.json` → Collect / Normalize / MatchScore

## Structure

```
workers/
├── collectors/
├── agents/
│   ├── extract_normalize/
│   └── match_score/          # dedup → score → validate (reasoning required)
├── tasks/
│   ├── collect_source.py
│   ├── normalize_jobs.py
│   └── match_score.py
└── tests/
```

Weights (TRD): skills 40%, experience 25%, location 15%, salary 10%, culture 10%.

Pipeline: collect → normalize → match_score. Scores are user-scoped (IDOR-safe).

## Run worker (local)

```bash
# Activate .venv first
celery -A celery_app worker -l info
```

On **Windows**, the app defaults to `--pool=solo` (prefork crashes with `WinError 6`). You can also force it:

```bash
celery -A celery_app worker -l info --pool=solo
```

After installing the `playwright` extra, download Chromium once:

```bash
python -m playwright install chromium
```

Playwright sources need real CSS selectors for that site (`startUrl`, `jobCardSelector`, `titleSelector`). A bare careers URL with `.job-card` usually yields 0 jobs.

## Tests (WSL + rtk)

```bash
wsl -d Debian -- bash -lc 'export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH; cd /mnt/c/.../workers && rtk proxy ./.venv/Scripts/python.exe -m pytest -q'
```
