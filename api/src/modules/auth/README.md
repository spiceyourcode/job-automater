# Auth module

Handles user register, login, token refresh, logout, and `GET /me`.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | — | Create account, return tokens |
| POST | `/api/v1/auth/login` | — | Login, return tokens |
| POST | `/api/v1/auth/refresh` | — | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Bearer | Revoke all sessions |
| GET | `/api/v1/auth/me` | Bearer | Current user info |

## Token design

- **Access token** — HS256 JWT, 15 min TTL, contains `sub` (userId) + `email`
- **Refresh token** — random 40-byte hex, stored as SHA-256 hash in `user_sessions`

Refresh tokens rotate on every use. Logout revokes all sessions for the user.

## Security

- Passwords hashed with bcrypt (12 rounds)
- Failed login increments `failed_login_attempts`; locked account returns 401 (same error as wrong password)
- No PII in logs (HG-8)
- JWT_SECRET from env only (HG-1); startup fails if < 32 chars
