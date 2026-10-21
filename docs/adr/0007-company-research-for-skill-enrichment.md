# ADR-0007: Company Research Pipeline for Skill Enrichment and Culture-Aware Generation

**Status:** Accepted (partially superseded — see note)
**Date:** 2026-07-18
**Decided by:** Oluwatobi Lukan

> **Note (2026-07-19):** The "never cache achievements" decision (§ "Why not cache achievements?") was **superseded by ADR-0009**. Achievements are now cached in a `company_achievements` table with a 30-day freshness window, matching skills. The rest of this ADR remains in effect.

---

## Context

Companies increasingly omit skills from job descriptions because candidates tailor their CVs to match every listed keyword. The app extracts JD skills (ADR-0006), but when the JD is sparse or deliberately vague, the skill matching pipeline has little to work with. Meanwhile, the app already scrapes the web for JD extraction — adding a company research step would surface the technologies, culture, and recent achievements the JD doesn't state.

The research data should be shared across users: if two users apply to Acme Corp, only the first triggers the research. The second hits a cache. Culture and skills have different staleness profiles and must be cached separately.

## Decision

Add a **company research pipeline** that fires after JD extraction and before CV generation, using Serper.dev as the search API and the existing Puppeteer + LLM stack for scraping and parsing.

### Architecture

Two new services in `backend/src/services/research/`:

| Service | Responsibility |
|---|---|
| `SerperService` | Thin wrapper around Serper.dev API. `search(query)` → `{ url, title, snippet }[]`. Keyed via `SERPER_API_KEY` env var. |
| `CompanyResearchService` | Orchestrator: normalize company name → check caches → construct search queries → Serper → Puppeteer scrape → LLM parse → store → return. |

### Research targets and caching strategy

Three parallel searches, each with its own caching policy:

| Target | Search query template | Scrape depth | Cache | Staleness | Refresh behavior |
|---|---|---|---|---|---|
| **Skills/stack** | `"{company} {jobTitle} tools platforms software"` | Top 3-5 results, domain-filtered | `company_skills` table (one row per skill) | 30 days | Serve stale, refresh in background |
| **Culture/tone** | `"{company} company culture values work environment"` | Top 3-5 results, domain-filtered | `company_profiles` table (one row per company) | 90 days | Serve stale, refresh in background |
| **Achievements** | `"{company} news funding growth 2025 2026"` | Top 3-5 results, domain-filtered | **None** (always fresh) | N/A | N/A |

The search queries are dynamic — the `jobTitle` field drives domain disambiguation (e.g., "Software Engineer" pulls engineering results, "Marketing Manager" pulls martech). No hardcoded domain terms.

### Database schema

```prisma
model CompanyProfile {
  id          Int      @id @default(autoincrement())
  companyName String   @unique @map("company_name")  // normalized form
  culture     String?                                // "flat hierarchy, async-first"
  tone        String?                                // "casual, direct, data-driven"
  values      String?                                // "transparency, customer obsession"
  mission     String?                                // from about/careers page
  industry    String?                                // "Fintech", "SaaS"
  size        String?                                // "50-200"
  rawSource   String?  @map("raw_source")            // raw text for debugging
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  @@map("company_profiles")
}

model CompanySkill {
  id          Int      @id @default(autoincrement())
  companyName String   @map("company_name")          // normalized form
  skillName   String   @map("skill_name")            // "PostgreSQL", "Kubernetes"
  category    String?                                // "database", "infrastructure"
  source      String?                                // URL where found
  createdAt   DateTime @default(now()) @map("created_at")
  @@unique([companyName, skillName])
  @@index([companyName])
  @@map("company_skills")
}
```

`Application` gains one field: `isResearchComplete Boolean @default(false)`.

Company names are normalized before cache lookup: lowercase, strip legal suffixes (Inc, Ltd, GmbH, Corp, LLC, etc.), collapse punctuation to hyphens. The raw name from the JD stays on `Application.company` unchanged.

### Parsing: three focused LLM prompts

Each scraped page batch is parsed by the user's configured LLM into a tight JSON schema:

**Skills:** `{ "skills": [{ "name": "...", "category": "database|framework|language|infrastructure|platform|tool|crm|analytics|design|other" }] }`

**Culture:** `{ "culture": "...", "tone": "...", "values": ["..."], "mission": "...", "industry": "...", "size": "..." }`

**Achievements:** `{ "achievements": [{ "headline": "...", "date": "...", "relevance": "..." }] }`

### Integration with the existing skill matching pipeline

Company skills flow into ADR-0006's matching pipeline **before** the `SkillMatcher`:

```
Before:  JD skills + user skills → SkillMatcher → tiers → prompts
After:   (JD skills ∪ CompanySkills) + user skills → SkillMatcher → tiers → prompts
```

The matching prompt distinguishes the two sources — JD skills are labeled "explicitly required," company skills are labeled "from research — technologies the company uses for this role." The tier matrix applies unchanged.

Company culture and tone are injected as a new **COMPANY CULTURE** section in both CV and cover letter prompts, positioned before the tone-matching instructions. Recent achievements flow into the cover letter's bridging context for concrete, timely references.

### Graceful degradation

Research never blocks application creation. Failures are handled per-component:

| Failure | Behavior |
|---|---|
| `SERPER_API_KEY` not set | Skip all research, proceed JD-only (no error) |
| Serper.dev API error/timeout | Skip all research, log warning |
| Single Puppeteer scrape timeout | Skip that page, use results from other pages |
| LLM parse returns invalid JSON | Retry once, then skip that target |
| All search queries return empty | Skip research, proceed JD-only |
| Cache DB write fails | Return fresh data to caller, log error |

The entire `CompanyResearchService.researchCompany()` call is wrapped in try-catch in `ApplicationCreatorService`. If it throws, `isResearchComplete` stays `false` and generation proceeds with JD-only data — the same experience the user has today.

### Internal parallelism

All three searches fire in parallel. Within each search, the top 3-5 Puppeteer scrapes run in parallel. The total latency is `max(serper_latency + slowest_scrape + llm_parse)` not `sum(...)`. Typical worst case for a never-before-seen company: ~5-7 seconds.

### In-flight deduplication

An in-memory `Map` keyed on normalized company name prevents duplicate Serper queries when multiple users simultaneously apply to the same company. All callers await the same promise.

### Serper result filtering

Before scraping, the result URL is checked against a domain allow/block list:

- **Skills:** prioritize `stackshare.io`, `builtwith.com`, company's own domain; skip `linkedin.com`
- **Culture:** prioritize company about page, `glassdoor.com`, `comparably.com`
- **Achievements:** prioritize `techcrunch.com`, `crunchbase.com`, company press page

### Both creation paths

Research runs at the same point in both `createApplicationFromJob()` (sync) and `processApplicationCreation()` (async). The async path includes a `"researching_company"` progress step for the polling endpoint.

### Puppeteer reuse

A new `scrapePage(url)` method on the existing `URLScrapingService` handles research page scraping. It returns `{ text: document.body.innerText, title: page.title }` with no JD-specific validation, keyword checks, or source-specific selectors — a lightweight code path separate from `extractFromURLValidated()`.

## Alternatives considered

| Option | Coverage | Latency | New infra | Staleness risk |
|---|---|---|---|---|
| **LLM inference only** | Only well-known companies | ~1-2s | None | High — training cutoff |
| **Puppeteer-only (no search API)** | Good, if we guess the right URLs | 10-20s per page until we find a hit | None | Low |
| **Serper + Puppeteer + LLM (chosen)** | Any company with a web presence | 5-7s (cache hit: 0s) | Serper.dev account | Low — cached with TTL |

**Why not LLM inference only?** Fast and zero new dependencies, but LLM training data is stale. A company that switched from MySQL to PostgreSQL 18 months ago would be misrepresented. The LLM also hallucinates for lesser-known companies.

**Why not Puppeteer-only?** We'd need to guess URLs (searching a company name into the address bar doesn't work). A search API tells us *which* pages to scrape — Puppeteer does the deep extraction.

**Why Serper.dev specifically?** Fast (sub-second), cheap (~$0.30/1K queries), returns clean structured results. Google Programmable Search has a free tier but lower quality results for tech-specific queries and requires a custom search engine configuration. Brave Search API is comparable but newer with less ecosystem support.

**Why two cache tables instead of one?** Skills and culture have different staleness profiles. A company's tech stack can change in months (migration, new platform); its culture changes in years. Caching them together means refreshing culture unnecessarily or serving stale skills. Separate tables → independent TTLs → fewer unnecessary re-research calls.

**Why not cache achievements?** Achievements are news-cycle dependent. Referencing a 6-month-old funding round as "recent" in a cover letter reads as lazy or outdated. The cost of one extra search per application is worth the timeliness.

**Why async with internal parallelism instead of fully async (CV first, update later)?** A fully async approach (generate CV with JD-only data, update when research completes) avoids any added latency but requires dual document generation and a notification/refresh mechanism. The simpler approach — block but parallelize internally — adds ~5-7s once per company and reuses the existing synchronous generation flow. The cost is paid once per never-before-seen company; all subsequent users get cache hits with zero added latency.

## Consequences

**Positive:**
- CVs and cover letters reflect what the company actually uses, not just what the JD lists
- Culture-aware tone matching is backed by data, not just JD surface style inference
- Cover letters can reference concrete, timely company achievements instead of generic enthusiasm
- Caching is shared across all users — the first applicant to a company pays the latency cost, everyone else gets instant enrichment
- Research never blocks application creation — degradation is silent and the user gets the same experience they have today
- No new vendor lock-in — Serper is optional (env var gated), the LLM and Puppeteer are already dependencies
- Normalized company names prevent cache fragmentation from minor JD variations

**Negative:**
- Adds a new external API dependency (Serper.dev) with associated billing, API key management, and rate limit surface
- First-ever application to a company adds 5-7s latency (mitigated: parallelism, one-time cost, only when `SERPER_API_KEY` is configured)
- Company name normalization is lossy — two genuinely different companies with similar names after normalization (e.g., "Acme Inc" and "Acme Ltd") could collide in the cache
- Domain-based URL filtering for scraping is a heuristic — high-signal sites can change their URL structure or go offline
- The Serper + Puppeteer + LLM chain has three failure points; while each degrades gracefully, partial enrichment (skills succeeded but culture failed) is indistinguishable from no enrichment to the user
- Stale cache refresh is fire-and-forget — if the background refresh consistently fails (e.g., Serper quota exhausted), stale data persists indefinitely with no alerting

## Implementation notes

1. **New files:**
   - `backend/src/services/research/serper-service.js` — Serper.dev API wrapper
   - `backend/src/services/research/company-research-service.js` — orchestrator

2. **Modified files:**
   - `backend/src/services/extraction/url-scraping-service.js` — add `scrapePage(url)` method
   - `backend/src/services/application/application-creator-service.js` — wire research into both creation paths
   - `backend/src/services/prompts/prompt-builder.js` — add COMPANY CULTURE section, merge CompanySkills into skill lists
   - `backend/prisma/schema.prisma` — add `CompanyProfile`, `CompanySkill` models, `isResearchComplete` on `Application`

3. **Migration:** Two new tables (`company_profiles`, `company_skills`) + one new column (`isResearchComplete` on `Application`).

4. **Env var:** `SERPER_API_KEY` — optional. If unset, research is skipped silently.

5. **Company name normalization:** `normalizeCompanyName(name)` utility — lowercase, strip legal suffixes, collapse punctuation. Stored in `backend/src/utils/company-name-normalizer.js`.

6. **Progress step:** The async application creation path gains a `researching_company` step. The polling endpoint returns it in the progress array.

7. **ADR relationship:** Supersedes none. Builds on ADR-0006 (skill matching pipeline). The cache pattern follows ADR-0005 (translation cache: hash-based lookup, composite unique constraint, no TTL at DB level).
