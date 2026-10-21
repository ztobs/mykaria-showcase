# ADR-0015: Signature Image Is Account-Level, Placement Is Per-Profile

**Status:** Accepted
**Date:** 2026-08-25
**Decided by:** Oluwatobi Lukan

---

## Context

The cover letter **Signature** has two separable pieces: the **Signature Image** (the applicant's handwriting — invariant across roles) and the **Signature Placement** (where it sits relative to the name — arguably per-role). The footer's `fullName` comes from `JobProfile`, which already carries a `photo` field with a full upload pipeline, so the obvious move is to put both signature pieces on `JobProfile`.

## Decision

Split the storage. The **Signature Image** is account-level: one uploaded image stored as a `Media` row, shared by every `JobProfile`. The **Signature Placement** is per-`JobProfile`: a nullable `signaturePlacement` field (`NONE`/`ABOVE`/`BELOW`/`null`), where `null` means "inherit the tier's default placement."

## Alternatives considered

**Both on `JobProfile` (mirror `photo`).** Rejected. The image is the same for every role — a user with five profiles would upload the identical signature five times and edit it in five places. It also forces image-consistency work (dedupe) that account-level storage gets for free.

**Both account-level.** Rejected. Placement is genuinely per-role in a way the image is not — a user may sign one role's letters and not another, or use a different placement per profile. Collapsing placement to account-level would remove that control.

## Consequences

- **Two UIs**: the image is uploaded on the Account page; placement is set on the `JobProfile` editor — matching the two storage scopes.
- **GDPR and deletion for free**: because the image is a `Media` row, the existing Data Export (`media/` folder) and account-deletion cascade cover it without bespoke wiring.
- **Effective placement is resolved, not stored**: `disallowed tier → NONE`; otherwise `profile.placement ?? tier default`. The image alone never turns a signature on (ADR-0014 defines the reset semantics for the placement half).
