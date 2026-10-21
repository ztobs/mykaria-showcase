# 0001 — Automated versioning on push to main

**Status**: accepted

The repository gains a fully automated versioning system. Every push to `main` runs a hand-rolled Node script (`scripts/bump-version.js`) that reads commits since the last tag, determines a SemVer bump type from conventional commit prefixes (with `[major]/[minor]/[patch]` override tags in commit bodies), updates the `VERSION` file at the repo root, syncs the value into `backend/package.json` and `frontend/package.json`, appends a Keep-a-Changelog section to `CHANGELOG.md`, creates an annotated git tag, and pushes the result back. A webhook filter prevents the auto-commit from re-triggering Jenkins. The system is crash-safe, idempotent, lockfile-guarded, and runs a smoke check against the new image before declaring success. Rollback is a first-class command that re-deploys a kept-around image.

## Considered options

**Bump on every push to `main` vs. only on a manual `make release`**: chose push-to-main because the user's stated goal was "anytime I make changes and push to git, it's automatically versioned." Manual would have contradicted that.

**Conventional Commits vs. PR labels vs. branch-name-based vs. manual override**: chose Conventional Commits with override tags. The repo's existing commit history already uses `feat:` / `fix:` / `chore:` prefixes, so the signal is free; PR labels would require GitHub API integration with Jenkins; branch names are too crude; pure manual contradicts the automation goal.

**One monorepo version vs. per-package versions (Changesets/Lerna)**: chose one monorepo version. The repo deploys as a single Docker compose stack — there is no scenario where one package ships without the other. Per-package discipline cost (every PR needing a changeset) is not justified at this scale.

**`VERSION` file at root vs. root `package.json` vs. `git describe`**: chose `VERSION` file. The root `package.json` is not a publishable artifact and is a weird place for an app version; `git describe` is messy during local dev and requires a tag to exist before it can answer; a dedicated file is human-readable with `cat VERSION` and trivially copyable into Docker build args.

**Hand-rolled `scripts/bump-version.js` vs. `semantic-release` vs. `standard-version` vs. `release-please`**: chose hand-rolled. The other tools are GitHub-Actions- or npm-publish-first, none of them match this project's exact requirements (multiple `package.json` files, a `VERSION` source-of-truth file, Docker image tagging, no GitHub Release, Jenkins-not-GHA execution). The project also mandates TDD, and a custom script with full test coverage is in the spirit of that mandate. Contracts (where the version lives, what artifacts are produced) stay the same if we ever swap implementations.

**Build-time env var vs. read `VERSION` at runtime vs. `git describe` at runtime**: chose build-time env var. The image is immutable; the version of a running image is the version it was built with. Reading a file or shelling out to `git describe` from inside a production container (which has no `.git` directory) is the wrong shape.

**Local Docker images, exact semver tags only vs. minor/major aliases vs. registry-pushed**: chose local + exact. One host builds and runs the stack, so a registry is out of scope and would add a separate auth/secret surface. Minor/major aliases are convenient but reduce determinism; exact tags mean `docker run mykaria-backend:1.3.7` is unambiguous.

**No support branches (linear) vs. GitFlow `release/v1.3` vs. one-shot hotfix branches**: chose linear. The project has a single production deployment with no API consumers requiring version pins or SLAs requiring old versions to stay alive. The design does not preclude adding support branches later — that would only require extending the bump trigger to "push to `main` OR push to `release/*`."

**No pre-releases (alpha/beta/rc) vs. enabled vs. designed-for-but-disabled**: chose "no pre-releases." The project has a single production environment with no staged-rollout use case. Tooling can be extended later to support `1.4.0-rc.1` as a one-line policy change.

## Consequences

- **Every merge to `main` ships a new release.** A typo-fix merge on a Friday at 4pm produces a new tag, a new CHANGELOG entry, and a deploy. There is no human gate. This is by design but is the single most important operational consequence — the team must internalize that merging to `main` *is* shipping.
- **Jenkins has push access to the repository.** The bump stage commits and pushes back to `main`. This is a meaningful trust grant; protect the Jenkins SSH key accordingly and rotate it on personnel changes.
- **The webhook filter is load-bearing.** If the filter is misconfigured, the system will infinite-loop, with each bump triggering another bump. The filter must ignore pushes that only touch `VERSION`, `CHANGELOG.md`, and `**/package.json`. Document this in `docs/CI-CD.md` and add a test that proves the filter works.
- **Image retention becomes a real policy.** Rollback depends on old images being kept around. The deploy script must prune, and the retention window must be wider than the time it takes to discover "the new release is broken." Default: keep last 5 versions, prune older. Revisit if rollback windows prove insufficient.
- **CHANGELOG is backfilled from real history.** The first run produces a CHANGELOG with retroactively-generated entries for `v1.0.0`, `v1.1.0`, `v1.2.0`, and `v2.0.0` based on `git log` parsing. These are honest reconstructions, but they were not written contemporaneously with those releases. The first entry written by the live system is `v2.1.0`.
- **`/api/version` exposes build metadata.** The endpoint returns `{ version, commit, buildDate, environment }`. The `commit` and `buildDate` come from build-time env vars. If either is missing, the endpoint reports a warning. Operators rely on this endpoint to confirm "is prod actually running the version we think it is?"
- **The system is fully reversible by deleting `VERSION` and the bump stage.** If the versioning system is later abandoned, the project returns to a state equivalent to its pre-system state by removing `scripts/bump-version.js`, the Jenkins stage, the webhook filter, and the `VERSION` file. The git tags and CHANGELOG entries remain as historical artifacts.
