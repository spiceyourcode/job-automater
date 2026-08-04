# Skill: Auth & RBAC Implementation

## Usage Trigger

MUST read this skill when the task involves: "auth", "register", "login", "OTP", "JWT", "refresh token", "RBAC", "role check", "permissions", "password reset", "logout", "session management", "verify", "role", "permission".

## Prerequisites

1. Read [`CONVENTIONS.md`](../CONVENTIONS.md) — Domain Guardrails, Module Shape, Middleware Patterns  
2. Read [PRD roles / permission matrix](../docs/PRD.md)  
3. Read [TRD auth/security](../docs/TRD.md) — JWT/session patterns  

## Steps

### Step 1: Determine roles involved

Identify which roles are affected. Reference the PRD permission matrix (`{{ROLE_LIST}}`).

### Step 2: Create route with schema validation

1. Define schemas in `<module>.schema.ts` for body, params, query.  
2. Use `.strict()` (or equivalent) to reject unknown fields.  
3. Register the route with framework validation.

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['user', 'admin_super']), // replace with your roles
}).strict();
```

### Step 3: Declare allowed roles on the route

Every protected route MUST declare roles via `requireRole()` (or equivalent):

```typescript
app.get('/api/v1/admin/users', {
  preHandler: [requireAuth, requireRole('admin_super', 'admin_restricted')],
}, async (req) => userService.list(req.query));
```

### Step 4: Add resource ownership check

If the endpoint accesses a user-owned resource:

```typescript
const resource = await service.getById(id);
if (resource.ownerId !== actor.userId && actor.role !== 'admin_super') {
  throw Errors.forbidden('Not your resource');
}
```

### Step 5: Tokens & secrets

- Hash passwords with a modern KDF (e.g. argon2).  
- Never store raw refresh tokens — hash at rest.  
- Rotate refresh tokens; detect reuse (token family theft).  
- Rate-limit login / OTP / password-reset endpoints.  
- JWT secrets from env only; reject weak defaults in production (HG-1).

## Anti-patterns

- ❌ Trusting role from request body  
- ❌ Missing ownership checks (IDOR)  
- ❌ Returning stack traces / DB errors to clients  
- ❌ Skipping rate limits on auth endpoints  

## Done criteria

- [ ] Schemas validate all inputs  
- [ ] Every protected route has auth + RBAC  
- [ ] Ownership checked in service layer  
- [ ] Tests: success + 401 + 403 + validation error  
