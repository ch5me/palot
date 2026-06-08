import { describe, expect, test } from "bun:test"

import {
	ACME_NOTEBOOK_GUARDRAILS,
	ACME_NOTEBOOK_PLUGIN_ID,
	ACME_NOTEBOOK_TRUST,
	ACME_NOTEBOOK_VERSION,
	acmeNotebookManifest,
	deriveAcmeNotebookDescriptor,
} from "./acme-notebook-exemplar"

describe("acme-notebook exemplar manifest", () => {
	test("id, version, and trust are the locked exemplar values", () => {
		expect(acmeNotebookManifest.id).toBe(ACME_NOTEBOOK_PLUGIN_ID)
		expect(acmeNotebookManifest.version).toBe(ACME_NOTEBOOK_VERSION)
		expect(acmeNotebookManifest.trust).toBe(ACME_NOTEBOOK_TRUST)
	})

	test("trust is signed-third-party (not built-in)", () => {
		expect(acmeNotebookManifest.trust).toBe("signed-third-party")
	})

	test("auto-enable is false (third-party plugins require explicit consent)", () => {
		expect(acmeNotebookManifest.lifecycle.autoEnable).toBe(false)
	})

	test("keepAliveAcrossSessions is true (notebook persists)", () => {
		expect(acmeNotebookManifest.lifecycle.keepAliveAcrossSessions).toBe(true)
	})

	test("the manifest round-trips through the V2 parser", () => {
		const { parsePluginManifest } = require("./manifest")
		const parsed = parsePluginManifest(acmeNotebookManifest)
		expect(parsed.id).toBe(ACME_NOTEBOOK_PLUGIN_ID)
	})
})

describe("acme-notebook contributions", () => {
	test("declares exactly one widget (notepad in above-chat)", () => {
		expect(acmeNotebookManifest.contributes.widgets).toHaveLength(1)
		const widget = acmeNotebookManifest.contributes.widgets[0]
		expect(widget?.id).toBe("notepad")
		expect(widget?.zoneId).toBe("above-chat")
	})

	test("declares exactly two commands (open + clear)", () => {
		expect(acmeNotebookManifest.contributes.commands).toHaveLength(2)
		const ids = acmeNotebookManifest.contributes.commands.map((c) => c.id)
		expect(ids).toContain("acme-notebook-open")
		expect(ids).toContain("acme-notebook-clear")
	})

	test("the open command declares a keybinding (Cmd+Shift+N)", () => {
		const open = acmeNotebookManifest.contributes.commands.find((c) => c.id === "acme-notebook-open")
		expect(open?.keybinding).toBe("Cmd+Shift+N")
	})

	test("declares exactly two tools (addCell + exportMarkdown)", () => {
		expect(acmeNotebookManifest.contributes.tools).toHaveLength(2)
		const ids = acmeNotebookManifest.contributes.tools.map((t) => t.id)
		expect(ids).toContain("plugin.acme.acme-notebook.addCell")
		expect(ids).toContain("plugin.acme.acme-notebook.exportMarkdown")
	})

	test("the addCell tool is scope=session and declares session capabilities", () => {
		const tool = acmeNotebookManifest.contributes.tools.find(
			(t) => t.id === "plugin.acme.acme-notebook.addCell",
		)
		expect(tool?.scope).toBe("session")
		expect(tool?.requires).toContain("host:bridge.session-read")
		expect(tool?.requires).toContain("host:bridge.session-write")
	})

	test("the addCell tool uses namespaced plugin.<id>.<shortName> ids", () => {
		const tool = acmeNotebookManifest.contributes.tools.find(
			(t) => t.id === "plugin.acme.acme-notebook.addCell",
		)
		expect(tool?.id.startsWith(`plugin.${ACME_NOTEBOOK_PLUGIN_ID}.`)).toBe(true)
	})

	test("declares exactly one optional theme contribution", () => {
		expect(acmeNotebookManifest.contributes.themes).toHaveLength(1)
		const theme = acmeNotebookManifest.contributes.themes[0]
		expect(theme?.id).toBe("acme-notebook-ink")
		expect(theme?.kind).toBe("dark")
	})

	test("the bridge metadata declares requiresSessionBinding + bindOnActivation", () => {
		expect(acmeNotebookManifest.bridge?.requiresSessionBinding).toBe(true)
		expect(acmeNotebookManifest.bridge?.bindOnActivation).toBe(true)
	})

	test("capabilities are Firefly-specific (no fs/net/shell)", () => {
		for (const cap of acmeNotebookManifest.capabilities) {
			expect(cap.startsWith("fs:")).toBe(false)
			expect(cap.startsWith("net:")).toBe(false)
			expect(cap.startsWith("shell:")).toBe(false)
		}
	})
})

describe("ACME_NOTEBOOK_GUARDRAILS", () => {
	test("covers every locked V2 guardrail (5 entries)", () => {
		expect(ACME_NOTEBOOK_GUARDRAILS.length).toBe(5)
	})

	test("every guardrail has a non-empty behavior description", () => {
		for (const row of ACME_NOTEBOOK_GUARDRAILS) {
			expect(row.guardrail.length).toBeGreaterThan(0)
			expect(row.exemplarBehavior.length).toBeGreaterThan(0)
		}
	})

	test("mentions the no-runtime-shim / no-sidecar guardrail", () => {
		const has = ACME_NOTEBOOK_GUARDRAILS.some((g) => /runtime vscode shim/i.test(g.guardrail))
		expect(has).toBe(true)
	})

	test("mentions the no-arbitrary-native-deps guardrail", () => {
		const has = ACME_NOTEBOOK_GUARDRAILS.some((g) =>
			/native dependencies/i.test(g.guardrail) || /native deps/i.test(g.guardrail),
		)
		expect(has).toBe(true)
	})
})

describe("deriveAcmeNotebookDescriptor", () => {
	test("produces a valid descriptor at the current app version", () => {
		const descriptor = deriveAcmeNotebookDescriptor("0.11.0")
		expect(descriptor.normalizedId).toBe(ACME_NOTEBOOK_PLUGIN_ID)
	})

	test("rejects at older app versions (engine floor)", () => {
		expect(() => deriveAcmeNotebookDescriptor("0.10.0")).toThrow()
	})
})
