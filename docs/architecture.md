# Architecture

A walk through how myKaria is put together, the constraints that shaped it, and
the parts I would change today.

## Shape

One deployable backend, one deployable frontend, one PostgreSQL database. The
backend is a modular monolith: 33 route modules, domain services behind them,
Prisma as the data layer, 68 migrations. I chose a monolith deliberately. At one
developer, a service split buys latency and operational cost and buys back
nothing. The boundaries that matter are inside the code, not between processes.

```
browser (Next.js 15, React 19, TypeScript)
   |
   | HTTPS, JWT in an httpOnly cookie
   v
express app
   helmet, cors allowlist, request-id, rate limit, bot protection,
   ip blacklist, auth, usage limits, response translation
   |
   +-- routes (33 modules)                thin: validate, authorise, delegate
   +-- services                           the actual logic
   |     extraction/  PDF, URL, CV parsing
   |     prompts/     prompt-builder
   |     content/     skill-matcher, language-detector, post-processing
   |     llm/         provider client + pricing resolver
   |     pdf/         HTML -> PDF via Puppeteer
   |     research/    company research
   |     signature/   signature capture and storage
   |     application/ generation orchestration
   +-- models/                            SQL through Prisma
   v
postgresql
```

## The generation request

1. **Intake.** The user supplies a PDF, a URL or pasted text. `pdf-parse` for
   files, `cheerio` for URLs, a parser for pasted text. Output is a structured
   job object: title, company, requirements, seniority, language.
2. **Matching.** `skill-matcher` sends the candidate's skill list and the job
   terms to the model once, indexed, and asks for four buckets: matched,
   unmatched job terms, irrelevant user skills, complementary skills. Job terms
   are referenced by index, which keeps the payload small and makes the model's
   answer reconcilable with the input. The response is then normalised in code:
   unknown names dropped, levels corrected against the profile, match strength
   mapped to a tier, growth items capped, always-include skills forced back in.
3. **Assembly.** `prompt-builder` turns the match result and the profile into
   the CV prompt and the letter prompt. Both share the same match result, so a
   package costs one matching call rather than two.
4. **Generation.** The provider client picks the configured model, retries on
   transient failures, falls back to another provider, strips reasoning traces
   from models that emit them, and records tokens and resolved cost per call.
5. **Rendering.** Handlebars templates for 23 document designs, HTML to PDF
   through Puppeteer with embedded fonts.
6. **Aftercare.** Section-level editing after generation, translation of the
   finished document, and the application tracker.

## Decisions worth defending

**LLM for judgement, code for policy.** The model decides relevance and wording.
It does not decide whether a beginner skill may be labelled expert, whether an
irrelevant skill is allowed into the prompt, or whether an always-include skill
survives a bad response. Those are invariants and they live in tested code.

**One call, not three.** The obvious build is match, then plan, then write. Each
hop is latency and a new failure mode. Matching once and reusing the result for
both documents removed a call per package and removed a class of inconsistency
where the CV and the letter disagreed about the same skill.

**Truncation is a correctness bug, not a performance detail.** A truncated
matching response used to return empty buckets, which the downstream gates read
as "nothing matched, nothing forbidden" and let arbitrary skills leak into the
document. The fix was a generous output ceiling plus explicit checks that treat
an empty-but-expected-non-empty answer as a failure. See ADR 0006.

**Context is a budget.** Long job ads plus long histories overflow older models.
ADR 0010 describes the adaptive path: measure, trim by information value,
never trim the requirements section.

**Tenancy is one column, enforced in the data layer.** Every query that touches
user data filters on the authenticated user id through a small set of model
helpers. The rule is that services never hand a raw Prisma client to a route.

**Cost is a product concern.** Multi-provider support exists because price and
quality diverge by task. The pricing resolver keeps per-model rates in the
database, so a price change is data, not a deploy.

## Failure modes I designed for

- provider outage: fallback provider, then a clear error, never a half-written
  document
- malformed model JSON: parse, repair once, then fail with a typed error
- truncation: detected and retried with a smaller payload
- duplicated submission: idempotency on the generation job
- expired subscription mid-flow: tier gates read the entitlement, not the UI
- personal data deletion: a deletion service plus a retention cron, because
  storing CVs means owning that obligation

## What I would change

- **A queue from day one.** Generation runs in request scope with progress
  polling. At low volume that is fine and simple; at real volume it should be a
  job queue with resumable stages.
- **Contract tests against real provider responses.** The unit tests here are
  good, but model output drifts. Recorded fixtures per provider would catch
  prompt regressions earlier than user reports.
- **Typed boundaries.** The backend is JavaScript. TypeScript at the service
  boundary between matching, prompt assembly and rendering would have caught
  several shape mismatches that instead became runtime errors.
- **Ship the landing page before the admin console.** I built breadth first.
  Distribution was, and is, the binding constraint, not features.
