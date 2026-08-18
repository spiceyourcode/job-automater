# JobAutomater mobile companion

Expo app for notifications-style quick actions: log in, list applications, and **approve** via `POST /api/v1/applications/:id/approve` (HG-4). Submit still requires that API gate.

```bash
cd mobile
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL` to your API (never put JWT secrets or Stripe keys in the app).
