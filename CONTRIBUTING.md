# Contributing
When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change.

Please note we have a [Code of Conduct](CODE_OF_CONDUCT.md), please follow it in all your interactions with the project.

We release new versions of this project (maintenance/features) on a monthly cadence so please be aware that some items will not get released right away. 

# Testing Environment

To do testing you need to have redis installed on your machine. Have docker installed and run the following command to start a redis container:

```bash
pnpm test:services:start
```

# Pull Request Process
You can contribute changes to this repo by opening a pull request:

1) After forking this repository to your Git account, make the proposed changes on your forked branch.
2) Run tests and linting locally by running `pnpm i && pnpm build && pnpm test`.
3) Commit your changes and push them to your forked repository.
4) Navigate to the main `cacheable` repository and select the *Pull Requests* tab.
5) Click the *New pull request* button, then select the option "Compare across forks"
6) Leave the base branch set to main. Set the compare branch to your forked branch, and open the pull request.
7) Once your pull request is created, ensure that all checks have passed and that your branch has no conflicts with the base branch. If there are any issues, resolve these changes in your local repository, and then commit and push them to git.
8) Similarly, respond to any reviewer comments or requests for changes by making edits to your local repository and pushing them to Git.
9) Once the pull request has been reviewed, those with write access to the branch will be able to merge your changes into the `main` repository branch and pushed via our release schedule.

If you need more information on the steps to create a pull request, you can find a detailed walkthrough in the [GitHub documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)

# Releasing

Maintainers publish releases to npm via the
[`release`](.github/workflows/release.yml) GitHub workflow, driven by
[`scripts/release.mjs`](scripts/release.mjs). Versions are set manually — the
tooling never bumps them.

## How it works

1. **Set versions manually.** Bump the `version` field of each package you want
   to release (usually in a "release" PR) and merge it to `main`.
2. **Publish a GitHub release.** Publishing a (non-pre) release triggers the
   `release` workflow — in lockstep with the website deploy, which also runs on
   `released`. (You can also run it manually from the Actions tab.)
3. **The script decides what to publish.** For every publishable workspace
   package it compares the local `version` against the npm registry:
   - already published → **skip**
   - new version, or package not yet on npm → **publish**
   - below the registry's `latest` → **refuse** (won't roll `latest` back)
4. **It publishes in dependency order** (e.g. `@cacheable/utils` before
   `cacheable`), with provenance, using pnpm only, aborting on the first failure.

Private packages and the internal `@cacheable/benchmark` harness are never
published (see `IGNORED_PACKAGES` in the script).

## Dry run

Validate a release without publishing anything — prints the plan and packs each
package via `pnpm publish --dry-run`:

```sh
node scripts/release.mjs --dry-run   # locally
```

Or run the **release** workflow manually from the Actions tab with the **Dry
run** input checked. `node scripts/release.mjs --json` emits the plan as
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

# Code of Conduct
Please refer to our [Code of Conduct](CODE_OF_CONDUCT.md) readme for how to contribute to this open source project and work within the community. 
