# ADR-0010: Adaptive Context-Length Handling for LLM Extraction

**Status:** Accepted
**Date:** 2026-07-20
**Decided by:** Oluwatobi Lukan

---

## Context

The company research pipeline scrapes up to 5 web pages per research target (skills, culture, achievements), concatenates the full `document.body.innerText` of each page, and sends the combined text to the LLM in a single call. With verbose pages, the combined prompt can reach 150K+ tokens. When the configured model has a small context window (e.g., 16K for GPT-3.5-turbo), the API rejects the request with a context-length error. The retry logic sends the identical oversized prompt, so both attempts fail.

The project supports models with context windows ranging from 16K to 300K tokens. A fix must preserve maximum information extraction (no blind truncation) while working across all model sizes.

## Decision

**Adaptive: try combined extraction first, fall back to per-page extraction on context-length errors.**

```
_researchTarget:
  1. Build combined prompt from all scraped pages (current behavior)
  2. Try combined LLM call
  3. If success → return result (fast path, 1 LLM call)
  4. If context-length error → per-page fallback:
     a. Extract from each page individually (parallel, 1 call per page)
     b. Merge results programmatically (no extra LLM calls)
  5. If other error → retry then return null (unchanged)
```

### Context-length error detection

Context-length errors are detected by matching `/maximum context length/i` against the error message. This pattern is consistent across OpenAI, OpenRouter, and OpenAI-compatible providers. Context-length errors are **not retried** (the same prompt would fail again) — they are thrown immediately so the fallback can activate.

### Merge logic (programmatic, zero extra LLM calls)

| Research type | Merge strategy |
|---|---|
| Skills | Concatenate all `skills` arrays, deduplicate by lowercase name, keep first-seen category |
| Culture | Pick the result with the most non-null/non-empty fields (culture, tone, values, mission, industry, size) |
| Achievements | Concatenate all `achievements` arrays, deduplicate by normalized headline (first 50 chars, lowercase) |

### Why this approach

| Path | When | LLM calls per type | Information loss |
|---|---|---|---|
| Combined (fast) | Prompt fits in model context | 1 | None |
| Per-page (fallback) | Context-length error | up to 5 (parallel) | None — each page gets full LLM attention |

- **Large models (128K-300K)**: Combined prompt always fits → single call, zero overhead
- **Small models (16K)**: First attempt fails → automatically falls back to per-page extraction
- **No model awareness needed**: The code doesn't need to know the model's context window size — it asks forgiveness, not permission

## Alternatives considered

**Truncation (rejected):** Truncating each scraped page to a fixed character limit (e.g., 8,000 chars) is simpler but loses information. A key detail buried at character 8,001 of a page is silently discarded. The project exists to maximize information extraction — blind truncation contradicts that goal.

**Always per-page extraction (rejected):** Running per-page extraction unconditionally would work for all model sizes but adds 2-4 extra LLM calls per research type for large-model users who currently get single-call performance. The adaptive approach preserves the fast path for users who don't need the fallback.

**Token estimation with tiktoken (rejected):** Adding a token counting library would allow pre-flight checks, but requires a new dependency, accurate tokenizers per model family, and ongoing maintenance as models change. The "try and fall back" pattern achieves the same result with zero new dependencies.

**Chunking/summarization pre-pass (rejected):** A two-pass approach (summarize each page, then extract from summaries) doubles LLM calls in all cases. Per-page extraction achieves the same information preservation with the same call count on the fallback path, and zero extra calls on the fast path.

## Consequences

**Positive:**
- Zero information loss — every scraped page gets full LLM attention regardless of model size
- Fast path unchanged for large-context models — no regression for users with capable models
- No new dependencies, no token counting library, no model context-window lookup tables
- Pattern is reusable for other services that face context-length errors (CV generation, cover letter generation)
- Merge is programmatic — no extra LLM costs on the fallback path

**Negative:**
- Fallback path adds up to 4 extra LLM calls per research target (only when the combined prompt exceeds the model's context)
- Context-length error detection is string-matching on error messages — fragile if providers change their error wording
- Per-page extraction loses cross-page context (e.g., a skill mentioned across multiple pages loses the reinforcement signal)
- The merge heuristics are simple (dedup by name, pick most complete) — a sophisticated merge could use an LLM but would add cost

## Implementation notes

1. **Modified files:**
   - `backend/src/services/research/company-research-service.js` — `_researchTarget` try/catch fallback, `_isContextLengthError`, merge methods, `_llmParseWithRetry` context-error early throw

2. **ADR relationships:** Builds on ADR-0007 (research pipeline architecture) and ADR-0009 (research controls). The adaptive pattern is novel and could be applied to the CV generation and cover letter generation paths if they encounter similar context-length issues.
