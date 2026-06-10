#!/usr/bin/env bun
/**
 * Firefly Plugin System V2 — per-plugin build pipeline (plan task T3).
 *
 * Builds the disk-catalog artifacts for every plugin directory under
 * `apps/desktop/plugins/*` into `apps/desktop/out/plugins/`, which
 * electron-builder ships as `<resources>/plugins` (extraResources) —
 * the exact root the catalog's disk loader and the worker supervisor
 * scan in a packaged app.
 *
 * Trust split (locked by the V2 plan):
 *   - `trust: "built-in"` plugins keep TypeScript manifests (the
 *     manifest is code) and their PANELS ride electron-vite lazy
 *     renderer chunks — no manifest.json is emitted (the disk loader
 *     quarantines disk manifests claiming built-in trust). Their WORKER
 *     entries, when present (`worker/index.ts`), ARE emitted: workers
 *     are disk artifacts the supervisor spawns by path.
 *   - non-built-in plugins ship `manifest.json` (the JSON profile) and
 *     get manifest.json copied + `worker.mjs` / `panel.mjs` bundled.
 *     A non-built-in dir shipping only manifest.ts is an error: the
 *     JSON profile is the third-party contract.
 *
 * Always writes `out/plugins/build-summary.json` so packaging is
 * deterministic even with zero disk plugins. Every validation failure
 * exits 1 — same fail-fast contract as the validator.
 */

import * as fs from "node:fs"
import * as path from "node:path"

import { safeParseJsonPluginManifest } from "../apps/desktop/src/shared/firefly-plugin/json-manifest"
import {
	type PluginManifest,
	parsePluginManifest,
} from "../apps/desktop/src/shared/firefly-plugin/manifest"

const REPO_ROOT = path.resolve(import.meta.dir, "..")
const PLUGINS_SRC_ROOT = path.join(REPO_ROOT, "apps", "desktop", "plugins")
const PLUGINS_OUT_ROOT = path.join(REPO_ROOT, "apps", "desktop", "out", "plugins")

interface BuiltPluginSummary {
	pluginId: string
	trust: string
	source: "manifest.ts" | "manifest.json"
	artifacts: string[]
}

function fail(message: string): never {
	console.error(`build-plugins FAILED: ${message}`)
	process.exit(1)
}

function looksLikeV2Manifest(value: unknown): value is PluginManifest {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { apiVersion?: unknown }).apiVersion === "firefly.plugin/v2" &&
		(value as { kind?: unknown }).kind === "PluginManifest"
	)
}

async function loadTsManifest(manifestPath: string): Promise<PluginManifest> {
	const moduleExports = (await import(manifestPath)) as Record<string, unknown>
	const manifests = Object.values(moduleExports).filter(looksLikeV2Manifest)
	if (manifests.length !== 1) {
		fail(
			`${path.relative(REPO_ROOT, manifestPath)} must export exactly one V2 manifest (found ${manifests.length})`,
		)
	}
	return parsePluginManifest(manifests[0])
}

function loadJsonManifest(manifestPath: string): PluginManifest {
	const raw: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
	const parsed = safeParseJsonPluginManifest(raw)
	if (!parsed.manifest) {
		const detail = parsed.issues
			.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
			.join("; ")
		fail(`${path.relative(REPO_ROOT, manifestPath)} rejected: ${detail}`)
	}
	return parsed.manifest
}

function findEntry(directory: string, candidates: string[]): string | null {
	for (const candidate of candidates) {
		const candidatePath = path.join(directory, candidate)
		if (fs.existsSync(candidatePath)) return candidatePath
	}
	return null
}

async function bundle(entryPath: string, outFile: string, external: string[]): Promise<void> {
	const result = await Bun.build({
		entrypoints: [entryPath],
		target: "node",
		format: "esm",
		external,
		minify: false,
	})
	if (!result.success || result.outputs.length === 0) {
		const messages = result.logs.map((log) => log.message).join("; ")
		fail(`bundling ${path.relative(REPO_ROOT, entryPath)}: ${messages || "no output"}`)
	}
	fs.mkdirSync(path.dirname(outFile), { recursive: true })
	fs.writeFileSync(outFile, await result.outputs[0].text())
}

async function buildPluginDir(directory: string): Promise<BuiltPluginSummary> {
	const tsManifestPath = path.join(directory, "manifest.ts")
	const jsonManifestPath = path.join(directory, "manifest.json")
	const hasTs = fs.existsSync(tsManifestPath)
	const hasJson = fs.existsSync(jsonManifestPath)
	if (!hasTs && !hasJson) {
		fail(`${path.relative(REPO_ROOT, directory)} has neither manifest.ts nor manifest.json`)
	}

	const manifest = hasJson
		? loadJsonManifest(jsonManifestPath)
		: await loadTsManifest(tsManifestPath)
	const builtIn = manifest.trust === "built-in"
	if (builtIn && hasJson) {
		fail(
			`${manifest.id}: built-in plugins must use a TypeScript manifest (disk manifest.json claiming built-in trust is quarantined by the catalog)`,
		)
	}
	if (!builtIn && !hasJson) {
		fail(
			`${manifest.id}: non-built-in plugins must ship manifest.json — the JSON profile is the third-party contract`,
		)
	}

	const outDir = path.join(PLUGINS_OUT_ROOT, manifest.id)
	const artifacts: string[] = []

	const workerEntry = findEntry(directory, [
		path.join("worker", "index.ts"),
		path.join("worker", "index.mjs"),
		"worker.mjs",
	])
	if (workerEntry) {
		await bundle(workerEntry, path.join(outDir, "worker.mjs"), [])
		artifacts.push("worker.mjs")
	}

	if (!builtIn) {
		fs.mkdirSync(outDir, { recursive: true })
		fs.copyFileSync(jsonManifestPath, path.join(outDir, "manifest.json"))
		artifacts.push("manifest.json")
		const panelEntry = findEntry(directory, [
			path.join("panel", "index.tsx"),
			path.join("panel", "index.ts"),
		])
		if (panelEntry) {
			await bundle(panelEntry, path.join(outDir, "panel.mjs"), [
				"react",
				"react-dom",
				"react/jsx-runtime",
			])
			artifacts.push("panel.mjs")
		}
	}

	return {
		pluginId: manifest.id,
		trust: manifest.trust,
		source: hasJson ? "manifest.json" : "manifest.ts",
		artifacts,
	}
}

async function main(): Promise<void> {
	fs.rmSync(PLUGINS_OUT_ROOT, { recursive: true, force: true })
	fs.mkdirSync(PLUGINS_OUT_ROOT, { recursive: true })

	const directories = fs.existsSync(PLUGINS_SRC_ROOT)
		? fs
				.readdirSync(PLUGINS_SRC_ROOT)
				.map((child) => path.join(PLUGINS_SRC_ROOT, child))
				.filter((child) => fs.statSync(child).isDirectory())
				.sort()
		: []

	const plugins: BuiltPluginSummary[] = []
	for (const directory of directories) {
		plugins.push(await buildPluginDir(directory))
	}

	const summary = {
		builtAt: new Date().toISOString(),
		pluginsRoot: path.relative(REPO_ROOT, PLUGINS_SRC_ROOT),
		plugins,
	}
	fs.writeFileSync(
		path.join(PLUGINS_OUT_ROOT, "build-summary.json"),
		`${JSON.stringify(summary, null, "\t")}\n`,
	)

	const diskCount = plugins.filter((plugin) => plugin.artifacts.includes("manifest.json")).length
	console.log(
		`build-plugins OK: ${plugins.length} plugin(s) validated, ${diskCount} disk plugin(s) emitted, ${plugins.filter((p) => p.artifacts.includes("worker.mjs")).length} worker bundle(s) → ${path.relative(REPO_ROOT, PLUGINS_OUT_ROOT)}`,
	)
}

await main()
