#!/usr/bin/env node
/**
 * Burn-down codemod: rewrite all `@ch5me/elf-ui/{components,hooks,lib}/*`
 * imports in apps + Storybook stories to the real upstream packages.
 *
 * The 133 elf-ui component files are fictional whole-barrel re-exports
 * (`export * from "@ch5me/ch5-ui-web"` / `@ch5me/agent-ui-web`), so a
 * subpath import already resolves to the upstream barrel. This rewrite is
 * therefore behavior-preserving: it just points consumers at the real
 * source of truth so the indirection layer can be deleted.
 *
 * Mapping (barrel -> barrel, provably equivalent to what the shim resolves to):
 *   @ch5me/elf-ui/components/ai-elements/*  -> @ch5me/agent-ui-web
 *   @ch5me/elf-ui/components/*  (incl animate/, marketing/) -> @ch5me/ch5-ui-web
 *   @ch5me/elf-ui/lib/utils          -> @ch5me/ch5-ui-web   (cn)
 *   @ch5me/elf-ui/lib/motion-tokens  -> @ch5me/ch5-ui-web
 *   @ch5me/elf-ui/hooks/*            -> @ch5me/ch5-ui-web
 *
 * Left untouched: @ch5me/elf-ui/styles/globals.css (real asset, kept).
 *
 * Usage: node scripts/codemod-elf-ui-to-upstream.mjs [--dry]
 */
import { Project } from "ts-morph"
import path from "node:path"

const DRY = process.argv.includes("--dry")
const ROOT = path.resolve(import.meta.dirname, "..")

const RULES = [
	[/^@ch5me\/elf-ui\/components\/ai-elements\/.+$/, "@ch5me/agent-ui-web"],
	[/^@ch5me\/elf-ui\/components\/.+$/, "@ch5me/ch5-ui-web"],
	[/^@ch5me\/elf-ui\/lib\/utils$/, "@ch5me/ch5-ui-web"],
	[/^@ch5me\/elf-ui\/lib\/motion-tokens$/, "@ch5me/ch5-ui-web"],
	[/^@ch5me\/elf-ui\/hooks\/.+$/, "@ch5me/ch5-ui-web"],
]

function remap(spec) {
	for (const [re, target] of RULES) if (re.test(spec)) return target
	return null
}

const project = new Project({
	tsConfigFilePath: undefined,
	skipAddingFilesFromTsConfig: true,
	compilerOptions: { allowJs: false },
})

project.addSourceFilesAtPaths([
	`${ROOT}/apps/**/*.{ts,tsx}`,
	`${ROOT}/packages/ui/src/stories/**/*.{ts,tsx}`,
	`!${ROOT}/**/node_modules/**`,
	`!${ROOT}/**/dist/**`,
])

let filesChanged = 0
let declsRewritten = 0

for (const sf of project.getSourceFiles()) {
	let touched = false

	// 1. Remap module specifiers on imports + re-exports.
	const decls = [
		...sf.getImportDeclarations(),
		...sf.getExportDeclarations(),
	]
	for (const d of decls) {
		const spec = d.getModuleSpecifierValue?.()
		if (!spec) continue
		const target = remap(spec)
		if (target && target !== spec) {
			d.setModuleSpecifier(target)
			declsRewritten++
			touched = true
		}
	}

	// 2. Merge import declarations that now share a module specifier.
	if (touched) mergeImports(sf)

	if (touched) {
		filesChanged++
		if (DRY) {
			console.log(`would change: ${path.relative(ROOT, sf.getFilePath())}`)
		}
	}
}

/** Collapse multiple ImportDeclarations from the same module into one. */
function mergeImports(sf) {
	const byModule = new Map()
	for (const imp of sf.getImportDeclarations()) {
		// only merge plain named imports (no default/namespace) — all elf-ui
		// imports are named, so anything else is left alone for safety.
		if (imp.getDefaultImport() || imp.getNamespaceImport()) continue
		const mod = imp.getModuleSpecifierValue()
		if (!byModule.has(mod)) byModule.set(mod, [])
		byModule.get(mod).push(imp)
	}
	for (const [mod, imps] of byModule) {
		if (imps.length < 2) continue
		// Collect deduped named specifiers, preserving per-specifier type-only.
		const seen = new Set()
		const merged = []
		for (const imp of imps) {
			const declTypeOnly = imp.isTypeOnly()
			for (const ni of imp.getNamedImports()) {
				const name = ni.getNameNode().getText()
				const alias = ni.getAliasNode()?.getText()
				const isTypeOnly = declTypeOnly || ni.isTypeOnly()
				const key = `${name}|${alias ?? ""}|${isTypeOnly}`
				if (seen.has(key)) continue
				seen.add(key)
				merged.push({ name, alias, isTypeOnly })
			}
		}
		const allTypeOnly = merged.every((m) => m.isTypeOnly)
		// Remove old decls, add a single merged one at the top.
		for (const imp of imps) imp.remove()
		sf.insertImportDeclaration(0, {
			isTypeOnly: allTypeOnly,
			moduleSpecifier: mod,
			namedImports: merged.map((m) => ({
				name: m.name,
				alias: m.alias,
				isTypeOnly: allTypeOnly ? false : m.isTypeOnly,
			})),
		})
	}
}

if (!DRY) project.saveSync()

console.log(
	`\n${DRY ? "[dry] " : ""}files changed: ${filesChanged}, import/export decls rewritten: ${declsRewritten}`,
)
