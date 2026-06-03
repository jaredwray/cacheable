#!/usr/bin/env node
/**
 * Build validation harness for the cacheable monorepo.
 *
 * After packages are built (tsdown / tsc) this script validates, for every
 * publishable package, that the generated `dist/` output actually works for
 * real ESM and CJS consumers:
 *
 *   1. Exports-path existence — every file referenced by the package's
 *      `exports` map (and `main`/`module`/`types`) exists on disk.
 *   2. Runtime load + export parity — the built ESM bundle can be `import()`ed
 *      and the CJS bundle `require()`d, both expose ≥1 export, and their named
 *      + default exports match.
 *   3. Packaging + types — `publint` reports no errors and
 *      `@arethetypeswrong/cli` (attw) finds no type-resolution problems.
 *
 * Run via `pnpm test:build` (builds first) or directly with `node
 * scripts/test-build.mjs` when packages are already built. Exits non-zero if
 * any package fails any check; all packages are checked even when one fails.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { publint } from "publint";
import { formatMessage } from "publint/utils";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "../..");
const packagesDir = path.join(rootDir, "packages");
const require = createRequire(import.meta.url);

/** Collect every string value nested inside an exports/condition object. */
function collectExportTargets(value, out = []) {
	if (typeof value === "string") {
		if (value.startsWith(".")) {
			out.push(value);
		}
	} else if (value && typeof value === "object") {
		for (const nested of Object.values(value)) {
			collectExportTargets(nested, out);
		}
	}

	return out;
}

/** Resolve the runtime entry for a given condition ("import" | "require"). */
function resolveConditionEntry(pkg, condition) {
	const exportsField = pkg.exports;

	// Simple string form (e.g. cacheable-request: "exports": "./dist/index.js").
	if (typeof exportsField === "string") {
		return condition === "import" ? exportsField : undefined;
	}

	const root =
		exportsField && typeof exportsField === "object"
			? (exportsField["."] ?? exportsField)
			: undefined;

	const branch = root?.[condition];
	if (typeof branch === "string") {
		return branch;
	}

	if (branch && typeof branch === "object") {
		return branch.default ?? branch.node ?? undefined;
	}

	// Fall back to legacy fields when no conditional export exists.
	if (condition === "import") {
		return pkg.module ?? (typeof exportsField === "string" ? exportsField : undefined);
	}

	return pkg.main;
}

function checkExportPaths(pkgDir, pkg) {
	const errors = [];
	const targets = new Set();

	collectExportTargets(pkg.exports, [...targets]).forEach((t) => targets.add(t));
	for (const field of ["main", "module", "types"]) {
		if (typeof pkg[field] === "string") {
			targets.add(pkg[field]);
		}
	}

	for (const target of targets) {
		const abs = path.resolve(pkgDir, target);
		if (!existsSync(abs)) {
			errors.push(`referenced file does not exist: ${target}`);
		}
	}

	if (targets.size === 0) {
		errors.push("package declares no exports/main/module/types to validate");
	}

	return errors;
}

async function checkRuntime(pkgDir, pkg) {
	const errors = [];

	const esmTarget = resolveConditionEntry(pkg, "import");
	const cjsTarget = resolveConditionEntry(pkg, "require");

	let esmKeys;
	let esmHasDefault;
	if (esmTarget) {
		try {
			const url = pathToFileURL(path.resolve(pkgDir, esmTarget)).href;
			const ns = await import(url);
			const keys = Object.keys(ns).filter((k) => k !== "default");
			esmKeys = new Set(keys);
			esmHasDefault = "default" in ns;
			if (keys.length === 0 && !esmHasDefault) {
				errors.push(`ESM bundle (${esmTarget}) exposes no exports`);
			}
		} catch (error) {
			errors.push(`failed to import ESM bundle (${esmTarget}): ${error.message}`);
		}
	} else {
		errors.push("no ESM entry could be resolved from exports");
	}

	if (cjsTarget) {
		try {
			const mod = require(path.resolve(pkgDir, cjsTarget));
			const keys = Object.keys(mod).filter((k) => k !== "default");
			const cjsHasDefault = "default" in mod;
			// A CJS module that re-exports a default may surface it as the
			// module itself; treat a non-plain export object as "has default".
			if (keys.length === 0 && !cjsHasDefault && typeof mod !== "object") {
				errors.push(`CJS bundle (${cjsTarget}) exposes no exports`);
			}

			// Parity: named exports must match between ESM and CJS.
			if (esmKeys) {
				const cjsKeys = new Set(keys);
				const missingInCjs = [...esmKeys].filter((k) => !cjsKeys.has(k));
				const missingInEsm = [...cjsKeys].filter((k) => !esmKeys.has(k));
				if (missingInCjs.length > 0) {
					errors.push(`named exports present in ESM but missing in CJS: ${missingInCjs.join(", ")}`);
				}

				if (missingInEsm.length > 0) {
					errors.push(`named exports present in CJS but missing in ESM: ${missingInEsm.join(", ")}`);
				}

				if (esmHasDefault !== cjsHasDefault) {
					errors.push(`default export mismatch: ESM ${esmHasDefault ? "has" : "lacks"} default, CJS ${cjsHasDefault ? "has" : "lacks"} default`);
				}
			}
		} catch (error) {
			errors.push(`failed to require CJS bundle (${cjsTarget}): ${error.message}`);
		}
	}
	// No CJS target → ESM-only package (e.g. cacheable-request); nothing to compare.

	return errors;
}

async function checkPublint(pkgDir) {
	const { messages } = await publint({ pkgDir, level: "error" });
	const pkg = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));
	return messages
		.filter((m) => m.type === "error")
		.map((m) => formatMessage(m, pkg))
		.filter(Boolean);
}

const attwPkg = require("@arethetypeswrong/cli/package.json");
const attwBin = path.resolve(
	path.dirname(require.resolve("@arethetypeswrong/cli/package.json")),
	attwPkg.bin.attw,
);

function checkAttw(pkgDir, pkg) {
	// Packages with no `require`/CJS entry are intentionally ESM-only (e.g.
	// cacheable-request); the esm-only profile avoids false "CJS resolves to
	// ESM" failures while still validating type resolution.
	const isEsmOnly = !resolveConditionEntry(pkg, "require");
	const args = [attwBin, "--pack", pkgDir, "--format", "table", "--no-color"];
	if (isEsmOnly) {
		args.push("--profile", "esm-only");
	}

	const result = spawnSync(process.execPath, args, { cwd: pkgDir, encoding: "utf8" });

	if (result.status === 0) {
		return [];
	}

	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
	return [output || `attw exited with status ${result.status}`];
}

async function main() {
	const pkgDirs = readdirSync(packagesDir)
		.map((name) => path.join(packagesDir, name))
		.filter((dir) => existsSync(path.join(dir, "package.json")));

	const failures = [];

	for (const pkgDir of pkgDirs.sort()) {
		const pkg = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));

		// Skip non-published packages and internal tools that produce no build
		// output (e.g. website is private, benchmark has a no-op build).
		if (pkg.private === true || !existsSync(path.join(pkgDir, "dist"))) {
			console.log(`\n${pkg.name}\n  - skipped (no published dist output)`);
			continue;
		}

		const checks = {
			"export paths": checkExportPaths(pkgDir, pkg),
			runtime: await checkRuntime(pkgDir, pkg),
			publint: await checkPublint(pkgDir),
			attw: checkAttw(pkgDir, pkg),
		};

		console.log(`\n${pkg.name}`);
		for (const [label, errors] of Object.entries(checks)) {
			if (errors.length === 0) {
				console.log(`  ✓ ${label}`);
			} else {
				console.log(`  ✗ ${label}`);
				for (const error of errors) {
					console.log(`      ${error.split("\n").join("\n      ")}`);
				}

				failures.push(`${pkg.name} → ${label}`);
			}
		}
	}

	console.log("");
	if (failures.length > 0) {
		console.error(`Build validation failed (${failures.length}):`);
		for (const failure of failures) {
			console.error(`  - ${failure}`);
		}

		process.exit(1);
	}

	console.log("Build validation passed for all packages.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
