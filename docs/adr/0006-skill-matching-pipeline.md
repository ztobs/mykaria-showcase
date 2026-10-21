# ADR-0006: LLM-Driven Skill Matching with Deterministic Tiering

**Status:** Accepted
**Date:** 2026-04-30
**Decided by:** Oluwatobi Lukan

---

## Context

The app generates tailored CVs and cover letters by combining a user's profile skills with the skills extracted from a job description. Before this decision, the LLM was given both lists and told to write — with no structured matching, no ranking, and no tiered instructions. This caused several problems:

- **Exaggerated proficiency**: beginner skills were written as strengths ("strong JavaScript", "expert in Python")
- **Irrelevant skills leaking in**: a PHP developer applying to a Java role would see PHP in the skills section
- **No gap handling**: missing skills were either ignored or the LLM fabricated experience
- **Inconsistent between documents**: the CV and cover letter would highlight different skills because there was no shared ranking
- **Excessive skill lists**: every user skill appeared, cluttering the document with tangentially relevant items

The LLM was being asked to do two things at once — *decide* what skills matter AND *write* about them — and it was bad at the first when buried inside the second.

## Decision

Split skill selection (what to write about) from skill presentation (how to write about it). Use a two-phase pipeline:

### Phase 1: AI Matching (LLM — semantic)

A dedicated, focused LLM call compares user skills against JD skills and requirements. The LLM classifies each user skill into one of four buckets:

| Bucket | Meaning |
|---|---|
| **matched** | Direct or transferable relevance, annotated with `matchStrength`: `exact`, `strong`, `moderate`, or `weak` |
| **unmatchedJobTerms** | Job requirements no candidate skill covers |
| **irrelevantUserSkills** | Skills with zero relevance — aggressively filtered; *"when in doubt, put it here"* |
| **complementarySkills** | Skills not directly matched but filling an obvious domain gap (max 4; e.g., PostgreSQL for a Full Stack role where only React + Node matched) |

This call is made **once** and the result is reused for both the CV and cover letter, avoiding a redundant second LLM call.

### Phase 2: Deterministic Tiering (code — no LLM)

Each skill receives a **composite tier** by combining `matchStrength` (from the LLM) with the user's proficiency `level` (from their profile). The decision matrix is hardcoded:

```
                   expert/proficient | advanced | intermediate | beginner/basic
exact / strong     → FEATURE         | FEATURE  | MENTION      | GROWTH
moderate           → FEATURE         | MENTION  | MENTION      | GROWTH
weak               → MENTION         | MENTION  | GROWTH       | OMIT
complementary      → —               | MENTION  | GROWTH       | GROWTH
```

| Tier | CV instruction | Cover letter instruction |
|---|---|---|
| **FEATURE** | Include in skills section prominently; match language intensity to skill level | Reference prominently; match language intensity to skill level |
| **MENTION** | Include with measured, honest language | Reference with measured language |
| **GROWTH** | Frame as developing / intent to grow; never present as current strength | Frame only as developing or intent to grow; never as current strength |
| **OMIT** | Do not mention | Do not mention |

These tier instructions are injected into the generation prompt's **HARD CONSTRAINTS** section, which also enforces a **skill gate** (only ranked skills may appear; experience descriptions are context only) and **skill honesty rules** (beginner skills must never be called "strong", "expert", "proficient", or "experienced in").

### "Always include" skills

User skills flagged `alwaysInclude: true` bypass the LLM entirely. Their tier is computed deterministically from proficiency level alone (expert/proficient/advanced → feature, intermediate → mention, beginner → growth), and they are reinjected into the matched list after LLM processing.

### Skill gap bridging

When `unmatchedJobTerms` is non-empty, a dedicated prompt section instructs the LLM to: identify transferable overlaps from the candidate's real experience, frame missing skills as growth areas without claiming them, find a complementary-perspective narrative angle, never fabricate, and never over-apologize ("although I lack X").

### Graceful degradation

If the LLM matching call fails, generation proceeds with only always-include skills as matched and all job terms as unmatched. The CV and cover letter are still generated — just without the benefit of structured matching.

## Alternatives considered

| Option | Accuracy | LLM cost | Predictability |
|---|---|---|---|
| **Single LLM call (write + decide)** | Low — exaggeration, irrelevant skills | 1 call per document | None — different per run |
| **Deterministic keyword matching only** | Very low — no synonym handling, no conceptual equivalence | Zero | Complete |
| **LLM matching + LLM tiering** | High | 1 call for matching, tiering embedded in prompt | Low — tiers vary per run |
| **LLM matching + deterministic tiering (chosen)** | High | 1 call shared across both documents | Complete — tiers are testable |

**Why not deterministic-only matching?** A keyword match of "pandas" against a JD asking for "data analysis experience" returns zero. The LLM understands conceptual equivalence, abbreviations, and version variants ("k8s" → "Kubernetes", "React" → "React.js"). Deterministic matching can't handle these without maintaining an ever-growing synonym dictionary.

**Why not have the LLM also decide tiers?** The generation LLM already has creativity budget — asking it to also decide *how strongly* to write about each skill was the root cause of the exaggeration problem. Moving tiering into hardcoded logic makes it auditable, testable (97.77% branch coverage on SkillMatcher), and consistent across runs.

**Why not separate matching calls for CV and cover letter?** The skills relevant to a job don't change between documents. One call, reused, cuts cost in half and guarantees the two documents agree on what matters.

## Consequences

**Positive:**
- Beginner skills are never presented as strengths — the skill honesty constraint is mechanical, not advisory
- Irrelevant skills are excluded at the matching layer, not left to the generation LLM's judgment
- CV and cover letter highlight the same skills with the same intensity, because they share one match result and one tier computation
- Skill gap bridging is explicit and honest — transferable value is surfaced without fabrication
- The tier matrix is auditable and testable — changing "intermediate + exact" from FEATURE to MENTION is a one-line code change, not a prompt engineering exercise
- Matching degrades gracefully — if the LLM call fails, generation still produces a document

**Negative:**
- Adds one LLM call (~1–2s latency) to CV generation; mitigated by the fact it was already an LLM call, just unfocused
- The tier matrix is a simplification — there are edge cases where a "moderate + advanced" skill genuinely deserves FEATURE treatment, but the matrix hardcodes it to MENTION
- Complementary skills (LLM-identified domain-gap fillers) are capped at 4, which may miss genuine multi-domain gaps in interdisciplinary roles
- The matching LLM prompt must balance conservatism ("when in doubt, mark irrelevant") against missing genuine but non-obvious matches — the current prompt errs toward conservatism
- If the matching LLM uses a weak model, poor matchStrength assignments cascade into incorrect tiers; there is no tier-correction feedback loop

## Implementation notes

1. **Files:**
   - `backend/src/services/content/skill-matcher.js` — `matchSkillsToJob()` (LLM match call) and `compositeSkillTier()` (deterministic tier matrix)
   - `backend/src/services/prompts/prompt-builder.js` — `buildCVPrompt()` and `buildCoverLetterPrompt()` inject tiered instructions and hard constraints
   - `backend/src/services/content/generation-service.js` — orchestrates the pipeline, carries `_skillMatch` on the CV result for cover letter reuse

2. **Reuse mechanism:** `_generateCVWithLLM()` computes `skillMatch` and attaches it as `cleanedCV._skillMatch`. `generateCoverLetterContent()` accepts `skillMatch` as an optional parameter — if present, the matching call is skipped.

3. **Tests:** `SkillMatcher` has 97.77% branch coverage. The tier matrix is tested independently of the LLM matching prompt.

4. **Evolution path:** The tier matrix constants (`STRENGTH_RANK`, `LEVEL_RANK`, tier lookup) are co-located and explicit. Adding a new tier or adjusting a boundary is a code change, not a prompt change.
