# ADR-0017: Multiple Job Profiles Is an Admin-Configurable Feature Flag

**Status:** Accepted
**Date:** 2026-08-28
**Decided by:** Oluwatobi Lukan

---

## Context

The "multiple job profiles" capability was hardcoded in two places: a backend `JOB_PROFILE_LIMITS` constant (FREE/BASIC = 1, PRO/ENTERPRISE = unlimited) and a matching inline `subscriptionTier === 'FREE' || 'BASIC'` check in the frontend. Every other gated feature in the product (custom templates, bulk operations, provider switching, …) is already controlled from the admin "Tier Limits & Pricing" tab via `TierLimit` `features` booleans. This split meant an admin couldn't change which tiers get multiple profiles, and the user-facing notice hardcoded "Upgrade to PRO".

ADR-0004 explicitly chose hardcoded over DB-configurable ("two tiers with a limit and both have the same value; promote to `TierLimit` when granularity is needed"). That future arrived.

## Decision

Model "multiple job profiles" as a boolean feature flag — `TierLimit.multipleJobProfiles` — in the same shape as the existing feature booleans (`customTemplates`, `bulkOperations`, `allowProviderSwitch`, …), and expose it in the admin "Tier Limits & Pricing" features section.

- **Enforcement**: the flag is binary, matching today's behavior exactly — `multipleJobProfiles: true` → unlimited, `false` → cap of 1. `isProfileLocked(profile, limit, totalCount)` keeps its signature; only the resolved `limit` changes source (DB flag vs. hardcoded map).
- **Access endpoint**: `GET /api/job-profiles/access` returns `{ allowed, userTier, allowedTiers }`, mirroring the established company-research access pattern, so the frontend can render a dynamic upgrade notice that names the tiers offering the feature instead of hardcoding "PRO".
- **Frontend**: a `useJobProfileAccess` hook (mirror of `useCompanyResearchAccess`) drives the notice; the notice is swapped to precede the "Fill from CV" button.

## Alternatives considered

**Numeric per-tier limit field (`maxJobProfiles`).** Rejected. A numeric cap adds a `UsageLog`-style counter, validation, and "unlimited" sentinel handling for a capability that is genuinely binary today (single profile vs. many). The boolean flag is the smallest change that satisfies the requirement, and a numeric field can be added later without reworking the flag.

**Keep hardcoded, only improve the copy.** Rejected. That re-imports the exact coupling the user asked to remove and leaves the admin control inconsistent with every sibling feature.

**Drive the frontend notice from the existing `subscriptions/plans` response instead of a new access endpoint.** Rejected. The company-research access pattern already exists and returns the tier list the notice needs in one authenticated call; reusing it keeps the surface consistent.

## Consequences

- **Admins control which tiers offer multiple profiles** from the existing "Tier Limits & Pricing" tab; a schema migration adds `multipleJobProfiles BOOLEAN NOT NULL DEFAULT false`.
- **Behavior is unchanged by default**: FREE/BASIC remain capped at 1, PRO/ENTERPRISE unlimited. Only the *source of truth* moved from code to the DB.
- **Dynamic upgrade messaging**: the user notice names the allowed tiers (e.g., "available on PRO and ENTERPRISE plans") and updates automatically when an admin toggles the flag.
- **Supersedes ADR-0004's "hardcoded cap" decision only**; ADR-0004's soft-lock, delete-allowed, and cap=1 semantics remain in force.
