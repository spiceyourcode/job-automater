## Contract — Phase 1 Foundation

**Phase:** 1 (Weeks 1–4)  
**Services:** `api/`, `web/`, `workers/` scaffolds + auth + profile stubs

### GOAL

A developer (or agent) can run `docker compose up -d`, start api/web/workers locally, register a user, login, and see an empty dashboard. All three services have health checks and shared env from `.env.example`.

### CONSTRAINTS

- Stack: Hono + Drizzle (`api/`), Next.js 15 (`web/`), Celery + Python 3.12 (`workers/`)
- No Turborepo/Nx — three independent package roots
- No n8n, no K8s manifests
- Auth: JWT access + refresh; bcrypt passwords
- DB schema follows `docs/Backend_Schema.md` tables: `users`, `profiles`, `sessions` minimum for P1.1–P1.5

### FORMAT

```
api/
  package.json, tsconfig.json, src/index.ts
  src/db/schema/ — Drizzle tables
  src/modules/auth/ — routes, service, schema, tests
  src/modules/health/ — GET /health

web/
  package.json, next.config.ts, app/layout.tsx
  app/(auth)/login, register
  app/dashboard/ — empty state

workers/
  pyproject.toml, celery_app.py, tasks/health.py
  README.md
```

### FAILURE (any = not done)

- `docker compose up -d` fails or postgres not reachable from api
- API has no `GET /health` returning 200
- Register + login flow returns tokens but refresh fails
- Secrets committed to git (must use `.env` only)
- Playwright or submit logic started in Phase 1 (belongs Phase 4)
- Cross-module raw SQL outside service layer (HG-6)

### Verification checklist

- [ ] `curl http://localhost:3001/health` → 200
- [ ] `curl http://localhost:3000` → Next.js loads
- [ ] Celery worker starts and runs `tasks.health.ping`
- [ ] Register → login → access protected route with Bearer token
