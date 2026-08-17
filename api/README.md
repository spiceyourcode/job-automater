# API — Hono + Drizzle

HTTP API for auth, profile/CV, sources, jobs, applications, email, analytics, and team.

## Run

From the repo root:

```bash
cp .env.example .env
docker compose up -d
cd api
npm install
npm run db:migrate
npm run dev
```

Listens on `API_PORT` (default **3001**). Prefer `127.0.0.1` in `DATABASE_URL` on Windows.

```bash
curl http://localhost:3001/health
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Watch mode via tsx |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:generate` | Drizzle kit generate |
| `npm run db:migrate` | Apply migrations |
