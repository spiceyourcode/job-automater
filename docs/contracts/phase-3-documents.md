## Contract — Phase 3 Document Generation

### GOAL
User generates tailored CV + cover letter for a job, reviews side-by-side, application stays in draft until user acts.

### CONSTRAINTS
- GenerateDocs LangGraph in workers/agents/generate_docs/
- Every generated bullet must trace to cv_chunks (HG-9)
- Application status = draft after generation

### FORMAT
- workers/agents/generate_docs/
- web job detail → Generate → Review screen (AppFlow §2.3)
- PDF stored in MinIO; URLs on applications row

### FAILURE
- Hallucinated employers, skills, or dates not in user CV
- Apply button enabled before user reviews documents
- CV/CL body logged at info level (HG-8)
