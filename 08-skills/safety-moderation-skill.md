# Skill: Safety, Moderation & Compliance

## Usage Trigger

MUST read this skill when the task involves: "moderation", "safety", "report", "block", "compliance", "PII", "GDPR", "privacy", "consent", "chat message", "flag", "abuse".

## Prerequisites

1. Read [`CONVENTIONS.md`](../CONVENTIONS.md) — Domain Guardrails  
2. Read PRD privacy / trust & safety + TRD moderation pipeline  
3. Hard gate HG-4 if restricted admins act on moderation

## Steps

### Step 1: Data minimization

1. Collect the minimum fields needed for the feature.  
2. Document why each PII field exists (module README or schema comments).  
3. Optional fields stay optional.  
4. Obtain required consents before collecting sensitive data.

### Step 2: Moderation gate (UGC)

1. User-generated content passes a moderation check before broad visibility when required.  
2. Flagged content is held or limited until review.  
3. Restricted admins propose actions; super admins approve when HG-4 applies.  
4. Reporting: every reportable entity has a report path; reporter identity is not exposed to the reported party.  
5. Blocking: blocked users cannot interact with the blocker.

### Step 3: Audit

Moderation decisions and privileged admin actions are audit-logged.

## Anti-patterns

- ❌ Shipping UGC with no report path  
- ❌ Restricted admin hard-deleting without proposal flow (if HG-4)  
- ❌ Logging secrets / full payment payloads into analytics  

## Done criteria

- [ ] Minimization + consent covered  
- [ ] Report / block paths exist where PRD requires  
- [ ] Audit trail for privileged actions  
- [ ] Tests for hold / approve / reject paths as applicable  
