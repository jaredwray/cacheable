# Releasing

Packages are published to npm by the [`release`](.github/workflows/release.yml)
GitHub workflow, driven by [`scripts/release.mjs`](scripts/release.mjs).

## How it works

1. **You set versions manually.** Bump the `version` field of each package you
   want to release (usually in a "release" PR). The tooling never bumps
   versions for you.
2. **Merge to `main`.** Because a version bump always changes a
   `packages/*/package.json`, merging triggers the `release` workflow.
3. **The script decides what to publish.** For every publishable workspace
   package it compares the local `version` against the npm registry:
   - already published → **skip**
   - new version, or package not yet on npm → **publish**
4. **It publishes in dependency order** (e.g. `@cacheable/utils` before
   `cacheable`), with provenance, using pnpm only.

Private packages and the internal `@cacheable/benchmark` harness are never
published (see `IGNORED_PACKAGES` in the script).

## Dry run

Validate a release without publishing anything — prints the plan and packs each
package via `pnpm publish --dry-run`:

```sh
node scripts/release.mjs --dry-run   # locally
```

Or run the **release** workflow manually from the Actions tab with the
**Dry run** input checked. `node scripts/release.mjs --json` emits the plan as
machine-readable JSON.

## Authentication: OIDC trusted publishing (+ provenance)

The workflow publishes **tokenlessly** via npm
[trusted publishing](https://docs.npmjs.com/trusted-publishers/) over OIDC, and
attaches a [provenance](https://docs.npmjs.com/generating-provenance-statements/)
attestation. The job grants `id-token: write`, runs on a GitHub-hosted runner,
and every package declares a matching public `repository` field — the
preconditions provenance requires.

**One-time setup on npmjs.com — for each published package** add a Trusted
Publisher under *Settings → Publishing access*:

- Provider: **GitHub Actions**
- Repository: `jaredwray/cacheable`
- Workflow filename: `release.yml`

The workflow is **fully tokenless** — there is no `NPM_TOKEN` secret. Every
published package must have a trusted publisher configured before the workflow
can publish it; until then that package's publish step fails to authenticate.

One caveat: OIDC cannot perform the *first ever* publish of a brand-new package.
When adding a new package, publish its initial version once manually (e.g.
`pnpm --filter <name> publish --access public` while logged in to npm), then add
its trusted publisher so every subsequent release flows through this workflow.
