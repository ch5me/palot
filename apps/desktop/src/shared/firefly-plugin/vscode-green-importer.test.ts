import { describe, expect, test } from "bun:test"
import { ZodError } from "zod"

import {
	importGreenTierVscodeExtension,
	tryImportGreenTierVscodeExtension,
} from "./vscode-green-importer"
import { VscodeProbeRejectedError, type VscodeCompatibilityProbe } from "./vscode-probe"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function greenProbe(overrides?: Partial<VscodeCompatibilityProbe>): VscodeCompatibilityProbe {
	return {
		vscodeEngineRange: "^1.85.0",
		extensionKind: ["web"],
		activationEvents: ["onCommand:myext.hello"],
		contributionPoints: ["commands"],
		apiUsage: [],
		nativeDependencyRisk: "none",
		...overrides,
	}
}

const commandsPackageJson = {
	name: "my-extension",
	publisher: "acmecorp",
	version: "1.2.3",
	description: "A test extension.",
	contributes: {
		commands: [
			{ command: "myext.helloWorld", title: "Hello World", category: "MyExt" },
			{ command: "myext.doSomething", title: "Do Something" },
		],
	},
	activationEvents: ["onCommand:myext.helloWorld"],
}

const languagesPackageJson = {
	name: "lang-ext",
	publisher: "langco",
	version: "0.1.0",
	contributes: {
		languages: [
			{
				id: "myLang",
				aliases: ["My Language", "mylang"],
				extensions: [".mylang", ".ml"],
				filenames: ["Mylangfile"],
				mimetypes: ["text/x-mylang"],
				firstLine: "^#!/.*mylang",
				configuration: "./language-configuration.json",
			},
		],
	},
}

// ---------------------------------------------------------------------------
// importGreenTierVscodeExtension — happy path
// ---------------------------------------------------------------------------

describe("importGreenTierVscodeExtension — happy path", () => {
	test("returns a result with the expected plugin id", () => {
		const result = importGreenTierVscodeExtension(greenProbe(), commandsPackageJson)
		expect(result.pluginId).toBe("acmecorp.my-extension")
	})

	test("sets the version from package.json", () => {
		const result = importGreenTierVscodeExtension(greenProbe(), commandsPackageJson)
		expect(result.version).toBe("1.2.3")
	})

	test("uses displayName when present", () => {
		const pkg = { ...commandsPackageJson, displayName: "My Cool Extension" }
		const result = importGreenTierVscodeExtension(greenProbe(), pkg)
		expect(result.displayName).toBe("My Cool Extension")
	})

	test("falls back to name when displayName is absent", () => {
		const result = importGreenTierVscodeExtension(greenProbe(), commandsPackageJson)
		expect(result.displayName).toBe("my-extension")
	})

	test("converts commands: id is sanitized from vscode command token", () => {
		const result = importGreenTierVscodeExtension(greenProbe(), commandsPackageJson)
		expect(result.commands).toHaveLength(2)
		// Dots in VS Code command tokens become dashes in Firefly ids
		expect(result.commands[0].id).toBe("myext-helloWorld")
		expect(result.commands[0].title).toBe("Hello World")
		expect(result.commands[0].category).toBe("MyExt")
	})

	test("commands without category have no category field", () => {
		const result = importGreenTierVscodeExtension(greenProbe(), commandsPackageJson)
		expect(result.commands[1].id).toBe("myext-doSomething")
		expect(result.commands[1].category).toBeUndefined()
	})

	test("converts languages with all fields", () => {
		const result = importGreenTierVscodeExtension(greenProbe(), languagesPackageJson)
		expect(result.languages).toHaveLength(1)
		const lang = result.languages[0]
		expect(lang.id).toBe("myLang")
		expect(lang.aliases).toEqual(["My Language", "mylang"])
		expect(lang.extensions).toEqual([".mylang", ".ml"])
		expect(lang.filenames).toEqual(["Mylangfile"])
		expect(lang.mimetypes).toEqual(["text/x-mylang"])
		expect(lang.firstLine).toBe("^#!/.*mylang")
		expect(lang.configurationPath).toBe("./language-configuration.json")
	})

	test("retains configuration metadata as opaque data", () => {
		const pkg = {
			...commandsPackageJson,
			contributes: {
				...commandsPackageJson.contributes,
				configuration: {
					title: "My Ext Config",
					properties: { "myext.enabled": { type: "boolean", default: true } },
				},
			},
		}
		const result = importGreenTierVscodeExtension(greenProbe(), pkg)
		expect(result.configurationMetadataRaw).not.toBeNull()
	})

	test("configurationMetadataRaw is null when no configuration contribution", () => {
		const result = importGreenTierVscodeExtension(greenProbe(), commandsPackageJson)
		expect(result.configurationMetadataRaw).toBeNull()
	})

	test("stance invariants: runtimeShim=false, hiddenSidecar=false, transpileOnly=true", () => {
		const result = importGreenTierVscodeExtension(greenProbe(), commandsPackageJson)
		expect(result.runtimeShim).toBe(false)
		expect(result.hiddenSidecar).toBe(false)
		expect(result.transpileOnly).toBe(true)
	})

	test("sourcePackageJson is the normalized input", () => {
		const result = importGreenTierVscodeExtension(greenProbe(), commandsPackageJson)
		expect(result.sourcePackageJson.name).toBe("my-extension")
		expect(result.sourcePackageJson.version).toBe("1.2.3")
	})

	test("no publisher -> pluginId prefixed with 'imported.'", () => {
		const pkg = { ...commandsPackageJson, publisher: undefined }
		const result = importGreenTierVscodeExtension(greenProbe(), pkg)
		expect(result.pluginId).toMatch(/^imported\./)
	})

	test("package with no contributes -> empty commands and languages", () => {
		const pkg = { name: "bare-ext", version: "0.0.1" }
		const result = importGreenTierVscodeExtension(greenProbe(), pkg)
		expect(result.commands).toHaveLength(0)
		expect(result.languages).toHaveLength(0)
	})

	test("extra package.json fields are stripped (tolerant input)", () => {
		const pkg = {
			...commandsPackageJson,
			someUnknownField: "should be stripped",
			main: "./out/extension.js",
			engines: { vscode: "^1.85.0" },
		}
		const result = importGreenTierVscodeExtension(greenProbe(), pkg)
		// Result still valid; no throw for extra fields
		expect(result.version).toBe("1.2.3")
	})
})

// ---------------------------------------------------------------------------
// importGreenTierVscodeExtension — rejection policy
// ---------------------------------------------------------------------------

describe("importGreenTierVscodeExtension — reject-on-unsupported-APIs", () => {
	test("red probe -> throws VscodeProbeRejectedError before touching package.json", () => {
		const probe = greenProbe({ apiUsage: ["vscode.debug"] })
		expect(() =>
			importGreenTierVscodeExtension(probe, commandsPackageJson),
		).toThrow(VscodeProbeRejectedError)
	})

	test("orange probe -> throws VscodeProbeRejectedError", () => {
		const probe = greenProbe({ apiUsage: ["vscode.window.createWebviewPanel"] })
		expect(() =>
			importGreenTierVscodeExtension(probe, commandsPackageJson),
		).toThrow(VscodeProbeRejectedError)
	})

	test("yellow probe -> throws VscodeProbeRejectedError (gated, not auto-accepted)", () => {
		const probe = greenProbe({ nativeDependencyRisk: "optional" })
		expect(() =>
			importGreenTierVscodeExtension(probe, commandsPackageJson),
		).toThrow(VscodeProbeRejectedError)
	})

	test("required native deps -> throws VscodeProbeRejectedError", () => {
		const probe = greenProbe({ nativeDependencyRisk: "required" })
		expect(() =>
			importGreenTierVscodeExtension(probe, commandsPackageJson),
		).toThrow(VscodeProbeRejectedError)
	})

	test("red API tasks -> throws VscodeProbeRejectedError with tier=red", () => {
		const probe = greenProbe({ apiUsage: ["vscode.tasks.executeTask"] })
		let err: VscodeProbeRejectedError | null = null
		try {
			importGreenTierVscodeExtension(probe, commandsPackageJson)
		} catch (e) {
			if (e instanceof VscodeProbeRejectedError) err = e
		}
		expect(err).not.toBeNull()
		expect(err?.verdict.tier).toBe("red")
	})

	test("malformed package.json -> throws ZodError (not VscodeProbeRejectedError)", () => {
		// Green probe so we pass the first gate, then hit parse error
		expect(() =>
			importGreenTierVscodeExtension(greenProbe(), { name: 123, version: "1.0.0" }),
		).toThrow(ZodError)
	})

	test("missing package.json version -> throws ZodError", () => {
		expect(() =>
			importGreenTierVscodeExtension(greenProbe(), { name: "x" }),
		).toThrow(ZodError)
	})
})

// ---------------------------------------------------------------------------
// tryImportGreenTierVscodeExtension
// ---------------------------------------------------------------------------

describe("tryImportGreenTierVscodeExtension", () => {
	test("green probe + valid pkg -> ok: true with result", () => {
		const outcome = tryImportGreenTierVscodeExtension(greenProbe(), commandsPackageJson)
		expect(outcome.ok).toBe(true)
		if (outcome.ok) {
			expect(outcome.result.pluginId).toBe("acmecorp.my-extension")
		}
	})

	test("red probe -> ok: false, error: 'probe-rejected'", () => {
		const outcome = tryImportGreenTierVscodeExtension(
			greenProbe({ apiUsage: ["vscode.debug"] }),
			commandsPackageJson,
		)
		expect(outcome.ok).toBe(false)
		if (!outcome.ok) {
			expect(outcome.error).toBe("probe-rejected")
			expect("verdict" in outcome && outcome.verdict.tier).toBe("red")
		}
	})

	test("orange probe -> ok: false, error: 'probe-rejected'", () => {
		const outcome = tryImportGreenTierVscodeExtension(
			greenProbe({ apiUsage: ["vscode.window.createWebviewPanel"] }),
			commandsPackageJson,
		)
		expect(outcome.ok).toBe(false)
		if (!outcome.ok) {
			expect(outcome.error).toBe("probe-rejected")
		}
	})

	test("malformed package.json -> ok: false, error: 'parse-error'", () => {
		const outcome = tryImportGreenTierVscodeExtension(greenProbe(), { bad: true })
		expect(outcome.ok).toBe(false)
		if (!outcome.ok) {
			expect(outcome.error).toBe("parse-error")
			expect(outcome.message).toMatch(/validation failed/i)
		}
	})

	test("probe-rejected outcome includes a human-readable message", () => {
		const outcome = tryImportGreenTierVscodeExtension(
			greenProbe({ apiUsage: ["vscode.tasks"] }),
			commandsPackageJson,
		)
		expect(outcome.ok).toBe(false)
		if (!outcome.ok) {
			expect(outcome.message.length).toBeGreaterThan(0)
		}
	})

	test("stance invariants: every ok result has runtimeShim=false etc.", () => {
		const outcome = tryImportGreenTierVscodeExtension(greenProbe(), commandsPackageJson)
		if (outcome.ok) {
			expect(outcome.result.runtimeShim).toBe(false)
			expect(outcome.result.hiddenSidecar).toBe(false)
			expect(outcome.result.transpileOnly).toBe(true)
		}
	})
})

// ---------------------------------------------------------------------------
// Id sanitization edge cases
// ---------------------------------------------------------------------------

describe("pluginId and commandId sanitization", () => {
	test("publisher with uppercase and special chars is lowercased and sanitized", () => {
		const pkg = { ...commandsPackageJson, publisher: "AcmeCorp-Inc" }
		const result = importGreenTierVscodeExtension(greenProbe(), pkg)
		expect(result.pluginId).toMatch(/^acmecorp-inc\./)
	})

	test("VS Code command with underscores sanitized to dashes", () => {
		const pkg = {
			name: "x",
			version: "1.0.0",
			contributes: {
				commands: [{ command: "ext_foo.bar_baz", title: "Foo" }],
			},
		}
		const result = importGreenTierVscodeExtension(greenProbe(), pkg)
		expect(result.commands[0].id).toBe("ext-foo-bar-baz")
	})

	test("VS Code command with leading dots stripped", () => {
		const pkg = {
			name: "x",
			version: "1.0.0",
			contributes: {
				commands: [{ command: ".hidden.command", title: "Hidden" }],
			},
		}
		const result = importGreenTierVscodeExtension(greenProbe(), pkg)
		// Leading dot becomes leading dash which is then stripped
		expect(result.commands[0].id).not.toMatch(/^-/)
	})
})
