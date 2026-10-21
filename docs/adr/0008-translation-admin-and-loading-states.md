# ADR-0008: Translation Admin Panel and Global Loading States

**Status:** Accepted
**Date:** 2026-07-18
**Decided by:** Oluwatobi Lukan
**Supersedes:** Partially extends [ADR-0005](./0005-language-translation-system.md)

---

## Context

[ADR-0005](./0005-language-translation-system.md) introduced an LLM-backed translation cache (`translations` table) keyed on `(source_text_hash, source_lang, target_lang)`. Translations are generated on first read and cached thereafter. However:

- There is **no way for an admin to correct a mistranslation** without manually editing the database.
- Blog translators render per-component "Translating..." spinners, but the main app pages (dashboard, application list) show **no loading indicator** while dynamic content is being translated after a language switch.
- The `de.json` static translation file has **gaps** — keys present in `en.json` are missing or remain in English.
- The `translations` table stores only `source_text_hash`, not the source text itself, making it **impossible to search by original content** or display it in a review UI.

## Decision

### 1. Admin Translation Management Tab

A new admin tab (`translations`, placed after `landing-pages` and before `blogs`) with:

- **Server-side paginated table** listing all cached translations. Columns: source text (truncated), translated text (truncated), source language, target language, last updated, actions.
- **Search** across both source text and translated text, using Prisma `contains` with case-insensitive mode (`ILIKE`). Full-text search (`tsvector`) deferred until scale demands it.
- **Filters** by `sourceLang` and `targetLang` (dropdowns from `SELECT DISTINCT`), defaulting to `sourceLang=en`.
- **Edit modal** showing source text (read-only) and translated text (editable) side by side. Buttons: Save, Save & Next, Cancel.
- **Single-row delete** with a toast confirmation. Deletion removes the cache row; the LLM refetches on the next `?lang=` request for that content.
- **No bulk operations** — single-row edit and delete are sufficient for correction workflows.

### 2. Schema Changes

Two new columns on the `translations` table:

| Column | Type | Purpose |
|---|---|---|
| `source_text` | `TEXT` nullable | Stores the original text so admins can see what was translated. Existing rows get `NULL`. |
| `updated_at` | `TIMESTAMP` via `@updatedAt` | Tracks when an admin last edited the translation. Rows where `updated_at > created_at` are human-corrected. |

No `reviewed` boolean or `edited_by` FK — the existing cache semantics handle this: if a translation exists, the LLM does not overwrite it. Deletion is the explicit "refetch" action.

### 3. Global Translation Loading State

A counter-based mechanism signaling "dynamic content translation is in progress":

- A **module-level event bus** (plain JS) bridges between the Axios interceptor (non-React) and `LocaleProvider` (React).
- The **Axios request interceptor** (`client.ts`), which already appends `?lang=de` to API calls, increments the counter on request start and decrements on response/error. Only for requests where the `lang` param is not `en`.
- `LocaleProvider` **subscribes** to the event bus and exposes `isTranslating` (boolean: counter > 0) via context.
- The **`LanguageSwitcher` button** reads `isTranslating` and shows a **border pulse/glow CSS animation** while translating. The animation is subtle — no layout shift, no icon.
- The pulse shows for **both** initial page load and explicit language switches — the interceptor does not distinguish, and both cases mean content is still arriving.

### 4. Remove Per-Component Spinners

The `translating` spinners in `BlogPostTranslator`, `BlogPostsTranslator`, and `BlogListTranslator` are removed. The global button pulse replaces them. The blog translators still fire their `?lang=` fetch; they just no longer render their own loading UI. Their local `translating` state is either removed or converted to call the shared counter.

### 5. Static Translation Gap Fill

`en.json` and `de.json` are compared structurally. Every key in `en.json` missing from `de.json` (either entire namespace or individual key) is translated into German, matching the existing style: formal address (`Sie`), professional tone, domain-appropriate terminology. Only German is filled — the system currently supports two languages.

## Alternatives considered

| Option | Trade-off |
|---|---|
| **`reviewed` boolean vs. rely on cache semantics** | A boolean would let admins "un-approve" a translation to trigger refetch without deleting. But deletion already serves this purpose and the cache already skips existing rows. Adding a boolean adds UI complexity with no new capability. |
| **`tsvector` full-text search vs. `ILIKE`** | Full-text search is faster at scale and handles stemming, but requires a generated column, index, and ongoing maintenance. The admin table is low-concurrency; `ILIKE` with pagination is adequate. Upgrade path remains open. |
| **Keep per-component spinners vs. global pulse** | Per-component spinners give granular feedback but create visual noise (multiple spinners on one page). The global pulse is one clean signal. Blog posts already have the pulse from the interceptor; keeping both would be redundant. |
| **Intercept at Axios level vs. manual per component** | Manual per component requires touching every data-fetching component and risks gaps. The interceptor already knows which requests carry `?lang=de` — it's the single choke point. |
| **Pulse only on switch vs. also on initial load** | Restricting to switch-only would require the interceptor to track whether the locale was just changed, adding state. From the user's perspective, content being translated on first load and after a switch is the same experience — the pulse is truthful either way. |

## Consequences

**Positive:**
- Admins can correct LLM translation mistakes without database access.
- The cache becomes self-healing: delete a bad translation, and the next request regenerates it.
- Users see one consistent loading signal (the button pulse) instead of scattered spinners or silent loading.
- The translation audit trail (`updated_at`) makes it easy to identify human-corrected rows.
- Static translation completeness improves — German-speaking users see fewer English strings.

**Negative:**
- The `source_text` column doubles per-row storage for translations (source + translated). Mitigated: text is already stored in the source system; this is a cache duplicate for admin visibility.
- The global pulse is less granular than per-component spinners — a user on a blog page won't know if the loading is for the blog body or the nav menu. Mitigated: both finish quickly, and the single signal is less distracting.
- `ILIKE` search degrades on very large tables. Mitigated: upgrade path to `tsvector` is documented and straightforward.
