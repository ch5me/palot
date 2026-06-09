/**
 * Firefly Plugin System V2 — JSON manifest profile (disk-loadable plugins)
 *
 * The canonical TS manifest (`manifest.ts`) allows live Zod nodes in
 * `contributes.tools[].args`, which cannot ship as a JSON file. Built-in
 * plugins keep TypeScript manifests (compiled per-plugin, the manifest is
 * code). Third-party / disk-loaded plugins ship `manifest.json` in the
 * JSON profile defined here: identical shape, except each tool's `args`
 * is a JSON-Schema object fragment that this module converts to a Zod
 * raw shape at the catalog boundary.
 *
 * Both paths produce identical `PluginManifest` values, so descriptor
 * derivation and every projection stay single-path (the V2 acceptance
 * criterion "first-party and third-party plugins use the SAME runtime
 * path").
 *
 * Conversion is strict and fails fast: unsupported JSON-Schema keywords
 * ($ref, oneOf, anyOf, allOf, …) are rejected with a typed error naming
 * the offending path — never silently dropped.
 */

import { z } from "zod"

import { parsePluginManifest, type PluginManifest } from "./manifest"

// ---------------------------------------------------------------------------
// JSON-Schema fragment subset
// ---------------------------------------------------------------------------

/** Keywords we explicitly support per fragment type. Anything else rejects. */
const SUPPORTED_COMMON_KEYS = new Set(["type", "description"])
const SUPPORTED_KEYS_BY_TYPE: Record<string, ReadonlySet<string>> = {
	string: new Set([...SUPPORTED_COMMON_KEYS, "enum", "format", "minLength", "maxLength", "pattern"]),
	number: new Set([...SUPPORTED_COMMON_KEYS, "minimum", "maximum"]),
	integer: new Set([...SUPPORTED_COMMON_KEYS, "minimum", "maximum"]),
	boolean: new Set([...SUPPORTED_COMMON_KEYS]),
	array: new Set([...SUPPORTED_COMMON_KEYS, "items", "minItems", "maxItems"]),
	object: new Set([...SUPPORTED_COMMON_KEYS, "properties", "required", "additionalProperties"]),
}

export interface JsonManifestIssue {
	readonly path: (string | number)[]
	readonly message: string
}

export class JsonManifestError extends Error {
	readonly issues: readonly JsonManifestIssue[]
	constructor(issues: readonly JsonManifestIssue[]) {
		super(`JSON plugin manifest rejected: ${issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`)
		this.name = "JsonManifestError"
		this.issues = issues
	}
}

interface JsonSchemaObjectFragment {
	readonly type: "object"
	readonly properties?: Record<string, unknown>
	readonly required?: readonly string[]
	readonly additionalProperties?: boolean
	readonly description?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Convert one JSON-Schema fragment to a Zod node. Throws
 * `JsonManifestError` (single issue) on anything outside the supported
 * subset. Pure.
 */
export function jsonSchemaFragmentToZod(fragment: unknown, path: (string | number)[]): z.ZodTypeAny {
	if (!isRecord(fragment)) {
		throw new JsonManifestError([{ path, message: "schema fragment must be an object" }])
	}
	const type = fragment.type
	if (typeof type !== "string" || !(type in SUPPORTED_KEYS_BY_TYPE)) {
		throw new JsonManifestError([
			{
				path,
				message: `unsupported or missing "type" (${JSON.stringify(type)}); supported: ${Object.keys(SUPPORTED_KEYS_BY_TYPE).join(", ")}`,
			},
		])
	}
	const allowed = SUPPORTED_KEYS_BY_TYPE[type]
	for (const key of Object.keys(fragment)) {
		if (!allowed.has(key)) {
			throw new JsonManifestError([
				{ path: [...path, key], message: `unsupported JSON-Schema keyword "${key}" for type "${type}"` },
			])
		}
	}

	switch (type) {
		case "string": {
			if (Array.isArray(fragment.enum)) {
				const values = fragment.enum
				if (values.length === 0 || !values.every((v): v is string => typeof v === "string")) {
					throw new JsonManifestError([
						{ path: [...path, "enum"], message: "enum must be a non-empty array of strings" },
					])
				}
				return z.enum(values as [string, ...string[]])
			}
			let node = z.string()
			if (fragment.format === "uri" || fragment.format === "url") node = node.url()
			else if (fragment.format !== undefined) {
				throw new JsonManifestError([
					{ path: [...path, "format"], message: `unsupported string format "${String(fragment.format)}"` },
				])
			}
			if (typeof fragment.minLength === "number") node = node.min(fragment.minLength)
			if (typeof fragment.maxLength === "number") node = node.max(fragment.maxLength)
			if (typeof fragment.pattern === "string") node = node.regex(new RegExp(fragment.pattern, "u"))
			return node
		}
		case "number":
		case "integer": {
			let node = z.number()
			if (type === "integer") node = node.int()
			if (typeof fragment.minimum === "number") node = node.min(fragment.minimum)
			if (typeof fragment.maximum === "number") node = node.max(fragment.maximum)
			return node
		}
		case "boolean":
			return z.boolean()
		case "array": {
			if (fragment.items === undefined) {
				throw new JsonManifestError([{ path: [...path, "items"], message: "array fragment requires items" }])
			}
			let node = z.array(jsonSchemaFragmentToZod(fragment.items, [...path, "items"]))
			if (typeof fragment.minItems === "number") node = node.min(fragment.minItems)
			if (typeof fragment.maxItems === "number") node = node.max(fragment.maxItems)
			return node
		}
		case "object": {
			const objectFragment = fragment as unknown as JsonSchemaObjectFragment
			const shape = jsonSchemaObjectToRawShape(objectFragment, path)
			return z.object(shape)
		}
		default:
			throw new JsonManifestError([{ path, message: `unreachable type "${type}"` }])
	}
}

/**
 * Convert a JSON-Schema `{type:"object"}` fragment into a Zod raw shape
 * (the form `contributes.tools[].args` requires). Optionality derives
 * from the `required` array, exactly like JSON Schema semantics.
 */
export function jsonSchemaObjectToRawShape(
	fragment: unknown,
	path: (string | number)[],
): Record<string, z.ZodTypeAny> {
	if (!isRecord(fragment) || fragment.type !== "object") {
		throw new JsonManifestError([
			{ path, message: 'tool args must be a JSON-Schema fragment with type "object"' },
		])
	}
	const properties = fragment.properties
	if (properties !== undefined && !isRecord(properties)) {
		throw new JsonManifestError([{ path: [...path, "properties"], message: "properties must be an object" }])
	}
	const required = fragment.required
	if (required !== undefined && (!Array.isArray(required) || !required.every((r) => typeof r === "string"))) {
		throw new JsonManifestError([
			{ path: [...path, "required"], message: "required must be an array of strings" },
		])
	}
	const requiredSet = new Set((required as readonly string[] | undefined) ?? [])
	for (const name of requiredSet) {
		if (!properties || !(name in properties)) {
			throw new JsonManifestError([
				{ path: [...path, "required"], message: `required property "${name}" is not declared in properties` },
			])
		}
	}
	const shape: Record<string, z.ZodTypeAny> = {}
	for (const [name, propFragment] of Object.entries(properties ?? {})) {
		const node = jsonSchemaFragmentToZod(propFragment, [...path, "properties", name])
		shape[name] = requiredSet.has(name) ? node : node.optional()
	}
	return shape
}

// ---------------------------------------------------------------------------
// JSON manifest parse entry points
// ---------------------------------------------------------------------------

/**
 * Parse a JSON-profile manifest (e.g. the parsed contents of a
 * `manifest.json` on disk): converts each tool's JSON-Schema `args`
 * to a Zod raw shape, then routes through the single canonical
 * `parsePluginManifest` path. Throws `JsonManifestError` for
 * conversion failures and `ZodError` for schema failures.
 */
export function parseJsonPluginManifest(input: unknown): PluginManifest {
	if (!isRecord(input)) {
		throw new JsonManifestError([{ path: [], message: "manifest must be a JSON object" }])
	}
	const contributes = input.contributes
	if (contributes === undefined) {
		return parsePluginManifest(input)
	}
	if (!isRecord(contributes)) {
		throw new JsonManifestError([{ path: ["contributes"], message: "contributes must be an object" }])
	}
	const tools = contributes.tools
	if (tools === undefined) {
		return parsePluginManifest(input)
	}
	if (!Array.isArray(tools)) {
		throw new JsonManifestError([{ path: ["contributes", "tools"], message: "tools must be an array" }])
	}
	const convertedTools = tools.map((tool, index) => {
		if (!isRecord(tool)) {
			throw new JsonManifestError([
				{ path: ["contributes", "tools", index], message: "tool contribution must be an object" },
			])
		}
		if (tool.args === undefined) return tool
		const shape = jsonSchemaObjectToRawShape(tool.args, ["contributes", "tools", index, "args"])
		return { ...tool, args: shape }
	})
	return parsePluginManifest({
		...input,
		contributes: { ...contributes, tools: convertedTools },
	})
}

/**
 * Never-throws variant for the catalog-load boundary: one bad disk
 * manifest quarantines without blocking the rest of the catalog.
 */
export function safeParseJsonPluginManifest(input: unknown): {
	manifest: PluginManifest | null
	issues: JsonManifestIssue[]
} {
	try {
		return { manifest: parseJsonPluginManifest(input), issues: [] }
	} catch (err) {
		if (err instanceof JsonManifestError) {
			return { manifest: null, issues: [...err.issues] }
		}
		if (err instanceof z.ZodError) {
			return {
				manifest: null,
				issues: err.issues.map((issue) => ({ path: [...issue.path] as (string | number)[], message: issue.message })),
			}
		}
		return {
			manifest: null,
			issues: [{ path: [], message: err instanceof Error ? err.message : String(err) }],
		}
	}
}
