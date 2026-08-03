# JobAutomater

AI job application automation platform.

## For agents

| Step | File |
|------|------|
| 1 | [`AGENTS.md`](./AGENTS.md) or [`CLAUDE.md`](./CLAUDE.md) |
| 2 | [`AGENT-PROMPTS.md`](./AGENT-PROMPTS.md) — task prompt |
| 3 | [`.agent-settings/phase-orchestrator.md`](./.agent-settings/phase-orchestrator.md) |

## For humans

```bash
cp .env.example .env
docker compose up -d
```

## Folder map

```
job_automater/
├── CLAUDE.md              Agent protocol
├── AGENT-PROMPTS.md       All task prompts (start → launch)
├── CONVENTIONS.md         Code standards
├── project-backlog.md     Phase checklist
├── docs/                  Product docs (ONLY copy)
├── docs/contracts/        Phase success criteria
├── .agent-settings/       Live task queue
├── 08-skills/             Domain rules
├── contracts/             Queue JSON schemas
├── api/                   TypeScript API (scaffold)
├── web/                   Next.js (scaffold)
└── workers/               Python agents (scaffold)
```

## Removed duplicates

Product docs live **only** in `docs/`. Root copies of PRD/TRD/AppFlow/etc. and the bootstrap template folder were removed.
