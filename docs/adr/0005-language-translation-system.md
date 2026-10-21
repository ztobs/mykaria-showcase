# ADR-0005: Replace Google Translate with LLM-backed i18n

**Status:** Accepted
**Date:** 2026-07-18
**Decided by:** Oluwatobi Lukan

---

## Context

The app loads Google Translate's external widget (`translate.google.com/translate_a/element.js`) on every page. For the two supported languages (EN, DE), the widget:

- Takes **6 seconds** to initialize after page load (250ms polling loop, up to 40 attempts)
- Takes **8 seconds** to translate the page after switching to German
- Does a **full `window.location.reload()`** when switching back to English
- Runs a `MutationObserver` on `document.body` with `subtree: true` to suppress injected banners
- Requires 56 lines of CSS hacks to hide Google's UI elements
- Injects `<font>` tags globally, conflicting with React's virtual DOM

The app only needs EN ↔ DE. The generated CVs and cover letters are rendered in `srcDoc` iframes that Google Translate **cannot reach anyway** — so the core product value is not being translated.

## Decision

Remove Google Translate entirely. Replace it with a three-pipeline architecture:

| Pipeline | What it covers | How it works |
|---|---|---|
| **Static i18n** | Buttons, labels, headings, placeholders, statuses, error messages (~500 strings) | `en.json` / `de.json` via `next-intl`. Instant switch — React context + JSON lookup. |
| **LLM cache (short text)** | Job descriptions, user notes, Q&A answers, nav menu labels, profile summaries | `translations` DB table keyed on `hash(source_text, source_lang, target_lang)`. LLM translates on first read; cached thereafter. |
| **LLM cache (HTML)** | Blog posts, landing page body content | Cheerio extracts text nodes from HTML → LLM batch-translates → reassemble HTML → cache. |

Language preference flows via `?lang=de` on API requests. The user's existing LLM provider handles all translation — zero new API dependencies.

## Alternatives considered

| Option | Speed (cold) | Quality (en↔de) | New infra | Implementation effort |
|---|---|---|---|---|
| **Google Translate widget (status quo)** | 6–14s | Good | None | Already done |
| **DeepL API** | ~187ms | Best in class | New API key + billing | ~1 day |
| **LibreTranslate (self-hosted)** | Depends on hardware | Lower | Docker + GPU | ~2 days |
| **Existing LLM with cache (chosen)** | ~1–2s (instant after cache) | Very good | None | ~2–3 days |

**Why not DeepL?** Faster cold start and better translation quality, but adds a new vendor, new billing, and new API key management surface. The app already has a working multi-provider LLM layer — reusing it costs nothing and ships faster. The cold-start gap closes after the first request (cache hit = 0ms for both).

**Why not LibreTranslate?** Self-hosting a Docker container with GPU for two languages is operational overhead with no benefit over the LLM the user already pays for.

**Why not pre-translate at write time?** Would require `_de` columns on `Application`, `LandingPage`, `BlogPost`, and `NavigationMenu` tables, doubling text storage and firing LLM calls for users who never switch to German. The cache table translates only what's actually requested.

**Why not send full HTML to the LLM?** Simpler code (one API call) but risks the LLM rewriting markup or dropping attributes. Cheerio text-node extraction costs ~40 extra lines of code and guarantees HTML structure is preserved.

**Why `?lang=de` instead of `Accept-Language` header?** Explicit, visible in URLs for debugging, cache-friendly, and trivial to append to existing `fetch()` calls.

## Consequences

**Positive:**
- Language switch becomes instant for all static UI (React re-render, no network)
- Dynamic content is instant on second request onward (cache hit)
- Removes the largest external script dependency, the polling loop, the MutationObserver, and 56 lines of CSS
- No `window.location.reload()` — app state, scroll position, and React tree survive language switch
- No new vendor, API key, or billing relationship
- Blog post and landing page HTML structure is guaranteed preserved (Cheerio extraction)

**Negative:**
- ~500 static strings need extraction into JSON and German translation (LLM-generated, human-reviewed)
- First German page load has 1–2s LLM latency for uncached dynamic content (blog pages: 2–4s for HTML extraction + translation)
- Cache table grows unboundedly with unique content (mitigated: text hashes ensure no duplicates; old entries are dead data with no FK constraints)
- Translation quality depends on the user's LLM model choice (weaker models may produce lower-quality German)
- Adding a third language requires a new JSON file, cache entries, and switcher update — not blocked, but not free

## Implementation notes

1. **DB migration:** `translations` table with `(id, source_text_hash, source_lang, target_lang, translated_text, created_at)`. Composite unique index on `(source_text_hash, source_lang, target_lang)`.

2. **Backend services:**
   - `translation-service.js` — `translate(text, sourceLang, targetLang)` → checks cache → calls LLM → stores → returns
   - `html-translator.js` — `translateHtml(html, sourceLang, targetLang)` → Cheerio parse → extract text nodes → batch `translate()` → reassemble

3. **Backend interceptor:** Middleware or response wrapper that detects `?lang=de`, walks response fields, and translates before `res.json()`.

4. **Frontend:**
   - Add `next-intl`, create `en.json` and `de.json`
   - Replace `GoogleTranslateSwitcher` with a simple language toggle (EN/DE button)
   - Append `?lang=de` to API calls when German is active
   - Convert `getStatusLabel()` to translation key lookups

5. **Cleanup:** Delete `GoogleTranslateSwitcher.tsx`, the Google Translate script from `layout.tsx`, the `google_translate_element` div, and the GT-suppression CSS block in `globals.css` (lines 623–679).
