# ADR-0016: Document Preview Editing Uses Section Markers and contentEditable, Not TipTap

**Status:** Accepted
**Date:** 2026-08-26
**Decided by:** Oluwatobi Lukan

---

## Context

PRO/ENTERPRISE users can edit a generated CV or cover letter before finalizing. Today that means one control: a raw `<textarea>` holding the entire HTML document (`<head>`, `<style>`, structural tags) — confusing for non-technical users. The fix is to default to a visual editor while keeping raw HTML for technical users.

Three things shaped the design. First, the rendered HTML is the single source of truth: `finalize-documents` overwrites the `.html` file with the edited content and regenerates the PDF from it, so the server contract shouldn't change. Second, a CV section is a *semantic* unit (`cvSections`: key/order/enabled), not a contiguous DOM region — templates partition sections across columns, and no section renders twice — so sections can't be reliably recovered by parsing. Third, the repo already ships a TipTap editor (admin `RichTextEditor`), making TipTap the obvious reuse candidate.

## Decision

Keep the full HTML document as the canonical source of truth (the **Canonical Document**), and make editing *per-section*:

- The render layer wraps each section's output in an invisible **Section Marker** (HTML comment) at generation time.
- The client parses the document by markers and edits each section **in place** with the browser's `contentEditable`, preserving the section's existing markup exactly. Save splices the section's HTML back into the canonical document.
- The existing whole-document HTML textarea is retained as the **Raw HTML Edit** path for technical users. Entering section mode re-scans for markers; a section whose marker is missing simply isn't offered in place.
- The finalize step is unchanged: the client still sends the whole `editedHtmlCv` / `editedHtmlCoverLetter`.

Scope is the pre-finalize wizard only; editing already-created applications is deferred (markers persist in the saved `.html`, so that's an additive later step).

## Alternatives considered

**TipTap per-section (reuse the admin editor).** Rejected. TipTap/ProseMirror re-emits normalized HTML against a schema; feeding it the templates' arbitrary `<div class="…">` scaffolding would flatten and de-style it, visibly degrading the CV. Preserving it means fighting ProseMirror's model per-element across ~19 templates.

**Whole-body WYSIWYG.** Rejected. Same normalization problem, applied to the whole document instead of a section — strictly worse for the CV.

**Structured section content as the source of truth, re-render the template on edit.** Rejected for now. Robust and clean, but a large change: it needs structured content persisted per-application and a re-render step, and it abandons arbitrary-layout editing that raw HTML currently allows. Remains the fallback if section editing proves insufficient.

**Sidecar location map instead of markers.** Rejected. Keeps the HTML pristine but adds a second artifact to keep in sync with the document.

## Consequences

- **Render-layer change**: templates/helpers must emit **Section Markers**; a change to the generation output.
- **`contentEditable`/`execCommand` are deprecated** (though functional and widely supported). Deliberate trade: markup fidelity across templates outweighs framework modernity. This is the surprising bit a future reader should not "fix" by swapping in TipTap.
- **Server unchanged**: `finalize-documents` still receives whole-HTML documents; markers ride along invisibly in the saved file.
- **Two editing surfaces** to maintain (section editor + raw HTML textarea), plus a re-parse rule on mode entry.
- **Deferred**: editing an existing application's documents, and any per-section source toggle (the raw HTML edit is the escape hatch for now).
