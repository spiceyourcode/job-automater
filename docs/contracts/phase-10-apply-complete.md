## Contract — Phase 10 Apply Completeness

**Phase:** 10  
**Services:** `api/`, `web/`, `workers/`

### GOAL
TRD FR-AA remaining: Workday/Ashby ATS, LinkedIn/Indeed/generic portals, rate limits, interview events, follow-ups. Kanban actions from AppFlow §2.4.

### CONSTRAINTS
- HG-4: every submit path still requires `POST /applications/:id/approve` + `approved_at`
- Assisted/manual modes download or pause for user — they do not bypass approve
- Screenshot proof on every automated submit (existing P4.2)
- CAPTCHA → user-visible error, worker does not crash

### FORMAT
- `workers/agents/submit_verify/` ATS: Workday, Ashby
- Portal appliers: LinkedIn Easy Apply, Indeed, generic career page
- `POST /applications/:id/interviews`, follow-up reminders, bulk archive/withdraw
- Emergency stop endpoint that drains/pauses submit queue for the user

### FAILURE
- Any submit without approve (HG-4)
- Rate limiter missing → unbounded portal hits
- Member can withdraw another member's application
