#!/usr/bin/env node
// Map @ch5me/elf-ui (palot/packages/ui) components to their upstream counterparts
// in @ch5me/ch5-ui-web and @ch5me/agent-ui-web, to drive the step-5 shim migration.
//
// A component file can become a compat shim (`export * from "<upstream>"`) iff the
// upstream barrel exports EVERY named symbol the local file exports. This script
// computes that coverage deterministically from the built .d.ts barrels and the
// local source, and prints the work-list grouped by classification.
//
// Usage: node scripts/map-elf-ui-shim-candidates.mjs [--json]

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve as resolvePath } from "node:path"

const HOME = process.env.HOME
const ELF_UI = join(HOME, "src/ch5/palot/packages/ui")
const CH5UI_DTS = join(HOME, "src/ch5/ch5-packages/packages/web/ch5-ui-web/dist/index.d.ts")
const AGENTUI_DTS = join(HOME, "src/ch5/ch5-packages/packages/web/agent-ui-web/dist/index.d.ts")

const asJson = process.argv.includes("--json")
const doApply = process.argv.includes("--apply")

/** Extract exported NAMES (values + types) from a .d.ts or .tsx source string. */
function extractExports(src) {
	const names = new Set()
	let isShim = false
	// `export * from "..."` — re-export-everything shim marker (no explicit names)
	if (/^\s*export\s+\*\s+from\s+["']/m.test(src)) isShim = true
	// `export { A, B as C, type D }` blocks
	for (const m of src.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) {
		for (let part of m[1].split(",")) {
			part = part.trim()
			if (!part) continue
			// handle `A as B` -> exported name is B
			const asMatch = part.match(/\bas\s+([A-Za-z0-9_$]+)/)
			const name = asMatch ? asMatch[1] : part.replace(/^type\s+/, "").trim()
			if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && name !== "default") names.add(name)
		}
	}
	// `export [declare] function/const/class/type/interface/enum NAME`
	for (const m of src.matchAll(
		/export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,
	)) {
		names.add(m[1])
	}
	return { names, isShim }
}

/** Resolve a `.d.ts` barrel into the full set of barrel-reachable names,
 * following `export * from "./rel"` re-exports (one level of file-hop, recursive). */
function dtsSymbols(path, seen = new Set()) {
	if (seen.has(path) || !existsSync(path)) return new Set()
	seen.add(path)
	const src = readFileSync(path, "utf8")
	const { names } = extractExports(src)
	for (const m of src.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/g)) {
		const spec = m[1].replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/, "")
		const target = resolvePath(dirname(path), `${spec}.d.ts`)
		for (const n of dtsSymbols(target, seen)) names.add(n)
	}
	return names
}

const CH5UI = dtsSymbols(CH5UI_DTS)
const AGENTUI = dtsSymbols(AGENTUI_DTS)

/** Recursively collect .tsx component files (skip stories). */
function collectComponents(dir) {
	const out = []
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry)
		const st = statSync(full)
		if (st.isDirectory()) out.push(...collectComponents(full))
		else if (entry.endsWith(".tsx") && !entry.endsWith(".stories.tsx")) out.push(full)
	}
	return out
}

const componentsDir = join(ELF_UI, "src/components")
const files = collectComponents(componentsDir).sort()

const buckets = {
	MIGRATED: [],
	READY_CH5UI: [],
	READY_AGENTUI: [],
	READY_MIXED: [],
	BLOCKED: [],
	NO_EXPORTS: [],
}

for (const file of files) {
	const rel = relative(ELF_UI, file)
	const src = readFileSync(file, "utf8")
	const { names, isShim } = extractExports(src)
	if (isShim) {
		buckets.MIGRATED.push({ file: rel })
		continue
	}
	const syms = [...names]
	if (syms.length === 0) {
		buckets.NO_EXPORTS.push({ file: rel })
		continue
	}
	const inCh5 = syms.filter((s) => CH5UI.has(s))
	const inAgent = syms.filter((s) => AGENTUI.has(s))
	const missing = syms.filter((s) => !CH5UI.has(s) && !AGENTUI.has(s))
	if (missing.length === 0) {
		if (inAgent.length === 0) buckets.READY_CH5UI.push({ file: rel, syms })
		else if (inCh5.length === 0) buckets.READY_AGENTUI.push({ file: rel, syms })
		else buckets.READY_MIXED.push({ file: rel, syms, inCh5, inAgent })
	} else {
		buckets.BLOCKED.push({ file: rel, syms, missing })
	}
}

if (doApply) {
	const SHIM = {
		READY_CH5UI: 'export * from "@ch5me/ch5-ui-web"\n',
		READY_AGENTUI: 'export * from "@ch5me/agent-ui-web"\n',
	}
	let n = 0
	for (const [bucket, shim] of Object.entries(SHIM)) {
		for (const e of buckets[bucket]) {
			writeFileSync(join(ELF_UI, e.file), shim)
			n++
			console.log(`shimmed ${e.file} -> ${shim.trim()}`)
		}
	}
	console.log(`\nApplied ${n} compat shims.`)
} else if (asJson) {
	console.log(JSON.stringify({ ch5uiCount: CH5UI.size, agentuiCount: AGENTUI.size, buckets }, null, 2))
} else {
	const total = files.length
	console.log(`elf-ui components: ${total} (upstream barrels: ch5-ui-web=${CH5UI.size}, agent-ui-web=${AGENTUI.size})\n`)
	const order = ["MIGRATED", "READY_CH5UI", "READY_AGENTUI", "READY_MIXED", "BLOCKED", "NO_EXPORTS"]
	for (const k of order) {
		const b = buckets[k]
		console.log(`## ${k}: ${b.length}`)
		for (const e of b) {
			if (k === "BLOCKED") console.log(`  ${e.file}  — missing: ${e.missing.join(", ")}`)
			else if (k === "READY_MIXED") console.log(`  ${e.file}  — ch5:[${e.inCh5.join(",")}] agent:[${e.inAgent.join(",")}]`)
			else console.log(`  ${e.file}`)
		}
		console.log()
	}
}
