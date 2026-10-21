# 0013. Bullet Selection Before CV Generation

## Status

Accepted

## Context

CV generation receives every bullet from a user's experience entries and is prompt-forbidden from dropping any (the PRESERVATION RULE mandates each output bullet be at least as detailed as its input). For users whose experience is largely irrelevant to the target role — career changers especially — the result is a CV full of beautifully tailored but irrelevant bullets. Skills could already be omitted by the tier system, but experience bullets had no equivalent: the system could decide *what to claim*, not *what evidence to present*.

## Decision

Add a dedicated LLM **Bullet Selection** step to the CV pipeline, running after skill-matching and before prompt building:

- The selector judges each bullet against the job description plus Company Skills (when research data exists). It deliberately does **not** see the user's skill list: bullets are *evidence*, skills are *claims*, and a user may keep their skill list minimal intending experience to speak for it. Matching evidence against claims would penalize exactly those users.
- Input bullets are tagged with IDs (`{profileId}.{index}`, extending the Profile ID pattern); the selector returns a ranked list of IDs, never bullet text — it can choose, never rewrite.
- Per experience entry, selection is bounded to **[1, 6]** bullets. If none are relevant, the top-ranked bullet is force-kept (the Survival Floor) and rewritten under the existing honesty constraints — selection never invents content.
- **Fail-open**: on selector error/timeout/unparseable output, log and generate with all bullets (pre-selection behavior).
- Selection is invisible to usage counters (usage is logged per route action, like skill-matching), available on all tiers, re-runs on every regeneration (no snapshot), applies to CVs only (not cover letters), and is silent in the UI.

## Alternatives considered

- **Selection inside the generation prompt** — no extra LLM call, but the PRESERVATION RULE and selection rule fight in one prompt, and there is no way to verify what was dropped or enforce the floor. Rejected for unverifiability.
- **Deterministic (keyword/embedding) scoring** — free and testable, but ADR-0006 already settled that keyword matching misses synonyms and transferable experience; it would wrongly cut exactly the bullets gap-bridging exists to surface. Rejected for inconsistency with the skill-matching precedent.
- **Fail-closed** (abort generation on selector failure) — makes an enhancement a hard dependency; a paid feature's flakiness would break the core flow. Rejected.
- **Snapshot selection per application** (like Research Snapshot) — research snapshots preserve *external world state*; selection is a pure function of profile × JD, both re-read fresh on regeneration. Caching would memoize a cheap computation at the cost of staleness after profile edits. Rejected.

## Consequences

- **Easier**: career-transition CVs present only relevant evidence; the generation prompt stays single-purpose; selection is independently testable; support can inspect logged selections.
- **Harder**: one extra LLM call per CV generation (mitigated: cheap/fast model — ranking, not writing); the PRESERVATION RULE wording must be scoped to "bullets you are given"; cover letters still see unfiltered experience, so a CL may reference experience the CV dropped (accepted, revisitable).
