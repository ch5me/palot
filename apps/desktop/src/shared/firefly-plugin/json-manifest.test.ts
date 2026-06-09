import { describe, expect, test } from "bun:test"
import { z } from "zod"

import {
	JsonManifestError,
	jsonSchemaFragmentToZod,
	jsonSchemaObjectToRawShape,
	parseJsonPluginManifest,
	safeParseJsonPluginManifest,
} from "./json-manifest"
import { derivePluginDescriptor } from "./descriptor"
import { projectBridgeToolDefinitions } from "./bridge-projection"

const baseJsonManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "acme.disk-exemplar",
	displayName: "Disk Exemplar",
	version: "1.0.0",
	trust: "signed-third-party",
	lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
	activationEvents: [{ kind: "onStartup" }],
	contributes: {
		panels: [],
		widgets: [],
		commands: [],
		themes: [],
		tools: [
			{
				id: "plugin.acme.disk-exemplar.echo",
				title: "Echo",
				description: "Echo a message back.",
				scope: "session",
				requires: [],
				args: {
					type: "object",
					properties: {
						message: { type: "string", minLength: 1, maxLength: 200 },
						repeat: { type: "integer", minimum: 1, maximum: 5 },
						loud: { type: "boolean" },
						mode: { type: "string", enum: ["plain", "fancy"] },
						tags: { type: "array", items: { type: "string" } },
					},
					required: ["message"],
				},
			},
		],
	},
	capabilities: [],
	tags: [],
}

describe("jsonSchemaFragmentToZod", () => {
	test("converts string fragments with constraints", () => {
		const node = jsonSchemaFragmentToZod({ type: "string", minLength: 2, maxLength: 4 }, [])
		expect(node.safeParse("abc").success).toBe(true)
		expect(node.safeParse("a").success).toBe(false)
		expect(node.safeParse("abcde").success).toBe(false)
	})

	test("converts url format", () => {
		const node = jsonSchemaFragmentToZod({ type: "string", format: "uri" }, [])
		expect(node.safeParse("https://example.com").success).toBe(true)
		expect(node.safeParse("not-a-url").success).toBe(false)
	})

	test("converts enum fragments", () => {
		const node = jsonSchemaFragmentToZod({ type: "string", enum: ["a", "b"] }, [])
		expect(node.safeParse("a").success).toBe(true)
		expect(node.safeParse("c").success).toBe(false)
	})

	test("converts integer fragments with bounds", () => {
		const node = jsonSchemaFragmentToZod({ type: "integer", minimum: 1, maximum: 3 }, [])
		expect(node.safeParse(2).success).toBe(true)
		expect(node.safeParse(2.5).success).toBe(false)
		expect(node.safeParse(4).success).toBe(false)
	})

	test("converts nested arrays and objects", () => {
		const node = jsonSchemaFragmentToZod(
			{
				type: "array",
				items: {
					type: "object",
					properties: { name: { type: "string" } },
					required: ["name"],
				},
			},
			[],
		)
		expect(node.safeParse([{ name: "x" }]).success).toBe(true)
		expect(node.safeParse([{}]).success).toBe(false)
	})

	test("rejects unsupported keywords with the offending path (fail fast)", () => {
		expect(() => jsonSchemaFragmentToZod({ type: "string", $ref: "#/x" }, ["args", "q"])).toThrow(
			JsonManifestError,
		)
		try {
			jsonSchemaFragmentToZod({ type: "string", $ref: "#/x" }, ["args", "q"])
		} catch (err) {
			expect(err).toBeInstanceOf(JsonManifestError)
			expect((err as JsonManifestError).issues[0].path).toEqual(["args", "q", "$ref"])
		}
	})

	test("rejects oneOf / unknown types", () => {
		expect(() => jsonSchemaFragmentToZod({ oneOf: [] }, [])).toThrow(JsonManifestError)
		expect(() => jsonSchemaFragmentToZod({ type: "null" }, [])).toThrow(JsonManifestError)
	})
})

describe("jsonSchemaObjectToRawShape", () => {
	test("derives optionality from the required array", () => {
		const shape = jsonSchemaObjectToRawShape(
			{
				type: "object",
				properties: { a: { type: "string" }, b: { type: "number" } },
				required: ["a"],
			},
			[],
		)
		const wrapped = z.object(shape)
		expect(wrapped.safeParse({ a: "x" }).success).toBe(true)
		expect(wrapped.safeParse({}).success).toBe(false)
		expect(wrapped.safeParse({ a: "x", b: 1 }).success).toBe(true)
	})

	test("rejects required names not present in properties", () => {
		expect(() =>
			jsonSchemaObjectToRawShape(
				{ type: "object", properties: {}, required: ["ghost"] },
				[],
			),
		).toThrow(JsonManifestError)
	})

	test("rejects non-object root", () => {
		expect(() => jsonSchemaObjectToRawShape({ type: "string" }, [])).toThrow(JsonManifestError)
	})
})

describe("parseJsonPluginManifest", () => {
	test("produces a manifest that derives a descriptor on the single canonical path", () => {
		const manifest = parseJsonPluginManifest(baseJsonManifest)
		expect(manifest.id).toBe("acme.disk-exemplar")
		const descriptor = derivePluginDescriptor(manifest, { appVersion: "1.0.0" })
		expect(descriptor.tools).toHaveLength(1)
		// The projected tool wraps args in z.object — identical to TS-manifest path.
		const projected = projectBridgeToolDefinitions(descriptor)
		expect(projected).toHaveLength(1)
	})

	test("converted args validate like the TS path", () => {
		const manifest = parseJsonPluginManifest(baseJsonManifest)
		const tool = manifest.contributes.tools[0]
		const schema = z.object(tool.args as Record<string, z.ZodTypeAny>)
		expect(schema.safeParse({ message: "hi" }).success).toBe(true)
		expect(schema.safeParse({}).success).toBe(false)
		expect(schema.safeParse({ message: "hi", mode: "fancy", repeat: 2 }).success).toBe(true)
		expect(schema.safeParse({ message: "hi", mode: "wrong" }).success).toBe(false)
	})

	test("manifest without tools passes straight through", () => {
		const manifest = parseJsonPluginManifest({
			...baseJsonManifest,
			contributes: { ...baseJsonManifest.contributes, tools: [] },
		})
		expect(manifest.contributes.tools).toHaveLength(0)
	})

	test("rejects non-object input", () => {
		expect(() => parseJsonPluginManifest("nope")).toThrow(JsonManifestError)
	})
})

describe("safeParseJsonPluginManifest", () => {
	test("returns issues instead of throwing for conversion failures", () => {
		const bad = structuredClone(baseJsonManifest) as Record<string, unknown>
		const contributes = bad.contributes as { tools: { args: unknown }[] }
		contributes.tools[0].args = { type: "object", properties: { q: { type: "string", oneOf: [] } } }
		const result = safeParseJsonPluginManifest(bad)
		expect(result.manifest).toBeNull()
		expect(result.issues.length).toBeGreaterThan(0)
	})

	test("returns zod issues for schema failures", () => {
		const result = safeParseJsonPluginManifest({ ...baseJsonManifest, id: "INVALID ID" })
		expect(result.manifest).toBeNull()
		expect(result.issues.length).toBeGreaterThan(0)
	})

	test("returns the manifest for valid input", () => {
		const result = safeParseJsonPluginManifest(baseJsonManifest)
		expect(result.manifest).not.toBeNull()
		expect(result.issues).toHaveLength(0)
	})
})
