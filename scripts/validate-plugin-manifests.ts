#!/usr/bin/env bun
/**
 * Firefly Plugin System V2 — manifest validation gate (plan task T3).
 *
 * Validates every plugin directory under `apps/desktop/plugins/*`:
 *   - `manifest.ts`  (built-in TS profile): imported and every exported
 *     V2 manifest object is run through `parsePluginManifest` — the same
 *     Zod schema the catalog enforces at boot.
 *   - `manifest.json` (third-party JSON profile): parsed through
 *     `safeParseJsonPluginManifest` — the same boundary parser the disk
 *     loader uses.
 *
 * A manifest that does not parse FAILS the run (exit 1) with its typed
 * issues — the schema IS the contract; there is no lenient mode. Wired
 * into `bun run lint` in apps/desktop so CI rejects a bad manifest.
 *
 * Usage:
 *   bun scripts/validate-plugin-manifests.ts            # default root
 *   bun scripts/validate-plugin-manifests.ts --root DIR # override (tests)
 */

import * as fs from "node:fs"
import * as path from "node:path"

import { safeParseJsonPluginManifest } from "../apps/desktop/src/shared/firefly-plugin/json-manifest"
import { parsePluginManifest } from "../apps/desktop/src/shared/firefly-plugin/manifest"

const REPO_ROOT = path.resolve(import.meta.dir, "..")
const DEFAULT_PLUGINS_ROOT = path.join(REPO_ROOT, "apps", "desktop", "plugins")

interface ValidationFailure {
	directory: string
	manifestPath: string
	message: string
}

function parseArgs(argv: string[]): { roots: string[] } {
	const roots: string[] = []
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === "--root") {
			const value = argv[i + 1]
			if (!value) {
				console.error("--root requires a directory argument")
				process.exit(2)
			}
			roots.push(path.resolve(value))
			i += 1
		}
	}
	return { roots: roots.length > 0 ? roots : [DEFAULT_PLUGINS_ROOT] }
}

function looksLikeV2Manifest(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { apiVersion?: unknown }).apiVersion === "firefly.plugin/v2" &&
		(value as { kind?: unknown }).kind === "PluginManifest"
	)
}

async function validateTsManifest(
	directory: string,
	manifestPath: string,
	failures: ValidationFailure[],
): Promise<number> {
	let moduleExports: Record<string, unknown>
	try {
		moduleExports = (await import(manifestPath)) as Record<string, unknown>
	} catch (err) {
		failures.push({
			directory,
			manifestPath,
			message: `manifest.ts failed to import: ${err instanceof Error ? err.message : String(err)}`,
		})
		return 0
	}
	const candidates = Object.entries(moduleExports).filter(([, value]) => looksLikeV2Manifest(value))
	if (candidates.length === 0) {
		failures.push({
			directory,
			manifestPath,
			message: "manifest.ts exports no firefly.plugin/v2 PluginManifest object",
		})
		return 0
	}
	let validated = 0
	for (const [exportName, value] of candidates) {
		try {
			parsePluginManifest(value)
			validated += 1
		} catch (err) {
			failures.push({
				directory,
				manifestPath,
				message: `export "${exportName}" failed V2 schema parse: ${err instanceof Error ? err.message : String(err)}`,
			})
		}
	}
	return validated
}

function validateJsonManifest(
	directory: string,
	manifestPath: string,
	failures: ValidationFailure[],
): number {
	let raw: unknown
	try {
		raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
	} catch (err) {
		failures.push({
			directory,
			manifestPath,
			message: `manifest.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
		})
		return 0
	}
	const parsed = safeParseJsonPluginManifest(raw)
	if (!parsed.manifest) {
		for (const issue of parsed.issues) {
			failures.push({
				directory,
				manifestPath,
				message: `${issue.path.join(".") || "(root)"}: ${issue.message}`,
			})
		}
		return 0
	}
	return 1
}

async function main(): Promise<void> {
	const { roots } = parseArgs(process.argv.slice(2))
	const failures: ValidationFailure[] = []
	let validatedCount = 0
	let directoryCount = 0

	for (const root of roots) {
		if (!fs.existsSync(root)) continue
		const children = fs
			.readdirSync(root)
			.map((child) => path.join(root, child))
			.filter((child) => fs.statSync(child).isDirectory())
			.sort()
		for (const directory of children) {
			directoryCount += 1
			const tsManifest = path.join(directory, "manifest.ts")
			const jsonManifest = path.join(directory, "manifest.json")
			const hasTs = fs.existsSync(tsManifest)
			const hasJson = fs.existsSync(jsonManifest)
			if (!hasTs && !hasJson) {
				failures.push({
					directory,
					manifestPath: directory,
					message: "plugin directory has neither manifest.ts nor manifest.json",
				})
				continue
			}
			if (hasTs) validatedCount += await validateTsManifest(directory, tsManifest, failures)
			if (hasJson) validatedCount += validateJsonManifest(directory, jsonManifest, failures)
		}
	}

	if (failures.length > 0) {
		console.error(`plugin manifest validation FAILED (${failures.length} issue(s)):`)
		for (const failure of failures) {
			console.error(`  - ${path.relative(REPO_ROOT, failure.manifestPath)}: ${failure.message}`)
		}
		process.exit(1)
	}
	console.log(
		`plugin manifests OK: ${validatedCount} manifest(s) across ${directoryCount} plugin dir(s) in ${roots.length} root(s)`,
	)
}

await main()
