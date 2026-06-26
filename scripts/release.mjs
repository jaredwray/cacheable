#!/usr/bin/env node
/**
 * Release orchestrator for the cacheable monorepo.
 *
 * Versions are set **manually** (each package's `version` in package.json is
 * bumped by a human / release PR). This script never changes versions. Its job
 * is to decide, for every publishable workspace package, whether the locally
 * declared version still needs to be published, and — unless running a dry run
 * — to publish the ones that do.
 *
 * How "needs publishing" is decided:
 *   1. Enumerate workspace packages with `pnpm -r ls --depth -1 --json`.
 *   2. Drop packages that are `private` or explicitly ignored (see
 *      IGNORED_PACKAGES) — these are never published to npm.
 *   3. For each remaining package, fetch its document from the npm registry:
 *        - 404            → the package has never been published   → publish
 *        - version listed → this exact version is already on npm    → skip
 *        - version absent → a newer (manually-set) version is ready → publish
 *   4. The full plan is computed before anything is published. If the registry
 *      state of any package cannot be determined (after retries), the run aborts
 *      *before* publishing anything — a release is all-or-nothing on a known
 *      plan, never a partial guess.
 *
 * Publishing happens in **dependency order** (topological sort over the
 * workspace's runtime deps): a package is always published after the workspace
 * dependencies it relies on, because pnpm rewrites each `workspace:^` reference
 * to the dependency's concrete version at publish time, and a dependent must
 * never be released ahead of a dependency it points at. If a run fails partway,
 * dependencies are already published before their dependents.
 *
 * Publishing uses pnpm only (never npm) with provenance, so packages are
 * cryptographically linked to this repo + workflow when run from CI with an
 * OIDC `id-token: write` permission:
 *
 *     pnpm --filter <name> publish --provenance --access public --no-git-checks
 *
 * Usage:
 *   node scripts/release.mjs              # publish every package whose version is new
 *   node scripts/release.mjs --dry-run    # print the plan + validate packaging, publish nothing
 *   node scripts/release.mjs --json       # emit the plan as JSON (implies no publishing noise)
 *
 * Environment:
 *   NPM_CONFIG_REGISTRY   override the registry queried + published to (default: npmjs.org)
 *   GITHUB_STEP_SUMMARY   when set, a markdown summary table is appended to it
 *   GITHUB_OUTPUT         when set, `published-count` / `published-packages` outputs are written
 *
 * Exit codes: 0 = success (including "nothing to publish"); non-zero = a registry
 * lookup or a publish failed.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const REGISTRY = (process.env.NPM_CONFIG_REGISTRY || "https://registry.npmjs.org").replace(/\/$/, "");

/**
 * Packages that live in the workspace and are *not* marked `private`, yet should
 * never be published to npm. Keep this list small and documented — removing a
 * name here is all it takes to start publishing that package.
 */
const IGNORED_PACKAGES = new Set([
	// Internal benchmarking harness — run from source, never distributed on npm.
	"@cacheable/benchmark",
]);

function parseArgs(argv) {
	const args = { dryRun: false, json: false, help: false };
	for (const arg of argv) {
		switch (arg) {
			case "--dry-run":
			case "-d":
				args.dryRun = true;
				break;
			case "--json":
				args.json = true;
				break;
			case "--help":
			case "-h":
				args.help = true;
				break;
			default:
				console.error(`Unknown argument: ${arg}`);
				process.exit(2);
		}
	}

	return args;
}

const HELP = `Release orchestrator for the cacheable monorepo.

Usage:
  node scripts/release.mjs            Publish every package whose version is not yet on npm
  node scripts/release.mjs --dry-run  Print the plan and validate packaging without publishing
  node scripts/release.mjs --json     Emit the publish plan as JSON

Versions are set manually; this script never bumps them.`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Enumerate publishable workspace packages via pnpm (respects pnpm-workspace.yaml). */
function listWorkspacePackages() {
	const result = spawnSync("pnpm", ["-r", "ls", "--depth", "-1", "--json"], {
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
	});

	if (result.status !== 0) {
		throw new Error(`\`pnpm -r ls\` failed: ${result.stderr || result.stdout || result.error?.message}`);
	}

	/** @type {Array<{name:string,version:string,path:string,private?:boolean}>} */
	const entries = JSON.parse(result.stdout);

	return entries
		.filter((pkg) => pkg.name && pkg.version)
		.filter((pkg) => pkg.private !== true)
		.filter((pkg) => !IGNORED_PACKAGES.has(pkg.name))
		.map((pkg) => ({ name: pkg.name, version: pkg.version, path: pkg.path }));
}

/** Read the workspace packages a given package depends on at runtime. */
function readInternalDeps(pkg, workspaceNames) {
	const manifest = JSON.parse(readFileSync(path.join(pkg.path, "package.json"), "utf8"));
	// Only runtime-facing deps are rewritten into the published manifest and
	// thus constrain publish order — devDependencies are not installed by
	// consumers, so a dev-only `workspace:` link never affects ordering.
	const deps = {
		...manifest.dependencies,
		...manifest.optionalDependencies,
		...manifest.peerDependencies,
	};
	return Object.keys(deps).filter((dep) => workspaceNames.has(dep));
}

/**
 * Order packages so every package comes after the workspace dependencies it
 * relies on (Kahn's algorithm; alphabetical within a tier for determinism).
 * Throws on a dependency cycle.
 */
function orderByDependencies(packages) {
	const workspaceNames = new Set(packages.map((pkg) => pkg.name));
	const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
	const deps = new Map(packages.map((pkg) => [pkg.name, new Set(readInternalDeps(pkg, workspaceNames))]));

	const ordered = [];
	const emitted = new Set();
	let remaining = packages.map((pkg) => pkg.name).sort();

	while (remaining.length > 0) {
		const ready = remaining.filter((name) => [...deps.get(name)].every((dep) => emitted.has(dep)));
		if (ready.length === 0) {
			throw new Error(`dependency cycle among workspace packages: ${remaining.join(", ")}`);
		}

		for (const name of ready) {
			ordered.push(byName.get(name));
			emitted.add(name);
		}

		remaining = remaining.filter((name) => !emitted.has(name));
	}

	return ordered;
}

/** Fetch a package's document from the registry, with retry + backoff. 404 → null. */
async function fetchRegistryDoc(name, { retries = 4 } = {}) {
	const url = `${REGISTRY}/${name.replace("/", "%2F")}`;
	let lastError;

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const res = await fetch(url, { headers: { accept: "application/json" } });
			if (res.status === 404) {
				return null;
			}

			if (!res.ok) {
				throw new Error(`registry responded ${res.status}`);
			}

			return await res.json();
		} catch (error) {
			lastError = error;
			if (attempt < retries) {
				await sleep(2 ** attempt * 1000); // 1s, 2s, 4s, 8s
			}
		}
	}

	throw new Error(`failed to query the registry for ${name}: ${lastError?.message ?? lastError}`);
}

/** Resolve whether a single package needs publishing. */
async function resolvePlanEntry(pkg) {
	const doc = await fetchRegistryDoc(pkg.name);

	if (doc === null) {
		return { ...pkg, registryVersion: null, action: "publish", reason: "not yet on npm" };
	}

	const publishedVersions = new Set(Object.keys(doc.versions ?? {}));
	const latest = doc["dist-tags"]?.latest ?? null;

	if (publishedVersions.has(pkg.version)) {
		return { ...pkg, registryVersion: latest, action: "skip", reason: "already published" };
	}

	return { ...pkg, registryVersion: latest, action: "publish", reason: `new version (registry latest ${latest ?? "none"})` };
}

/** Build the full plan up front; throws if any package's state can't be determined. */
async function buildPlan(packages) {
	return Promise.all(packages.map((pkg) => resolvePlanEntry(pkg)));
}

function renderTable(plan) {
	const rows = plan.map((entry) => ({
		package: entry.name,
		local: entry.version,
		registry: entry.registryVersion ?? "—",
		action: entry.action.toUpperCase(),
	}));

	const headers = ["package", "local", "registry", "action"];
	const widths = headers.map((header) =>
		Math.max(header.length, ...rows.map((row) => String(row[header]).length)),
	);
	const line = (cols) => cols.map((col, i) => String(col).padEnd(widths[i])).join("  ");

	console.log(line(headers));
	console.log(widths.map((width) => "-".repeat(width)).join("  "));
	for (const row of rows) {
		console.log(line(headers.map((header) => row[header])));
	}
}

function writeStepSummary(plan, { dryRun }) {
	if (!process.env.GITHUB_STEP_SUMMARY) {
		return;
	}

	const title = dryRun ? "Release plan (dry run)" : "Release";
	const lines = [
		`## ${title}`,
		"",
		"| Package | Local | Registry | Action |",
		"| --- | --- | --- | --- |",
		...plan.map(
			(entry) =>
				`| \`${entry.name}\` | ${entry.version} | ${entry.registryVersion ?? "—"} | ${entry.action} |`,
		),
		"",
	];
	appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
}

function writeOutputs(published) {
	if (!process.env.GITHUB_OUTPUT) {
		return;
	}

	const names = published.map((entry) => entry.name);
	appendFileSync(
		process.env.GITHUB_OUTPUT,
		`published-count=${names.length}\npublished-packages=${names.join(",")}\n`,
	);
}

/** Publish a single package with pnpm + provenance. Returns true on success. */
function publishPackage(entry, { dryRun }) {
	const args = ["--filter", entry.name, "publish", "--access", "public", "--no-git-checks"];

	// Provenance attestations require the CI OIDC token; only meaningful for a
	// real publish. A dry run just validates the tarball/packaging locally.
	if (dryRun) {
		args.push("--dry-run");
	} else {
		args.push("--provenance");
	}

	console.log(`\n$ pnpm ${args.join(" ")}`);
	const result = spawnSync("pnpm", args, { stdio: "inherit" });
	return result.status === 0;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(HELP);
		return;
	}

	const packages = orderByDependencies(listWorkspacePackages());
	const plan = await buildPlan(packages);

	if (args.json) {
		console.log(JSON.stringify(plan, null, 2));
		return;
	}

	console.log(`Registry: ${REGISTRY}\n`);
	renderTable(plan);
	writeStepSummary(plan, { dryRun: args.dryRun });

	const toPublish = plan.filter((entry) => entry.action === "publish");

	if (toPublish.length === 0) {
		console.log("\nNothing to publish — every package is already at its registry version.");
		writeOutputs([]);
		return;
	}

	console.log(
		`\n${args.dryRun ? "[dry run] would publish" : "Publishing"} ${toPublish.length} package(s): ${toPublish
			.map((entry) => `${entry.name}@${entry.version}`)
			.join(", ")}`,
	);

	const published = [];
	const failed = [];
	for (const entry of toPublish) {
		const ok = publishPackage(entry, { dryRun: args.dryRun });
		(ok ? published : failed).push(entry);
	}

	if (!args.dryRun) {
		writeOutputs(published);
	}

	console.log("");
	if (failed.length > 0) {
		console.error(`Failed to publish ${failed.length} package(s):`);
		for (const entry of failed) {
			console.error(`  - ${entry.name}@${entry.version}`);
		}

		process.exit(1);
	}

	console.log(
		args.dryRun
			? `Dry run complete — ${toPublish.length} package(s) would be published.`
			: `Published ${published.length} package(s) successfully.`,
	);
}

main().catch((error) => {
	console.error(error.message ?? error);
	process.exit(1);
});
