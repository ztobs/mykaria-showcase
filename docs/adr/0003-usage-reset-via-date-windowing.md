# 0003 — Usage reset via date-windowing instead of UsageLog deletion

**Status**: accepted

The admin "reset user usage" feature was originally implemented by deleting all of the target user's `UsageLog` records. This approach is flawed in two ways: (1) it destroys audit data, and (2) it fails to actually zero the counters because `getCurrentPeriodUsage` has a safety-net fallback that directly counts `Application` rows for the period and takes `Math.max(logCount, appCount)`. The fix replaces log deletion with date-windowing — the same mechanism the natural billing-cycle reset already uses — by storing a `usageResetAt` timestamp on the `User` record.

## Considered options

**Delete UsageLogs (current implementation) vs. date-windowing**: chose date-windowing. Deleting logs loses the audit trail permanently. More critically, it can't guarantee counters read zero because `getCurrentPeriodUsage` at line 61 of `usage-limits.js` does `Application.count({ where: { userId, createdAt: { gte: periodStart } } })` and then `counts.applications = Math.max(counts.applications, applicationsThisPeriod)`. Even with zero logs, the `Application` count repopulates the `applications` counter — and the derived `storage = applicationsThisPeriod * 5`. The user reported seeing 98 → 48 instead of 98 → 0 because the 48 were applications still within the billing period window. Date-windowing fixes this by filtering *both* the UsageLog query *and* the Application count query by the same effective date.

**Sentinel UsageLog row (insert `action: 'usage_reset'` and filter by most recent) vs. explicit `usageResetAt` column**: chose explicit column. The sentinel approach avoids a schema change, but puts counting logic at the mercy of log ordering (`ORDER BY createdAt DESC LIMIT 1`), and the sentinel row's meaning is implicit — a future reader won't know the row is functional rather than informational. An explicit `usageResetAt DateTime?` on User is self-documenting, directly queryable, and trivially reversible (set to null).

**`usageResetAt` on User vs. on Subscription**: chose User. The Subscription table only has rows for paid users; FREE users have no subscription row (`prisma.subscription.findUnique` returns null). Putting `usageResetAt` on Subscription would require complex fallback logic that duplicates what the `periodStart` fallback already does. Putting it on User works uniformly regardless of subscription status.

## Consequences

- **Schema change**: `User` gains a nullable `usageResetAt DateTime` column. The Prisma migration is additive and non-breaking.
- **`getCurrentPeriodUsage` changes**: both the `UsageLog.findMany` query (line 31) and the `Application.count` query (line 61) gain an effective filter of `createdAt >= MAX(periodStart, usageResetAt)`, where `usageResetAt` comes from `prisma.user.findUnique({ where: { id: userId }, select: { usageResetAt: true } })`.
- **Admin reset endpoint changes**: instead of `usageLog.deleteMany`, it does `user.update({ where: { id }, data: { usageResetAt: new Date() } })` plus two log inserts: `action: 'usage_reset'` on the target user (informational marker) and `action: 'admin_reset_usage'` on the admin (audit trail). The `admin_reset_usage` metadata changes from `deletedCount` to `previousCounters` (the counters at time of reset, for audit).
- **Usage summary shows reset note**: when `usageResetAt` falls within the current billing period, the frontend displays "Usage was reset by admin on [date]. Period resets [date]."
- **No data is ever deleted by reset**. All `UsageLog` records are preserved for audit. The reset is transparent — the `usageResetAt` timestamp is visible to anyone who queries the user record.
- **Reversible**: clearing `usageResetAt` (set to null) undoes the reset. Or the period naturally rolls over and `periodStart` advances past it, making it moot.
- **`Math.max` safety net is preserved**: the `Application.count` fallback remains useful — if a user's application creation somehow didn't generate a UsageLog, the counter still reflects reality. After a reset, both the log count and the app count are filtered by the same date, so `Math.max(0, 0) = 0`.
