# 0004 — Job profile tier limit

**Status**: accepted
**Superseded in part by**: [ADR-0017](./0017-job-profile-limit-admin-configurable.md) — the "hardcoded cap vs. DB-configurable" decision only.

Free and Basic tier users are limited to **1 job profile**. PRO and Enterprise tiers have no limit. When a user exceeds their tier cap (e.g., downgrades from PRO to Basic with multiple profiles), non-default profiles are soft-locked — they remain visible but are read-only except for deletion. The default profile is always unlocked regardless of count.

## Considered options

**Hard limit (refuse creation at cap) vs. monthly quota (reset each billing cycle)**: chose hard limit. A job profile is persistent data, not a consumable resource. Giving free users "one profile per month" that accumulates to N over time defeats the purpose of the limit. The count check runs at creation time with no UsageLog integration.

**Enforcement via the usage-limits middleware vs. simple route-level check**: chose route-level check. The existing `UsageLog` system tracks monthly counters (applications, AI queries, file generations). A profile count is absolute — it doesn't reset. Adding a `jobProfiles` category to `TierLimit` and `UsageLog` would over-engineer a simple `SELECT COUNT(*) < cap` check.

**Hardcoded cap vs. DB-configurable via TierLimit model**: chose hardcoded. FREE and BASIC both cap at 1 — there are only two tiers with a limit and both have the same value. If additional granularity is ever needed (e.g., BASIC=3, PRO=10), the limit can be promoted to the `TierLimit` model at that point. Today's simplicity wins.

**Soft-lock over-cap profiles on downgrade vs. force deletion vs. grandfather-only**: chose soft-lock. Force deletion is hostile — the user's data is destroyed without consent. Grandfather-only (keep all profiles functional, just block creation) is inconsistent with the cap's purpose after downgrade. Soft-lock means non-default profiles become read-only: the user can view them, delete them to get under cap, or upgrade to PRO to unlock them. The default profile remains fully usable so the user is never locked out.

**Delete blocked on locked profiles vs. delete allowed**: chose allowed. Locking delete on locked profiles creates a trap: a downgraded user with 5 profiles can neither use nor delete any non-default profile, and can't delete the default either (already blocked). They'd be forced to upgrade just to clean up. Allowing delete on locked profiles gives them a natural path back to the cap.

**Cap value: 1 for both FREE and BASIC vs. 0 for FREE, 1 for BASIC, 3 for PRO**: chose 1 for both FREE and BASIC. Restricting FREE to 0 profiles would deny them any role-specific tailoring — a demo-killer. PRO and Enterprise are unlimited to make the upgrade path clear: "need more than one profile? Go PRO."

**Backend enforcement only vs. frontend pre-check**: chose both. The backend rejects at the API level (403). The frontend additionally shows the create button as an upgrade CTA when at cap, disables edit/copy/set-default on locked profiles, and only enables the delete button. This is defense in depth: the backend is the authority, the frontend provides good UX.

**Grandfather existing users vs. hard cut**: chose grandfathering. Users who already have >1 profile on a capped tier keep all their profiles and can use them normally (unless they're over-cap from a downgrade, which triggers soft-lock). They simply cannot create new ones until their count drops below the cap.

## Consequences

- **Free and Basic users with 0 profiles see no change.** They create their first profile normally.
- **Free and Basic users at the cap see an upgrade CTA** instead of the Save Profile button. The backend also rejects new profile creation (403).
- **PRO/Enterprise users are unaffected.** They can create unlimited profiles.
- **Downgrade path**: A user downgrading from PRO to Basic with N > 1 profiles will have N-1 soft-locked profiles. The response from `GET /api/job-profiles` marks each profile with `locked: true/false`. The frontend uses this flag to disable actions and show a lock badge.
- **The `locked` flag is computed, not stored.** It is derived from `(tier, totalCount, isDefault)` at response time — no DB migration or column needed.
- **Job profile count is not a UsageLog category.** It does not appear in the usage-limits middleware, the `TierLimit` DB model, or the `UsageLog` table.
- **Future extensibility**: If tier-specific caps beyond FREE/BASIC=1 are desired, promote `JOB_PROFILE_LIMITS` from a hardcoded constant to a DB-backed `TierLimit` column. The `isProfileLocked()` utility function signature remains the same regardless.
