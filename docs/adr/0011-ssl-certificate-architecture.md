# ADR-0011: SSL Certificate Architecture — Split Certs with Porkbun DNS Automation

**Status:** Accepted
**Date:** 2026-07-23
**Decided by:** Oluwatobi Lukan

---

## Context

The project serves `mykaria.com` across two servers: `myKaria` (Nginx web server, Dockerized app) and `vennit_server` (Virtualmin-managed mail server: Postfix + Dovecot). Let's Encrypt certificates were previously issued only on `myKaria`, with a deploy hook pushing certs to the mail server. The wildcard cert (`*.mykaria.com`) used manual DNS-01 authentication and expired because it couldn't auto-renew. DNS is hosted on Porkbun, which Virtualmin does not manage.

## Decision

**Split certificate issuance across servers, each responsible for its own domain set:**

| Server | Cert (certbot) | Domains | Challenge | Renewal |
|--------|---------------|---------|-----------|---------|
| `myKaria` | `mykaria.com` | `mykaria.com`, `www.mykaria.com` | HTTP-01 (nginx) | Auto (certbot.timer) |
| `vennit_server` | `mykaria.com-wildcard` | `mykaria.com`, `*.mykaria.com` | DNS-01 (Porkbun API hooks) | Auto (certbot.timer) |

**Custom Porkbun DNS hooks instead of a pip package.** Two shell scripts (`porkbun-auth.sh`, `porkbun-cleanup.sh`) call the Porkbun REST API directly to create/delete `_acme-challenge` TXT records. API keys are stored in `/etc/letsencrypt/scripts/porkbun.conf` (mode 600).

**Virtualmin `install-service-cert` in the deploy hook.** After renewal, the deploy hook copies certs to `/home/mykaria/ssl.*` and calls `virtualmin install-service-cert` to rebuild Postfix SNI maps and reload Dovecot. This keeps Virtualmin as the source of truth for mail service configuration.

**Deploy hook on `myKaria` disabled.** The old `sync-to-vennit.sh` hook that copied the main cert to the mail server is chmod -x. Each server now manages its own cert independently.

## Alternatives considered

**Single cert with DNS-01 for everything (rejected):** Merging all domains (`mykaria.com`, `www`, `*.mykaria.com`) into one DNS-01 cert would mean the main web domains also depend on Porkbun API hooks. If the hooks break, the website loses SSL too. Splitting isolates risk: the website auto-renews via HTTP-01 regardless of DNS hook status.

**certbot-dns-porkbun pip package (rejected):** The Python package exists but system Python is externally managed (PEP 668) and `--break-system-packages` is fragile across OS upgrades. Two small shell scripts with `curl` and `jq`-compatible parsing have zero dependencies beyond what's already installed.

**Wildcard cert on myKaria, synced to vennit_server (rejected):** Would keep the old push architecture but adds complexity: the web server needs DNS hooks just to serve the mail server. The mail server should own its own cert lifecycle.

**Manual Postfix/Dovecot reload instead of Virtualmin (rejected):** Direct `postmap` calls produced a Berkeley DB format incompatible with Postfix 3.4.13 on this system. Virtualmin's `install-service-cert` builds the hash tables correctly.

## Consequences

**Positive:**
- Both certs auto-renew independently — no manual intervention needed for either
- Risk isolated: web server SSL unaffected by DNS API issues, mail server SSL unaffected by nginx config changes
- Virtualmin remains the single authority for mail service configuration
- Porkbun hooks are plain shell — debuggable, no dependency hell

**Negative:**
- Two certbot configurations to maintain instead of one
- DNS propagation wait (30s) makes wildcard renewal slower than HTTP-01
- Porkbun API key rotation must be done manually in `/etc/letsencrypt/scripts/porkbun.conf`
- If vennit_server's certbot.timer fails silently, mail clients will see an expired cert (monitoring not yet configured)

## Implementation notes

1. **Files deployed on vennit_server:**
   - `/etc/letsencrypt/scripts/porkbun-auth.sh` — creates `_acme-challenge` TXT record
   - `/etc/letsencrypt/scripts/porkbun-cleanup.sh` — deletes TXT record after validation
   - `/etc/letsencrypt/scripts/porkbun.conf` — Porkbun API credentials (mode 600)
   - `/etc/letsencrypt/renewal-hooks/deploy/deploy-mykaria-mail.sh` — post-renewal cert deployment
   - `/etc/letsencrypt/renewal/mykaria.com-wildcard.conf` — renewal config with hooks wired

2. **Scripts tracked in repo:** `scripts/porkbun-dns/` (auth, cleanup, deploy hook, config example)

3. **ADR relationships:** Supersedes the implicit architecture where `myKaria` was the sole cert authority. Partner to the `sync-ssl-cert-mykaria` skill which documents the (now disabled) push-based cert sync.
