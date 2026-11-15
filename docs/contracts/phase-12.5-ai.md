## Contract — Phase 12.5 AI infrastructure

**Phase:** 12.5  
**Status:** ✅ implemented (2026-08-17)  
**Services:** `workers/` (primary), `docs/`  
**After:** Phase 12 launch ✅  
**Before:** Phase 13 post-MVP

### GOAL
Close the gap between TRD/Impl Plan AI agents and shipped **heuristic** graphs. Keys `OPENAI_API_KEY`, `QROK_API_KEY`, `GOOGLE_API_KEY`, `CEREBRAS_API_KEY` must drive a single router. Heuristic extract/match/docs/email remain the fallback when a provider fails or is unset.

### CONSTRAINTS
- **No Anthropic.** User stack is OpenAI + Groq (`QROK_API_KEY` / `GROQ_API_KEY`) + Google Gemini + Cerebras.
- **No n8n** (HG-10). Celery + LangGraph only.
- **HG-9:** GenerateDocs still requires `assert_grounded_in_chunks`. LLM drafts that fail grounding → heuristic docs.
- **HG-8:** Log provider, model, token counts — never CV/email bodies or prompts that contain them. Google auth via `x-goog-api-key` header (not query string).
- **Embedding dim:** **1536** (existing `cv_chunks.embedding vector(1536)`). Do not migrate to TRD’s 3072 in this phase.
- Structured output: JSON + Pydantic. Invalid JSON → fallback.

### FORMAT

| ID | Deliverable |
|----|-------------|
| P12.5.1 | `workers/lib/llm.py` — chat JSON router, purpose-based provider order, tests |
| P12.5.2 | `workers/lib/embeddings.py` — 1536-d vectors on reindex; cosine search with ILIKE fallback |
| P12.5.3 | ExtractNormalize `use_llm=True` when a chat key exists; GenerateDocs LLM draft + grounding gate |
| P12.5.4 | MatchScore LLM reasoning (scores stay heuristic); email classifier LLM + threshold gate |

### Provider map

| Purpose | Prefer | Then |
|---------|--------|------|
| extract | OpenAI `gpt-4o-mini` | Groq `openai/gpt-oss-20b`, Google, Cerebras |
| docs | OpenAI `gpt-4o-mini` | Google `gemini-2.5-flash`, Groq |
| classify / match prose | Cerebras `gpt-oss-120b` | Google `gemini-2.5-flash`, OpenAI, Groq |
| embed | OpenAI `text-embedding-3-small` (1536) | Google `gemini-embedding-001` with `outputDimensionality=1536` |

Refs: [Groq overview](https://console.groq.com/docs/overview), [Cerebras models](https://inference-docs.cerebras.ai/models), [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash), [Cerebras Node SDK](https://github.com/Cerebras/cerebras-cloud-sdk-node).

### FAILURE
- Router requires a specific vendor when others are configured
- `use_llm=True` with no fallback when OpenAI is empty
- Embeddings written at the wrong dimension
- GenerateDocs persists ungrounded LLM text
- Match/email LLM logs subject/body/CV text
