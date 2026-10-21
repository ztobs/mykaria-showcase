# 0002 — Dedicated CustomProvider table instead of flat Settings keys

**Status**: accepted

The system gains support for multiple OpenAI-compatible LLM providers defined by the admin. Instead of encoding each provider's credentials as flat `llm_custom_{slug}_{key}` rows in the existing `Settings` key-value table (which would require fragile string-parsing to discover and reconstruct providers on startup), a dedicated `CustomProvider` table stores each provider as a row with columns for `label`, `slug`, `baseURL`, `apiKey`, `model`, `maxTokens`, `temperature`, and `isEnabled`. The existing singleton `openai-compatible` Settings keys are migrated into a `CustomProvider` row on next startup and the old constants are removed.

## Considered options

**Flat Settings keys (`llm_custom_{slug}_apiKey`, `llm_custom_{slug}_baseURL`, etc.) vs. dedicated table**: chose dedicated table. The Settings table has no concept of grouping — each key-value pair is independent. To discover "which custom providers exist," the system would need to scan all keys matching a prefix, extract slugs from key names, and reassemble configs from scattered rows. This is fragile (a missing key silently produces a broken provider), hard to query (no way to list all custom providers in a single query), and violates the relational principle that related data should live together. The Settings pattern works for built-in providers because there is exactly one of each — the key prefix IS the provider identity. For N providers of the same type, a table is the natural shape.

**Reuse the existing `openai-compatible` Settings keys with an array/serialized config vs. migration**: chose migration. Keeping the old `openai-compatible` path alive alongside custom providers creates two code paths that do the same thing. The old keys are migrated into a `CustomProvider` row with slug `custom-openai-compatible`, the `"openai-compatible"` string is removed from all hardcoded constants, and the `OpenAICompatibleProvider` class becomes the shared engine for all custom provider rows.

**Per-user custom providers (`userId` column, nullable for global) vs. admin-only**: chose admin-only. Users bringing their own API keys to custom endpoints would create a support burden (each user's provider needs its own connection testing, model discovery, and troubleshooting surface) and would add complexity to the provider resolution queue (a user's personal provider might conflict with a tier mapping). Users can still select from the admin-defined pool if their tier allows switching.

**`isEnabled` toggle vs. deletion-only**: chose toggle. `isEnabled = false` drops the provider from all dropdowns and the in-memory provider map without destroying data. Admins can temporarily disable a provider during maintenance. This is distinct from per-tier availability (`available_providers_{TIER}`), which controls which tiers can see an enabled provider.

## Consequences

- **The `openai-compatible` string becomes dead data.** After migration, any code path that references the literal `"openai-compatible"` is either updated (migration script rewrites `LLMProviderTier.provider` and `llm_active_provider`) or degrades gracefully (resolution queue skips unknown providers). The old `llm_openai-compatible_*` Settings rows remain in the database as dead data with a startup warning.
- **Provider identity is the slug.** The slug is the foreign key in `LLMProviderTier.provider`, `user_preferred_provider`, and `llm_active_provider`. Changing a custom provider's slug is not supported (immutable after creation). Deleting a custom provider that is still referenced is allowed — the resolution queue silently skips missing providers.
- **Migration is idempotent and runs exactly once.** On startup, if `llm_openai-compatible_*` settings exist and no `custom-openai-compatible` row exists, the migration creates one. If the admin later deletes that row, the migration does not re-run (the old settings keys are still there, but the row already existed once). This prevents the deleted provider from haunting the system.
- **`user_preferred_provider` rows referencing `openai-compatible` are NOT migrated.** Users who had the old provider as their preference will silently fall through to their tier mapping or the global default. This is deliberate — the migration is a one-time admin concern, not a per-user data fix.
