import { describe, expect, test } from "bun:test"

import {
	ALL_CONTRIBUTION_FAMILY_CONTRACTS,
	COMMAND_CONTRACT,
	CONTRIBUTION_FAMILIES,
	CONTRIBUTION_FAMILY_CONTRACTS,
	ESCAPE_HATCH_ELIGIBLE_FAMILIES,
	GRAMMAR_CONTRACT,
	ICON_THEME_CONTRACT,
	LANGUAGE_CONTRACT,
	SNIPPET_CONTRACT,
	THEME_CONTRACT,
	commandRequiresWrapperToolsForChromeMutation,
	familyAllowsDirectHostChromeMutation,
	familyMayRequestEscapeHatch,
	getContributionFamilyContract,
	isEscapeHatchAllowed,
	themeIsDataOnly,
	themePreviewApplyOwnedByHost,
} from "./family-contracts"

describe("family contracts", () => {
	test("represents all ten contribution families", () => {
		expect(CONTRIBUTION_FAMILIES).toEqual([
			"panels",
			"navSidebars",
			"widgets",
			"commands",
			"themes",
			"components",
			"snippets",
			"languages",
			"grammars",
			"iconThemes",
		])
		expect(Object.keys(CONTRIBUTION_FAMILY_CONTRACTS)).toEqual([...CONTRIBUTION_FAMILIES])
		expect(ALL_CONTRIBUTION_FAMILY_CONTRACTS).toHaveLength(10)
		for (const family of CONTRIBUTION_FAMILIES) {
			expect(getContributionFamilyContract(family).family).toBe(family)
		}
	})

	test("only panels and widgets may request iframe or webview escape hatches", () => {
		expect(Array.from(ESCAPE_HATCH_ELIGIBLE_FAMILIES)).toEqual(["panels", "widgets"])
		for (const family of CONTRIBUTION_FAMILIES) {
			const contract = getContributionFamilyContract(family)
			if (family === "panels" || family === "widgets") {
				expect(familyMayRequestEscapeHatch(family)).toBe(true)
				expect(contract.escapeHatch.policy).toBe("opt-in-explicit")
				expect(contract.escapeHatch.allowedTransports).toEqual(["iframe", "webview"])
				expect(isEscapeHatchAllowed({ family, transport: "iframe", explicitPolicy: true })).toBe(
					true,
				)
				expect(isEscapeHatchAllowed({ family, transport: "webview", explicitPolicy: true })).toBe(
					true,
				)
				expect(isEscapeHatchAllowed({ family, transport: "iframe", explicitPolicy: false })).toBe(
					false,
				)
			} else {
				expect(familyMayRequestEscapeHatch(family)).toBe(false)
				expect(contract.escapeHatch.policy).toBe("forbidden")
				expect(contract.escapeHatch.allowedTransports).toEqual([])
				expect(isEscapeHatchAllowed({ family, transport: "iframe", explicitPolicy: true })).toBe(
					false,
				)
				expect(isEscapeHatchAllowed({ family, transport: "webview", explicitPolicy: true })).toBe(
					false,
				)
			}
		}
	})

	test("commands cannot mutate host chrome directly without wrapper tools or capabilities", () => {
		expect(COMMAND_CONTRACT.hostVocabulary).toEqual([
			"command-palette",
			"menu",
			"keybinding",
			"contextual-action",
		])
		expect(COMMAND_CONTRACT.mutationGuard.mayDirectlyMutateHostChrome).toBe(false)
		expect(COMMAND_CONTRACT.mutationGuard.requiresWrapperToolsOrCapabilities).toBe(true)
		expect(commandRequiresWrapperToolsForChromeMutation()).toBe(true)
		expect(familyAllowsDirectHostChromeMutation("commands")).toBe(false)
		expect(COMMAND_CONTRACT.mutationGuard.notes.some((note) => note.includes("wrapper tools"))).toBe(
			true,
		)
	})

	test("themes stay data-only and preview/apply semantics stay host-owned", () => {
		expect(THEME_CONTRACT.hostRendering.allowedModes).toEqual(["data-only"])
		expect(THEME_CONTRACT.hostRendering.dataOnly).toBe(true)
		expect(THEME_CONTRACT.hostRendering.hostMayPreviewWithoutApply).toBe(true)
		expect(THEME_CONTRACT.hostRendering.hostMayApplyWithoutPluginRuntime).toBe(true)
		expect(THEME_CONTRACT.escapeHatch.policy).toBe("forbidden")
		expect(themeIsDataOnly()).toBe(true)
		expect(themePreviewApplyOwnedByHost()).toBe(true)
		expect(familyAllowsDirectHostChromeMutation("themes")).toBe(false)
	})

	test("snippets are data-only and host-applies without plugin runtime", () => {
		expect(SNIPPET_CONTRACT.hostRendering.dataOnly).toBe(true)
		expect(SNIPPET_CONTRACT.hostRendering.allowedModes).toEqual(["data-only"])
		expect(SNIPPET_CONTRACT.hostRendering.hostMayApplyWithoutPluginRuntime).toBe(true)
		expect(SNIPPET_CONTRACT.escapeHatch.policy).toBe("forbidden")
		expect(SNIPPET_CONTRACT.mutationGuard.mayDirectlyMutateHostChrome).toBe(false)
		expect(familyMayRequestEscapeHatch("snippets")).toBe(false)
		expect(familyAllowsDirectHostChromeMutation("snippets")).toBe(false)
	})

	test("languages are data-only metadata registered with the editor language registry", () => {
		expect(LANGUAGE_CONTRACT.hostRendering.dataOnly).toBe(true)
		expect(LANGUAGE_CONTRACT.hostRendering.allowedModes).toEqual(["data-only"])
		expect(LANGUAGE_CONTRACT.hostRendering.hostMayApplyWithoutPluginRuntime).toBe(true)
		expect(LANGUAGE_CONTRACT.escapeHatch.policy).toBe("forbidden")
		expect(LANGUAGE_CONTRACT.mutationGuard.mayDirectlyMutateHostChrome).toBe(false)
		expect(familyMayRequestEscapeHatch("languages")).toBe(false)
		expect(familyAllowsDirectHostChromeMutation("languages")).toBe(false)
	})

	test("grammars are data-only TextMate grammars registered with Monaco", () => {
		expect(GRAMMAR_CONTRACT.hostRendering.dataOnly).toBe(true)
		expect(GRAMMAR_CONTRACT.hostRendering.allowedModes).toEqual(["data-only"])
		expect(GRAMMAR_CONTRACT.hostRendering.hostMayApplyWithoutPluginRuntime).toBe(true)
		expect(GRAMMAR_CONTRACT.escapeHatch.policy).toBe("forbidden")
		expect(GRAMMAR_CONTRACT.mutationGuard.mayDirectlyMutateHostChrome).toBe(false)
		expect(familyMayRequestEscapeHatch("grammars")).toBe(false)
		expect(familyAllowsDirectHostChromeMutation("grammars")).toBe(false)
	})

	test("icon themes are data-only with host-owned preview/apply semantics", () => {
		expect(ICON_THEME_CONTRACT.hostRendering.dataOnly).toBe(true)
		expect(ICON_THEME_CONTRACT.hostRendering.allowedModes).toEqual(["data-only"])
		expect(ICON_THEME_CONTRACT.hostRendering.hostMayPreviewWithoutApply).toBe(true)
		expect(ICON_THEME_CONTRACT.hostRendering.hostMayApplyWithoutPluginRuntime).toBe(true)
		expect(ICON_THEME_CONTRACT.escapeHatch.policy).toBe("forbidden")
		expect(ICON_THEME_CONTRACT.mutationGuard.mayDirectlyMutateHostChrome).toBe(false)
		expect(familyMayRequestEscapeHatch("iconThemes")).toBe(false)
		expect(familyAllowsDirectHostChromeMutation("iconThemes")).toBe(false)
	})

	test("all new data-only families have no escape hatches", () => {
		const dataOnlyFamilies = ["snippets", "languages", "grammars", "iconThemes"] as const
		for (const family of dataOnlyFamilies) {
			const contract = getContributionFamilyContract(family)
			expect(contract.escapeHatch.policy).toBe("forbidden")
			expect(contract.escapeHatch.allowedTransports).toEqual([])
			expect(isEscapeHatchAllowed({ family, transport: "iframe", explicitPolicy: true })).toBe(false)
			expect(isEscapeHatchAllowed({ family, transport: "webview", explicitPolicy: true })).toBe(false)
		}
	})
})
