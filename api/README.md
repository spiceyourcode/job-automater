# API — Hono + Drizzle

**Status:** P1.1 scaffolded — health + DB connection.

## Prerequisites

```bash
# from repo root
cp .env.example .env   # if needed
docker compose up -d   # postgres on :5432
```

**Windows note:** If a local PostgreSQL service owns port 5432, stop it so Docker can publish the port. Prefer `127.0.0.1` in `DATABASE_URL` over `localhost`.

## Run

```bash
cd api
npm install
npm run dev
```

API listens on `API_PORT` (default **3001**).

## Verify

```bash
curl http://localhost:3001/health
# → 200 {"status":"ok","db":"up","timestamp":"..."}
```

## Structure

```
api/
├── src/
│   ├── index.ts
│   ├── app.ts
│   ├── env.ts
│   ├── db/
│   │   ├── index.ts
│   │   └── schema/          # tables in P1.2
│   └── modules/health/
├── drizzle.config.ts
└── package.json
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Watch mode via tsx |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:generate` | Drizzle kit generate (P1.2+) |
