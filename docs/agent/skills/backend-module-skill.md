# Skill: Backend Module Creation

## Usage Trigger

MUST read this skill when the task involves: "new module", "create endpoint", "new feature module", "add API", "build service", "create route", "add a new route", "new feature".

## Prerequisites

1. Read [`CONVENTIONS.md`](../CONVENTIONS.md) — Where Code Goes, Module Shape, Middleware Patterns, ORM Rules  
2. Read [`CLAUDE.md`](../CLAUDE.md) — Hard Gates (HG-2, HG-6, HG-7)  
3. If the module matches a domain trigger in CLAUDE.md, read that domain skill first (HG-5)

## Steps

### Step 1: Module scaffolding

Create `api/src/modules/<module-name>/` with:

| File | Responsibility |
|------|----------------|
| `index.ts` | Exports `registerRoutes` + service interface for other modules |
| `<module>.routes.ts` | Thin handlers (validation, auth, RBAC → service) |
| `<module>.service.ts` | Business logic — NO cross-module ORM queries |
| `<module>.schema.ts` | Input/output schemas with `.strict()` |
| `<module>.types.ts` | Module types (if needed) |
| `<module>.test.ts` | Unit + integration tests |
| `README.md` | Purpose, key types, dependencies |

Register the module in the central app bootstrap.

### Step 2: Route handler pattern

```typescript
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/<resource>', {
    schema: { querystring: schema.listQuerySchema },
  }, async (req) => service.list(req.query));

  app.get('/api/v1/<resource>/:id', {
    preHandler: [requireAuth, requireRole('user', 'admin_super')],
  }, async (req) => service.getById(req.user, req.params.id));
}
```

### Step 3: Service boundaries (HG-6)

- This module owns its tables.  
- To use another domain’s data, call that module’s **exported service**, never its Prisma/SQL models.  
- Read-only analytics may be an explicit exception — document it in TRD.

### Step 4: Tests

- Unauthorized (401), wrong role (403), not found (404), validation (400), happy path.  
- Mock external adapters; don’t hit real payment/AI providers in unit tests.

## Anti-patterns

- ❌ Fat route handlers with business logic  
- ❌ Importing another module’s ORM models  
- ❌ Skipping schemas / `.strict()`  
- ❌ Shipping without tests  

## Done criteria

- [ ] Module registered and reachable  
- [ ] HG-2 and HG-6 satisfied  
- [ ] Tests green; README filled  
