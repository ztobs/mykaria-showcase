# ADR-0019: Live Tier Pricing via Portal Mounts in Seeded Landing-Page HTML

**Status:** Accepted
**Date:** 2026-08-28
**Decided by:** Oluwatobi Lukan

---

## Context

The homepage pricing section and `/pricing` page are seeded landing-page HTML stored in the `LandingPage` table and editable in the admin. Their prices, feature lists, and tier names were hardcoded markup — every admin edit in "Tier Limits & Pricing" (a price change, a new feature flag like ADR-0018's `documentEditing`, a disabled tier) silently drifted from what the marketing pages showed, and the FAQ answers hardcoded numbers too.

## Decision

Render pricing client-side from the **public** `GET /api/tier-limits` endpoint, portaled into mount divs embedded in the seeded landing-page HTML — the same pattern `CvTemplateGallery` already uses for `cv-gallery-mount`.

- **Pricing Mounts**: the seed HTML contains `<div id="pricing-home-mount">`, `pricing-cards-mount`, and `pricing-table-mount`. The mount ID selects the `PricingSection` variant: compact 3-card homepage cards, full card grid, or the comparison table. Any landing page containing a mount gets live values with no code change.
- **Static Fallback**: static pricing markup stays *inside* each mount. Crawlers, no-JS browsers, and failed fetches see it; only a successful fetch replaces it. It is a resilience layer, not a display source — drift between fallback and database is accepted by design.
- **Data mapping**: the comparison table covers all 10 admin feature flags; cover-letter signature derives from `customTemplates`. Disabled tiers are hidden entirely; the homepage shows the first three non-disabled tiers in price order. Feature lines with no admin flag ("AI enhancement", …) are Marketing Bullets — always static ✓.
- **FAQ**: pricing FAQ answers were reworded to drop hardcoded numbers; copy lives in a `pricing` i18n namespace (en/de).

## Alternatives considered

**Regenerate/re-seed landing pages on every tier-limit save.** Rejected. Couples the admin write path to landing-page content, risks clobbering admin edits to the surrounding HTML, and breaks the moment a page diverges from the seed.

**Server-render tier data into the landing HTML at request time.** Rejected. Landing pages are served as stored HTML; injecting values server-side would require a templating pass over admin-editable content (escaping and XSS surface) for a page that already ships a React runtime for the gallery mount.

**Keep static markup, document a manual sync process.** Rejected. It was the status quo that produced the drift; process discipline doesn't scale against an admin UI that invites edits.

## Consequences

- **Admin tier edits propagate automatically** to every mounted pricing surface — prices, flags, disabled tiers, and upgrade copy stay consistent.
- **Rollout**: fresh installs get mounts via the seed; existing deployments delete the home/pricing landing pages in admin and re-seed.
- **The static fallback must be maintained loosely** as tier structure changes — accepted drift, since it only shows when the fetch never completes.
- Domain language (Pricing Mount, Static Fallback, Disabled Tier, Marketing Bullet) is defined in `CONTEXT.md` → Public Pricing Display.
