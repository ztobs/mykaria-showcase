# ADR-0018: Generated-Document Editing Is a Per-Tier Feature Flag

**Status:** Accepted
**Date:** 2026-08-28
**Decided by:** Oluwatobi Lukan

---

## Context

ADR-0016 introduced in-place section editing and raw-HTML editing of generated CVs and cover letters. Access to it was hardcoded in `POST /api/job/generate-documents` as `['BASIC', 'PRO', 'ENTERPRISE'].includes(tier)` — the only tier-gated feature in the product not controllable from the admin "Tier Limits & Pricing" tab (custom templates, provider switching, multiple job profiles, company research all are; see ADR-0017). An admin couldn't grant or revoke editing per tier, and the upgrade copy couldn't name which tiers offer it.

## Decision

Model generated-document editing as a boolean feature flag — `TierLimit.documentEditing`, default `true` on **all** tiers — in the same shape as the sibling feature booleans, and expose it in the admin "Tier Limits & Pricing" tab.

- **Enforcement**: server-side, in `POST /api/job/finalize-documents`. If the request carries `editedHtmlCv` or `editedHtmlCoverLetter` and the user's tier lacks the flag, respond 403 with a message naming the tiers that allow editing (`formatTierList` helper).
- **Discovery**: `POST /api/job/generate-documents` returns `canEditPreview` plus the full `documentEditingTiers` list in its response, so the frontend renders a dynamic upgrade notice without a second request.
- **Frontend**: `DocumentPreview` hides the section-edit / HTML-edit affordances when `canEditPreview` is false and shows the tier-aware notice instead.

## Alternatives considered

**Dedicated access endpoint (`GET /api/job-profiles/access`-style, per ADR-0017).** Rejected. `generate-documents` already computes the user's tier for the response; adding `documentEditingTiers` to that payload gives the notice everything it needs in the call it already makes, with no extra round-trip. The company-research / job-profile access-endpoint pattern exists for features checked *before* generation, not after.

**Client-side-only gating.** Rejected. The edited HTML flows through `finalize-documents`; hiding the UI button without the server-side 403 would let a crafted request bypass the gate.

**Keep hardcoded tier list.** Rejected — same coupling ADR-0017 removed for job profiles.

## Consequences

- **Behavior change, deliberate**: the old hardcoded list excluded FREE; the new default enables editing on all tiers. Admins narrow it from the tier-limits tab.
- **A schema migration** adds `documentEditing BOOLEAN NOT NULL DEFAULT true`.
- **Upgrade messaging stays accurate**: the 403 and the preview notice name the enabled tiers and update automatically when an admin toggles the flag.
- The pricing comparison table (ADR-0019) derives its "Document Editing" row from this flag.
