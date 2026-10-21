# ADR-0009: User-Controlled Company Research with Tier Gating

**Status:** Accepted
**Date:** 2026-07-19
**Decided by:** Oluwatobi Lukan

---

## Context

ADR-0007 introduced a company research pipeline that fires automatically during every application creation. Research enriches CVs and cover letters with company culture, tech stack, and achievements. It has two limitations:

1. **No user control**: Research runs unconditionally. Users cannot opt out, and they cannot trigger research after the initial application creation (e.g., during document regeneration). If research fails during processing, there is no retry path.

2. **No tier gating**: Research consumes Serper API quota and LLM tokens, but every tier uses it equally. Admins have no way to restrict research to paid tiers or manage the API key through the admin panel.

3. **Achievements are never cached** (ADR-0007 § "Why not cache achievements?"). This causes redundant Serper+Puppeteer+LLM calls when multiple users apply to the same company within a short window. It also prevents showing historical research results to users after the fact.

4. **No admin visibility**: Admins cannot see which companies have been researched, manage cached data, or re-research stale entries on demand.

This ADR adds user-facing controls, admin management interfaces, tier-based access gating, and a research results viewer — while reversing the achievements caching decision from ADR-0007.

## Decision

### 1. User-controlled opt-in

Add an "Include company research" checkbox to the application creation wizard (step 1, above the "Start Processing" button). Behavior:

| Tier access | Default state | User action |
|---|---|---|
| Allowed | Checked (opt-out) | Can uncheck to skip research |
| Disallowed | Unchecked, disabled | Upgrade message with link |

The checkbox state flows to the backend via a `useCompanyResearch` field on `POST /api/job/process-job` (FormData or JSON). When `false`, the `researching_company` progress step is omitted from the async status response. The user's intent is stored as `userRequestedResearch` on the Application record.

### 2. Tier-based access gating

A single `Settings` key (`company_research_tiers`) stores a comma-separated list of tiers with access (e.g., `"FREE,BASIC,PRO,ENTERPRISE"`). Default: all four tiers.

Admin configures this via a checkbox grid in the Admin → Company Research tab, following the Provider Access Control pattern (ADR-0002).

Backend enforcement is an inline tier check in the route handlers for `POST /api/job/process-job` and `POST /api/job/generate-documents` — not middleware. Returns 403 if the user's tier is not in the allowed list.

A standalone endpoint `GET /api/company-research/access` returns `{ allowed, userTier, allowedTiers }` so the frontend can render the checkbox correctly before the user interacts.

When admin disables a tier, existing applications preserve their research data — only *new* usage is gated.

### 3. Research retry via document regeneration

The regenerate modal gains a research checkbox. Logic:

| `userRequestedResearch` | `isResearchComplete` | Checkbox in regenerate modal |
|---|---|---|
| `true` | `true` | Hidden — research data always included |
| `true` | `false` | Shown, pre-checked — retry after failure |
| `false` | `false` | Shown, unchecked — opt in now |

When the checkbox is checked, research runs **synchronously** before document generation. The modal shows a two-step progress indicator: "Researching company..." → "Generating documents...". Runs cache-first — only triggers fresh research on cache miss.

The regenerate endpoint (`POST /api/job/generate-documents`) returns updated research fields (`isResearchComplete`, `companyResearch`) alongside document content so the documents page refreshes atomically.

### 4. Application-level research snapshot

A new JSON column `companyResearch` on `Application` stores a snapshot of the research results at creation/regeneration time:

```json
{
  "researchedAt": "2026-07-19T14:30:00Z",
  "profile": { "culture": "...", "tone": "...", "values": [...], "mission": "...", "industry": "...", "size": "..." },
  "skills": [{ "name": "React", "category": "framework" }],
  "achievements": [{ "headline": "...", "date": "...", "relevance": "..." }]
}
```

The snapshot is the application's historical record — regenerates use the snapshot (not the global cache), and admin cache deletions do not cascade to snapshots. Legacy applications (predating the snapshot column) show "Research data not available for this application" in the popup.

### 5. Research results popup

On the documents page, a status indicator shows:

| State | Display |
|---|---|
| Research succeeded | "✓ Company research completed" + "View details" button |
| Research failed | "⚠ Company research could not be completed" + "Retry" link |
| User opted out | Nothing shown |

"View details" opens a large modal with three sections: Company Profile (label-value pairs), Tech Stack (skills grouped by category), and Recent Achievements (chronological list). Empty sections are hidden. No download, no research date shown. View-only.

"Retry" opens the regenerate modal with the research checkbox pre-checked.

### 6. Admin: Serper API key management

A masked input field in the Admin → Company Research tab stores the API key in the `Settings` table (`serper_api_key` key). Admin-set key takes precedence over the `SERPER_API_KEY` environment variable (fallback). Reveal toggle for viewing. Validation via a test search call on save ("Validating..." → "Key is valid" / "Invalid API key: [error]" toast). Placeholder text indicates source: "Using SERPER_API_KEY from environment" vs the masked admin key.

### 7. Admin: company research data management

A paginated table (25/page, 25/50/100 options) lists all researched companies. Columns: normalized company name, industry, size, skills count, profile updated, skills updated. Default sort: most recently updated first. Search across company name, industry, and skill names (two-query approach merged in code).

Two action buttons per row:

- **Rerun Research**: Confirmation dialog → synchronous research run (10-30s) → spinner on button → row updates from response → success/error toast. Optimistic update.
- **Delete**: Confirmation dialog → removes `company_profiles` row + all `company_skills` rows + all `company_achievements` rows for that company. Does not cascade to Application snapshots. Optimistic delete (row removed from local state). Toast on success/error.

### 8. Achievements caching reversal (supersedes ADR-0007)

ADR-0007 § "Why not cache achievements?" is reversed. Achievements are now cached in a new `company_achievements` table with a **30-day freshness window** (matching skills). This:

- Eliminates redundant Serper+Puppeteer+LLM calls for same-day same-company applications
- Enables the research results popup to show achievement data from the snapshot
- Participates in the existing stale-cache background refresh mechanism (`_checkCache` extended to include achievements)
- Uses the same delete-then-recreate refresh pattern as `company_skills`

The `RESEARCH_TYPES` constant in `CompanyResearchService` remains `['skills', 'culture', 'achievements']` — only the caching behavior changes.

### 9. User action logging

New entries across all three logging tables:

| Table | Action | Category/Details |
|---|---|---|
| `UsageLog` | `COMPANY_RESEARCH` | `aiQueries` — middleware-gated, counts against tier limits |
| `UsageLog` | `ADMIN_RERUN_RESEARCH` | Direct creation, admin audit |
| `UsageLog` | `ADMIN_DELETE_RESEARCH` | Direct creation, admin audit |
| `Changelog` | `company_research_completed` | "Company research completed — N skills, culture profile, N achievements" |
| `Changelog` | `company_research_failed` | "Company research failed — [reason]" |
| `LlmCallLog` | `COMPANY_RESEARCH` | Auto-captured; passed as `action` to `generateText()` during parsing |

### 10. Database schema changes

```prisma
// New table
model CompanyAchievement {
  id          Int      @id @default(autoincrement())
  companyName String   @map("company_name")
  headline    String
  date        String?
  relevance   String?
  source      String?
  createdAt   DateTime @default(now()) @map("created_at")
  @@index([companyName])
  @@map("company_achievements")
}

// New columns on Application
model Application {
  // ... existing fields ...
  companyResearch       Json?    @map("company_research")
  userRequestedResearch Boolean  @default(false) @map("user_requested_research")
}
```

### 11. API surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/company-research/access-config` | Admin: read tier config + API key status |
| `PUT` | `/api/company-research/access-config` | Admin: write tier config + API key |
| `GET` | `/api/company-research/access` | User: `{ allowed, userTier, allowedTiers }` |
| `GET` | `/api/company-research/companies` | Admin: paginated company list with search |
| `POST` | `/api/company-research/companies/:name/rerun` | Admin: sync rerun for a company |
| `DELETE` | `/api/company-research/companies/:name` | Admin: delete all research data for a company |
| `GET` | `/api/applications/:id/company-research` | User: research snapshot for the popup |

Routes live in `routes/company-research.js` and `routes/applications.js` (snapshot endpoint only).

## Alternatives considered

**Why not inference-only research for the popup?** The popup shows what was actually used at generation time. Re-running research on popup open would be slow and potentially show different data than what the AI saw. A snapshot at creation time is the honest representation.

**Why sync for admin rerun but cache-first for user regenerate?** Admin is actively managing data — they expect immediate feedback and are willing to wait. User regenerate is primarily about document quality — cache-first keeps it fast except on true cache misses. Different audiences, different expectations.

**Why store achievements in a separate table vs. a JSON column in `company_profiles`?** Achievements and profiles have different staleness profiles (30 days vs. 90 days). Separate tables → independent `createdAt` timestamps → independent freshness checks. A JSON column would couple them unnecessarily.

**Why 30-day TTL for achievements instead of the original "never cached"?** The original rationale (achievements are news-cycle dependent; stale achievements read as lazy) was valid for long caching windows. A 30-day window — the same as skills — balances freshness with cost. A funding round from 2 weeks ago is still relevant; from 6 months ago it's stale. The 30-day cap plus background refresh means data is never older than 30 days plus the interval between applications to that company.

**Why two-query approach for admin company search instead of a single Prisma relation query?** The `CompanyProfile` and `CompanySkill` models don't have a formal Prisma relation. Adding one would require a schema change and migration for the relation, plus potential data integrity concerns for skills without a matching profile. Two queries merged in code is simpler and sufficient for the expected data volume (hundreds, not millions, of companies).

**Why inline tier checks in routes instead of middleware?** Only two endpoints need the check (`process-job`, `generate-documents`). A parameterizable middleware adds indirection for marginal reuse. Inline checks follow the existing pattern in `routes/llm.js` (provider switching checks).

## Consequences

**Positive:**
- Users control whether research runs — no wasted API quota on unwanted enrichment
- Tier gating lets admins monetize research as a premium feature
- Regenerate flow provides a retry path when initial research fails
- Research results popup builds user trust by showing exactly what data was used
- Admin panel gives operators visibility into the research cache and tools to manage it
- Achievements caching eliminates redundant API calls for popular companies
- Application snapshots preserve historical accuracy — regenerating an old application uses the same research data
- Admin API key management removes the need for environment variable deployment for configuration changes

**Negative:**
- Schema change: new `company_achievements` table + two new columns on `Application` (migration required)
- New frontend components: checkbox in wizard, research status indicator, results popup, regenerate modal changes, admin tab with three sections
- Tier gating is binary (allowed/not-allowed) — no per-tier research depth or per-tier Serper quota
- Admin rerun is synchronous and takes 10-30s — no parallelism or queuing for multiple reruns
- Achievements 30-day cache means rarely-researched companies may serve slightly stale achievement data (mitigated: background refresh on stale cache access)
- The `company_research_tiers` setting uses a single comma-separated key rather than per-tier boolean keys — if tier names change, the values become stale strings

## Implementation notes

1. **New files:**
   - `backend/src/routes/company-research.js` — all company research endpoints
   - `frontend/src/components/admin/CompanyResearchManagement.tsx` — admin tab
   - `frontend/src/components/CompanyResearchPopup.tsx` — research results modal

2. **Modified files:**
   - `backend/prisma/schema.prisma` — `CompanyAchievement` model, `companyResearch` + `userRequestedResearch` on `Application`
   - `backend/src/services/research/company-research-service.js` — achievements caching, snapshot construction
   - `backend/src/services/application/application-creator-service.js` — `useCompanyResearch` gating, snapshot storage, regenerate-with-research orchestration
   - `backend/src/routes/job-extraction.js` — `useCompanyResearch` field, tier enforcement, regenerate response update
   - `backend/src/routes/applications.js` — snapshot endpoint, include booleans in detail response
   - `backend/src/config/tier-limits.js` — `COMPANY_RESEARCH` in `ACTION_CATEGORIES`
   - `backend/src/constants/index.js` — new changelog action constants
   - `backend/src/services/changelog/changelog-service.js` — research changelog methods
   - `frontend/src/components/StreamlinedApplicationForm.tsx` — checkbox in step 1, research status indicator, popup trigger
   - `frontend/src/components/DocumentPreview.tsx` — regenerate modal research checkbox
   - `frontend/src/app/admin/page.tsx` — new "Company Research" tab

3. **Migration:** One migration adding `company_achievements` table + `company_research` (JSON) and `user_requested_research` (boolean) columns on `Application`.

4. **ADR relationships:** Supersedes ADR-0007's "never cache achievements" decision. Builds on ADR-0002 (Provider Access Control pattern for admin tier gating), ADR-0004 (tier-based feature access), ADR-0006 (skill matching pipeline), and ADR-0007 (research pipeline architecture).

5. **Tests:** Full TDD coverage — backend route tests (access config CRUD, tier enforcement, company list/search/pagination, rerun, delete, snapshot endpoint), service tests (achievements caching, snapshot creation), frontend component tests (checkbox states, status indicator, popup, admin tab, regenerate modal).
