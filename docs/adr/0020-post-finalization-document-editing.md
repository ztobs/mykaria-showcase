# ADR-0020: Post-Finalization Document Editing

**Status:** Accepted
**Date:** 2026-08-30
**Decided by:** Oluwatobi Lukan

---

## Context

ADR-0016/0018 brought section and raw-HTML editing to the creation wizard, where staged edits are applied at "Confirm & Finalize". After finalization there was no way to edit: the application detail modal lacked the card's actions (regenerate, Ask AI, copy) and had no preview. Users had to regenerate — discarding all prior edits — to change anything.

## Decision

Give the detail modal full card-action parity (shared hook; card untouched) and add CV/cover-letter preview buttons opening a large popup with the same editing experience as the creation preview.

- The popup loads the **Document Source** (stored HTML; see CONTEXT.md) from a new `GET /applications/:id/documents`, which also returns `canEdit` + `documentEditingTiers` so the dynamic tier flag (ADR-0018) gates editing identically. Documents without stored HTML (pre-HTML-storage applications) render a disabled button with a regenerate hint.
- Edits stage locally as in the wizard. **"Done"** applies them in one shot — persist Document Source, regenerate the PDF once — and closes; it reads correctly whether or not anything changed. The close path guards against discarding staged edits.
- Post-finalization saves do **not** consume `GENERATE_FILE` allowance, but are logged as `EDIT_DOCUMENT`; the save endpoint enforces the tier flag server-side like `finalize-documents`.
- Starting a regeneration **force-closes the popup** (staged edits discarded — a Regeneration Reset) and **reopens it with the new Document Source** when generation completes, with a "Document regenerated" toast.

## Alternatives considered

**Apply per section save.** Rejected: each save would block on a Puppeteer PDF render, making iterative editing sluggish and producing one PDF per keystroke-level change.

**Persist HTML per save, defer the PDF.** Rejected: breaks the invariant that stored HTML and stored PDF always match; a mid-session download would silently serve a stale PDF.

**Lock regenerate while the popup is open.** Rejected: hides the reason the button is dead; force-close + auto-reopen honestly reflects what regeneration means.

**Bill modal saves as GENERATE_FILE.** Rejected: editing is not generation; usage is still audited via `EDIT_DOCUMENT`.

## Consequences

- The HTML/PDF match invariant holds across creation, editing, and regeneration.
- A shared application-actions hook serves both card and modal; diverging behavior between them becomes a deliberate act.
- The stale "PRO plan or above" copy is replaced by tier-flag-driven messaging.
- Regeneration Reset is per document: regenerating the CV never discards cover-letter edits.
