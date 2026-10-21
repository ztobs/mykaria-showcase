# ADR-0014: Signature Tier-Disable Uses a Destructive Hard Reset

**Status:** Accepted
**Date:** 2026-08-25
**Decided by:** Oluwatobi Lukan

---

## Context

The cover letter **Signature** feature is gated per tier: `TierLimit.signature` (may the tier use a signature at all) plus `TierLimit.signatureDefault` (the default placement). Each `JobProfile` stores its own `signaturePlacement` (`NONE` / `ABOVE` / `BELOW`, or `null` = "inherit the tier default").

When an admin disables the feature for a tier, the requirement is that users' existing choices "return to no signature." That phrase has two readings: **suppress** the choice while disabled (soft), or **destroy** it (hard). The rest of the codebase defaults to the non-destructive reading — **Soft-Lock** and **Locked Flag** are computed at read time, the **Provider Resolution Queue** silently skips missing providers, and company research (`company_research_tiers`) gates only *new* usage while preserving existing data.

This ADR deliberately chooses the destructive path, diverging from that default.

## Decision

When a tier is flipped from enabled to disabled, the admin save action performs a **Signature Hard Reset**: every `JobProfile` owned by a user on that tier and holding an explicit `ABOVE` or `BELOW` placement is rewritten to `NONE`. Profiles still at `null` (inheriting the tier default) are left untouched.

Re-enabling the tier later does **not** restore prior choices — those users are back to `NONE` and must re-choose.

## Alternatives considered

**Soft override (preserve stored placement, resolve to `NONE` while disabled).** Rejected. It is the codebase's usual pattern, but it means a user's choice silently resurrects when the tier is re-enabled — contradicting "returns to no signature" as a durable reset, and leaving admins unable to guarantee a clean slate without auditing individual rows.

**Wipe everything, including `null` profiles.** Rejected. A `null` profile holds no user override to wipe — forcing it to `NONE` would destroy its "inherit tier default" semantics, so a user who never chose anything would be locked to "off" even after a re-enable with a non-`NONE` tier default.

## Consequences

- **Destructive and irreversible**: user intent (`ABOVE`/`BELOW`) is permanently lost on disable. There is no undo short of a backup restore.
- **Bulk write on admin save**: toggling a tier off now runs an update over every affected `JobProfile`, not just a config write.
- **Uploaded image is preserved**: the account-level signature `Media` row (ADR-0015) is not deleted — only placement is reset.
- **Re-enable is a cold start**: users previously on the tier must set their placement again, or inherit the tier default via a fresh `null`.
