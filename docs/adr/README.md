# Architecture decision records

Twenty decisions from building myKaria, in the order they were made. Each one
states the context, the options considered, the choice, and the consequences.
They are the honest version: some of them record a mistake that had to be
undone.

| # | Decision |
|---|----------|
| 0001 | Versioning system: semver, build-time version, exact image tags |
| 0002 | Custom provider table instead of hardcoded LLM providers |
| 0003 | Usage reset by date windowing rather than a cron reset |
| 0004 | Job profile limits per tier |
| 0005 | Language translation system for generated documents |
| 0006 | LLM-driven skill matching with deterministic tiering |
| 0007 | Company research for skill enrichment |
| 0008 | Translation admin surface and loading states |
| 0009 | User-controlled company research with tier gating |
| 0010 | Adaptive context-length handling for LLM extraction |
| 0011 | SSL certificate architecture |
| 0012 | Daily insight system on a paid LLM |
| 0013 | Bullet selection before CV generation |
| 0014 | Signature hard reset |
| 0015 | Signature hybrid storage |
| 0016 | Document preview with section editing |
| 0017 | Admin-configurable job profile limit |
| 0018 | Document editing behind a tier flag |
| 0019 | Live pricing portal mounts |
| 0020 | Post-finalisation document editing |

Start with 0006, 0010 and 0013 if you only read three.
