## Contract — Phase 4 Approval-Gated Apply

### GOAL
User approves each application individually; Playwright submits only after POST /applications/:id/approve.

### CONSTRAINTS
- State machine: draft → pending_approval → approved → submitted
- SubmitApplicationJob requires approved_at timestamp
- ATS APIs (Greenhouse, Lever) before generic Playwright
- Screenshot proof saved on every submit

### FORMAT
- api/src/modules/applications/ — approve endpoint
- workers/agents/submit_verify/
- web — Approve button on review screen; Kanban pipeline (AppFlow §2.4)

### FAILURE
- Any submit path without approve (HG-4 violation)
- Submit without confirmation screenshot
- CAPTCHA failure crashes worker without user-visible error
