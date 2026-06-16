import { describe, expect, test } from "bun:test"

import {
	annotateApiSurface,
	API_SURFACE_KINDS,
	API_TIERS,
	API_VERSION,
	apiSurfaceAnnotationSchema,
	BRIDGE_SCHEMA_REVISIONS,
	codemodExpectationSchema,
	CODEMOD_AVAILABILITY,
	computeDeprecationStatus,
	CURRENT_HOST_VERSION,
	CURRENT_MANIFEST_REVISION,
	deprecationPolicySchema,
	evaluateApiSurfaceAvailability,
	evaluateCodemodExpectation,
	getLatestSurfaceRevision,
	getManifestRevisionRule,
	getSurfaceRevisionRecord,
	isApiSurfaceAvailableToTrust,
	isApiSurfaceUnstable,
	MANIFEST_REVISION_RULES,
	MAX_MANIFEST_REVISION,
	MIN_MANIFEST_REVISION,
	negotiateApiVersion,
	negotiateBridgeSchema,
	negotiateInspectionToolSet,
	negotiateManifestRevision,
	negotiateToolResultEnvelope,
	PLUGIN_INSPECTION_TOOL_REVISIONS,
	summarizeApiSurface,
	TOOL_RESULT_ENVELOPE_REVISIONS,
	compareManifestRevisions,
} from "./api-versioning"

// ---------------------------------------------------------------------------
// Tier vocabulary
// ---------------------------------------------------------------------------

describe("API tier vocabulary", () => {
	test("exposes the three locked tiers in canonical order", () => {
		expect(API_TIERS).toEqual(["stable", "proposed", "internal"])
	})

	test("API_VERSION is the wire string V2 manifests declare", () => {
		expect(API_VERSION).toBe("firefly.plugin/v2")
	})

	test("API_SURFACE_KINDS covers every host-managed evolution surface", () => {
		expect(API_SURFACE_KINDS).toEqual([
			"manifest",
			"tool",
			"tool-result-envelope",
			"bridge",
			"panel",
			"widget",
			"command",
			"theme",
			"inspection-tool",
		])
	})

	test("CODEMOD_AVAILABILITY enumerates the locked codemod states", () => {
		expect(CODEMOD_AVAILABILITY).toEqual(["none", "available", "required", "manual-only"])
	})
})

// ---------------------------------------------------------------------------
// Manifest revision rule table
// ---------------------------------------------------------------------------

describe("MANIFEST_REVISION_RULES", () => {
	test("revision 1 is registered and stable", () => {
		const rule = MANIFEST_REVISION_RULES[1]
		expect(rule).toBeDefined()
		expect(rule.status).toBe("stable")
		expect(rule.minHostVersion).toBe(CURRENT_HOST_VERSION)
		expect(rule.deprecation).toBeNull()
	})

	test("revision 1 matches CURRENT_MANIFEST_REVISION", () => {
		expect(CURRENT_MANIFEST_REVISION).toBe(1)
		expect(MANIFEST_REVISION_RULES[CURRENT_MANIFEST_REVISION]).toBeDefined()
	})

	test("MIN_MANIFEST_REVISION and MAX_MANIFEST_REVISION bracket the table", () => {
		expect(MIN_MANIFEST_REVISION).toBe(1)
		expect(MAX_MANIFEST_REVISION).toBe(64)
		for (const rev of Object.keys(MANIFEST_REVISION_RULES).map((k) => Number.parseInt(k, 10))) {
			expect(rev).toBeGreaterThanOrEqual(MIN_MANIFEST_REVISION)
			expect(rev).toBeLessThanOrEqual(MAX_MANIFEST_REVISION)
		}
	})

	test("getManifestRevisionRule returns null for out-of-bounds and unknown revisions", () => {
		expect(getManifestRevisionRule(0)).toBeNull()
		expect(getManifestRevisionRule(MAX_MANIFEST_REVISION + 1)).toBeNull()
		expect(getManifestRevisionRule(99)).toBeNull()
	})

	test("getManifestRevisionRule returns the rule for a registered revision", () => {
		expect(getManifestRevisionRule(1)?.revision).toBe(1)
	})
})

describe("compareManifestRevisions", () => {
	test("returns negative when a < b", () => {
		expect(compareManifestRevisions(1, 2)).toBeLessThan(0)
	})

	test("returns 0 when equal", () => {
		expect(compareManifestRevisions(3, 3)).toBe(0)
	})

	test("returns positive when a > b", () => {
		expect(compareManifestRevisions(5, 2)).toBeGreaterThan(0)
	})
})

// ---------------------------------------------------------------------------
// Surface annotation
// ---------------------------------------------------------------------------

describe("ApiSurfaceAnnotation", () => {
	test("annotateApiSurface produces a valid annotation", () => {
		const annotation = annotateApiSurface({
			kind: "tool",
			name: "plugin.acme.foo.ping",
			tier: "proposed",
			revision: 1,
		})
		const parsed = apiSurfaceAnnotationSchema.parse(annotation)
		expect(parsed.tier).toBe("proposed")
		expect(parsed.kind).toBe("tool")
	})

	test("annotateApiSurface round-trips with an attached deprecation policy", () => {
		const deprecation = {
			replacement: "plugin.acme.foo.ping_v2",
			removalTarget: "1.0.0",
			codemod: {
				availability: "available" as const,
				codemodId: "ping-v1-to-v2",
			},
			migrationNote: "Move the ping arg from positional to a structured payload.",
		}
		const annotation = annotateApiSurface({
			kind: "tool",
			name: "plugin.acme.foo.ping",
			tier: "stable",
			revision: 1,
			deprecation,
		})
		const parsed = apiSurfaceAnnotationSchema.parse(annotation)
		expect(parsed.deprecation?.replacement).toBe("plugin.acme.foo.ping_v2")
	})
})

// ---------------------------------------------------------------------------
// Tier-aware availability
// ---------------------------------------------------------------------------

describe("tier-aware surface availability", () => {
	test("internal tier is never available to third-party plugins", () => {
		const annotation = annotateApiSurface({
			kind: "tool",
			name: "host-internal-debug",
			tier: "internal",
		})
		expect(isApiSurfaceAvailableToTrust(annotation, "unsigned-third-party")).toBe(false)
		expect(isApiSurfaceAvailableToTrust(annotation, "signed-third-party")).toBe(false)
		expect(isApiSurfaceAvailableToTrust(annotation, "local-dev")).toBe(false)
	})

	test("internal tier is available to built-in plugins", () => {
		const annotation = annotateApiSurface({
			kind: "tool",
			name: "host-internal-debug",
			tier: "internal",
		})
		expect(isApiSurfaceAvailableToTrust(annotation, "built-in")).toBe(true)
	})

	test("proposed tier is exportable but marked unstable", () => {
		const annotation = annotateApiSurface({
			kind: "tool",
			name: "plugin.acme.foo.experiment",
			tier: "proposed",
		})
		expect(isApiSurfaceAvailableToTrust(annotation, "unsigned-third-party")).toBe(true)
		expect(isApiSurfaceAvailableToTrust(annotation, "local-dev")).toBe(true)
		expect(isApiSurfaceAvailableToTrust(annotation, "built-in")).toBe(true)
		expect(isApiSurfaceUnstable(annotation)).toBe(true)
	})

	test("stable tier is neither unstable nor restricted", () => {
		const annotation = annotateApiSurface({
			kind: "tool",
			name: "plugin.acme.foo.ping",
			tier: "stable",
		})
		expect(isApiSurfaceUnstable(annotation)).toBe(false)
		for (const trust of [
			"built-in",
			"local-dev",
			"signed-third-party",
			"unsigned-third-party",
		] as const) {
			expect(isApiSurfaceAvailableToTrust(annotation, trust)).toBe(true)
		}
	})

	test("evaluateApiSurfaceAvailability returns a structured decision", () => {
		const internal = annotateApiSurface({
			kind: "tool",
			name: "host-internal-debug",
			tier: "internal",
		})
		const decision = evaluateApiSurfaceAvailability(internal, "unsigned-third-party")
		expect(decision.available).toBe(false)
		expect(decision.unstable).toBe(true)
		expect(decision.reason).toContain("host-internal-debug")
		expect(decision.reason).toContain("unsigned-third-party")
	})

	test("evaluateApiSurfaceAvailability flags proposed surfaces as unstable", () => {
		const proposed = annotateApiSurface({
			kind: "tool",
			name: "plugin.acme.foo.experiment",
			tier: "proposed",
		})
		const decision = evaluateApiSurfaceAvailability(proposed, "local-dev")
		expect(decision.available).toBe(true)
		expect(decision.unstable).toBe(true)
		expect(decision.reason).toContain("proposed")
	})
})

// ---------------------------------------------------------------------------
// Codemod + deprecation schemas
// ---------------------------------------------------------------------------

describe("codemodExpectationSchema", () => {
	test("required availability requires a codemodId", () => {
		expect(
			codemodExpectationSchema.safeParse({ availability: "required" }).success,
		).toBe(false)
		expect(
			codemodExpectationSchema.safeParse({
				availability: "required",
				codemodId: "foo-to-bar",
			}).success,
		).toBe(true)
	})

	test("available availability requires a codemodId", () => {
		expect(
			codemodExpectationSchema.safeParse({ availability: "available" }).success,
		).toBe(false)
		expect(
			codemodExpectationSchema.safeParse({
				availability: "available",
				codemodId: "foo-to-bar",
			}).success,
		).toBe(true)
	})

	test("manual-only availability requires at least one manualStep", () => {
		expect(
			codemodExpectationSchema.safeParse({ availability: "manual-only" }).success,
		).toBe(false)
		expect(
			codemodExpectationSchema.safeParse({
				availability: "manual-only",
				manualSteps: ["Open Settings", "Migrate the key"],
			}).success,
		).toBe(true)
	})

	test("none availability forbids carrying a codemodId or manualSteps", () => {
		expect(
			codemodExpectationSchema.safeParse({ availability: "none" }).success,
		).toBe(true)
		expect(
			codemodExpectationSchema.safeParse({
				availability: "none",
				codemodId: "should-not-be-here",
			}).success,
		).toBe(false)
		expect(
			codemodExpectationSchema.safeParse({
				availability: "none",
				manualSteps: ["should not be here"],
			}).success,
		).toBe(false)
	})
})

describe("deprecationPolicySchema", () => {
	const baseRequired = {
		replacement: "next-gen-tool",
		codemod: {
			availability: "available" as const,
			codemodId: "tool-to-next-gen",
		},
		migrationNote: "Switch to next-gen-tool. The old tool will be removed in 1.0.0.",
	}

	test("requires at least one of removalTarget or removalRevision", () => {
		const missing = { ...baseRequired }
		expect(deprecationPolicySchema.safeParse(missing).success).toBe(false)
	})

	test("accepts a removalTarget semver", () => {
		const withTarget = { ...baseRequired, removalTarget: "1.0.0" }
		const parsed = deprecationPolicySchema.parse(withTarget)
		expect(parsed.removalTarget).toBe("1.0.0")
	})

	test("accepts a removalRevision integer", () => {
		const withRev = { ...baseRequired, removalRevision: 2 }
		const parsed = deprecationPolicySchema.parse(withRev)
		expect(parsed.removalRevision).toBe(2)
	})

	test("rejects a malformed removalTarget", () => {
		const bad = { ...baseRequired, removalTarget: "v1" }
		expect(deprecationPolicySchema.safeParse(bad).success).toBe(false)
	})

	test("rejects removalRevision above MAX_MANIFEST_REVISION", () => {
		const bad = { ...baseRequired, removalRevision: MAX_MANIFEST_REVISION + 1 }
		expect(deprecationPolicySchema.safeParse(bad).success).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Codemod evaluation
// ---------------------------------------------------------------------------

describe("evaluateCodemodExpectation", () => {
	test("required availability flags required + available", () => {
		const evalResult = evaluateCodemodExpectation({
			availability: "required",
			codemodId: "force-migrate",
		})
		expect(evalResult.required).toBe(true)
		expect(evalResult.available).toBe(true)
		expect(evalResult.hasCodemodId).toBe(true)
		expect(evalResult.hasManualSteps).toBe(false)
	})

	test("available availability flags available but not required", () => {
		const evalResult = evaluateCodemodExpectation({
			availability: "available",
			codemodId: "soft-migrate",
		})
		expect(evalResult.required).toBe(false)
		expect(evalResult.available).toBe(true)
		expect(evalResult.hasCodemodId).toBe(true)
	})

	test("manual-only availability flags manual steps presence", () => {
		const evalResult = evaluateCodemodExpectation({
			availability: "manual-only",
			manualSteps: ["Edit ~/.config/foo", "Restart the app"],
		})
		expect(evalResult.required).toBe(false)
		expect(evalResult.available).toBe(false)
		expect(evalResult.hasCodemodId).toBe(false)
		expect(evalResult.hasManualSteps).toBe(true)
	})

	test("none availability flags neither required nor available", () => {
		const evalResult = evaluateCodemodExpectation({ availability: "none" })
		expect(evalResult.required).toBe(false)
		expect(evalResult.available).toBe(false)
		expect(evalResult.hasCodemodId).toBe(false)
		expect(evalResult.hasManualSteps).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Deprecation status resolution
// ---------------------------------------------------------------------------

describe("computeDeprecationStatus", () => {
	const deprecation = deprecationPolicySchema.parse({
		replacement: "next-gen-tool",
		removalTarget: "1.0.0",
		codemod: {
			availability: "available",
			codemodId: "tool-to-next-gen",
		},
		migrationNote: "Use next-gen-tool.",
	})

	test("returns removalPassed=true when host version meets removalTarget", () => {
		const status = computeDeprecationStatus({
			deprecation,
			currentHostVersion: "1.0.0",
			currentManifestRevision: 1,
		})
		expect(status.removalPassed).toBe(true)
		expect(status.isDeprecated).toBe(true)
		expect(status.reason).toContain("1.0.0")
	})

	test("returns removalPassed=true when host version exceeds removalTarget", () => {
		const status = computeDeprecationStatus({
			deprecation,
			currentHostVersion: "1.2.3",
			currentManifestRevision: 1,
		})
		expect(status.removalPassed).toBe(true)
	})

	test("returns removalPassed=false when host version is below removalTarget", () => {
		const status = computeDeprecationStatus({
			deprecation,
			currentHostVersion: "0.11.0",
			currentManifestRevision: 1,
		})
		expect(status.removalPassed).toBe(false)
		expect(status.isDeprecated).toBe(true)
		expect(status.reason).toContain("deprecation window")
	})

	test("uses removalRevision when no removalTarget is set", () => {
		const removalRevOnly = deprecationPolicySchema.parse({
			replacement: "next-gen",
			removalRevision: 2,
			codemod: { availability: "none" },
			migrationNote: "next-gen",
		})
		const passed = computeDeprecationStatus({
			deprecation: removalRevOnly,
			currentHostVersion: "0.11.0",
			currentManifestRevision: 2,
		})
		expect(passed.removalPassed).toBe(true)
		const notYet = computeDeprecationStatus({
			deprecation: removalRevOnly,
			currentHostVersion: "0.11.0",
			currentManifestRevision: 1,
		})
		expect(notYet.removalPassed).toBe(false)
	})

	test("always reports isDeprecated=true (the deprecation is the policy, not its removal)", () => {
		const status = computeDeprecationStatus({
			deprecation,
			currentHostVersion: "0.11.0",
			currentManifestRevision: 1,
		})
		expect(status.isDeprecated).toBe(true)
		expect(status.replacement).toBe("next-gen-tool")
	})
})

// ---------------------------------------------------------------------------
// Manifest revision negotiation
// ---------------------------------------------------------------------------

describe("negotiateManifestRevision", () => {
	test("accepts a known revision whose host version meets the floor", () => {
		const decision = negotiateManifestRevision({
			manifestRevision: 1,
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxRevision: 1,
		})
		expect(decision.compatible).toBe(true)
		expect(decision.rule).not.toBeNull()
		expect(decision.rule?.status).toBe("stable")
	})

	test("rejects a manifest revision below MIN_MANIFEST_REVISION", () => {
		const decision = negotiateManifestRevision({
			manifestRevision: 0,
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxRevision: 1,
		})
		expect(decision.compatible).toBe(false)
		expect(decision.reason).toContain("below host minimum")
	})

	test("rejects a manifest revision above MAX_MANIFEST_REVISION", () => {
		const decision = negotiateManifestRevision({
			manifestRevision: MAX_MANIFEST_REVISION + 1,
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxRevision: MAX_MANIFEST_REVISION,
		})
		expect(decision.compatible).toBe(false)
		expect(decision.reason).toContain("exceeds host maximum")
	})

	test("rejects when the host only knows up to a lower revision", () => {
		const decision = negotiateManifestRevision({
			manifestRevision: 1,
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxRevision: 0,
		})
		expect(decision.compatible).toBe(false)
		expect(decision.reason).toContain("only knows up to manifest revision 0")
	})

	test("rejects when the host app version is below the per-revision floor", () => {
		const decision = negotiateManifestRevision({
			manifestRevision: 1,
			hostAppVersion: "0.10.0",
			hostKnownMaxRevision: 1,
		})
		expect(decision.compatible).toBe(false)
		expect(decision.reason).toContain("below manifest revision 1 floor")
	})

	test("rejects an unknown registered-range revision", () => {
		const decision = negotiateManifestRevision({
			manifestRevision: 50,
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxRevision: 64,
		})
		expect(decision.compatible).toBe(false)
		expect(decision.reason).toContain("no rule registered")
	})
})

describe("negotiateApiVersion (revision + engines.firefly / engines.desktop alias)", () => {
	test("compatible when both manifest revision and engines range pass (no range)", () => {
		const decision = negotiateApiVersion({
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxRevision: 1,
			manifestRevision: 1,
			enginesFireflyRange: null,
		})
		expect(decision.compatible).toBe(true)
		expect(decision.enginesFloorOk).toBe(true)
	})

	test("compatible when engines.firefly range is satisfied", () => {
		const decision = negotiateApiVersion({
			hostAppVersion: "0.11.0",
			hostKnownMaxRevision: 1,
			manifestRevision: 1,
			enginesFireflyRange: ">=0.11.0 <1.0.0",
		})
		expect(decision.compatible).toBe(true)
		expect(decision.enginesFloorOk).toBe(true)
	})

	test("incompatible when engines.firefly floor is higher than host version", () => {
		const decision = negotiateApiVersion({
			hostAppVersion: "0.11.0",
			hostKnownMaxRevision: 1,
			manifestRevision: 1,
			enginesFireflyRange: ">=1.0.0",
		})
		expect(decision.compatible).toBe(false)
		expect(decision.enginesFloorOk).toBe(false)
		expect(decision.reason).toContain("engines.firefly range")
	})

	test("incompatible when host version exceeds engines.firefly upper bound", () => {
		const decision = negotiateApiVersion({
			hostAppVersion: "1.0.0",
			hostKnownMaxRevision: 1,
			manifestRevision: 1,
			enginesFireflyRange: ">=0.11.0 <1.0.0",
		})
		expect(decision.compatible).toBe(false)
		expect(decision.enginesFloorOk).toBe(false)
	})

	test("incompatible when engines.desktop alias floor is higher than host version (deprecated path)", () => {
		const decision = negotiateApiVersion({
			hostAppVersion: "0.11.0",
			hostKnownMaxRevision: 1,
			manifestRevision: 1,
			enginesFireflyRange: null,
			enginesDesktopFloor: "1.0.0",
		})
		expect(decision.compatible).toBe(false)
		expect(decision.enginesFloorOk).toBe(false)
		expect(decision.reason).toContain("engines.desktop floor")
	})

	test("engines.firefly takes precedence over engines.desktop alias", () => {
		// firefly says compatible; desktop alias (if evaluated) would fail
		const decision = negotiateApiVersion({
			hostAppVersion: "0.11.0",
			hostKnownMaxRevision: 1,
			manifestRevision: 1,
			enginesFireflyRange: ">=0.11.0",
			enginesDesktopFloor: "99.0.0",
		})
		expect(decision.compatible).toBe(true)
		expect(decision.enginesFloorOk).toBe(true)
	})

	test("incompatible when manifest revision is too high for the host", () => {
		const decision = negotiateApiVersion({
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxRevision: 0,
			manifestRevision: 1,
			enginesFireflyRange: null,
		})
		expect(decision.compatible).toBe(false)
		expect(decision.enginesFloorOk).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Bridge / tool / inspection schema evolution
// ---------------------------------------------------------------------------

describe("surface revision tables", () => {
	test("tool result envelope has at least one stable revision", () => {
		expect(TOOL_RESULT_ENVELOPE_REVISIONS.length).toBeGreaterThan(0)
		for (const r of TOOL_RESULT_ENVELOPE_REVISIONS) {
			expect(r.surface).toBe("tool-result-envelope")
			expect(r.status).toBe("stable")
		}
	})

	test("bridge schema has at least one stable revision", () => {
		expect(BRIDGE_SCHEMA_REVISIONS.length).toBeGreaterThan(0)
		for (const r of BRIDGE_SCHEMA_REVISIONS) {
			expect(r.surface).toBe("bridge")
			expect(r.status).toBe("stable")
		}
	})

	test("inspection tool set has at least one stable revision", () => {
		expect(PLUGIN_INSPECTION_TOOL_REVISIONS.length).toBeGreaterThan(0)
		for (const r of PLUGIN_INSPECTION_TOOL_REVISIONS) {
			expect(r.surface).toBe("inspection-tool")
			expect(r.status).toBe("stable")
		}
	})

	test("getSurfaceRevisionRecord returns the right record", () => {
		expect(getSurfaceRevisionRecord("bridge", 1)?.revision).toBe(1)
		expect(getSurfaceRevisionRecord("bridge", 99)).toBeNull()
	})

	test("getLatestSurfaceRevision returns the highest registered revision", () => {
		expect(getLatestSurfaceRevision("bridge")).toBe(
			BRIDGE_SCHEMA_REVISIONS[BRIDGE_SCHEMA_REVISIONS.length - 1].revision,
		)
		expect(getLatestSurfaceRevision("tool-result-envelope")).toBe(
			TOOL_RESULT_ENVELOPE_REVISIONS[TOOL_RESULT_ENVELOPE_REVISIONS.length - 1].revision,
		)
		expect(getLatestSurfaceRevision("inspection-tool")).toBe(
			PLUGIN_INSPECTION_TOOL_REVISIONS[PLUGIN_INSPECTION_TOOL_REVISIONS.length - 1].revision,
		)
	})

	test("getLatestSurfaceRevision returns 0 for surfaces without a revision table", () => {
		expect(getLatestSurfaceRevision("manifest")).toBe(0)
		expect(getLatestSurfaceRevision("tool")).toBe(0)
		expect(getLatestSurfaceRevision("panel")).toBe(0)
	})
})

describe("negotiateSurfaceRevision (via bridge / envelope / inspection wrappers)", () => {
	test("bridge negotiation accepts the registered revision when host meets the floor", () => {
		const decision = negotiateBridgeSchema({
			bridgeSchemaVersion: 1,
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxBridgeRevision: 1,
		})
		expect(decision.compatible).toBe(true)
		expect(decision.record?.surface).toBe("bridge")
	})

	test("bridge negotiation rejects when the host only knows an older revision", () => {
		const decision = negotiateBridgeSchema({
			bridgeSchemaVersion: 1,
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxBridgeRevision: 0,
		})
		expect(decision.compatible).toBe(false)
	})

	test("bridge negotiation rejects when the host app version is below the floor", () => {
		const decision = negotiateBridgeSchema({
			bridgeSchemaVersion: 1,
			hostAppVersion: "0.10.0",
			hostKnownMaxBridgeRevision: 1,
		})
		expect(decision.compatible).toBe(false)
		expect(decision.reason).toContain("bridge")
	})

	test("tool result envelope negotiation routes through the same table", () => {
		const decision = negotiateToolResultEnvelope({
			envelopeRevision: 1,
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxEnvelopeRevision: 1,
		})
		expect(decision.compatible).toBe(true)
		expect(decision.record?.surface).toBe("tool-result-envelope")
	})

	test("inspection tool set negotiation routes through the same table", () => {
		const decision = negotiateInspectionToolSet({
			inspectionToolRevision: 1,
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxInspectionRevision: 1,
		})
		expect(decision.compatible).toBe(true)
		expect(decision.record?.surface).toBe("inspection-tool")
	})

	test("rejects a non-positive surface revision", () => {
		const decision = negotiateBridgeSchema({
			bridgeSchemaVersion: 0,
			hostAppVersion: CURRENT_HOST_VERSION,
			hostKnownMaxBridgeRevision: 1,
		})
		expect(decision.compatible).toBe(false)
		expect(decision.reason).toContain("not positive")
	})
})

// ---------------------------------------------------------------------------
// Summary helper
// ---------------------------------------------------------------------------

describe("summarizeApiSurface", () => {
	test("summarizes a stable surface with no deprecation", () => {
		const annotation = annotateApiSurface({
			kind: "tool",
			name: "plugin.acme.foo.ping",
			tier: "stable",
			revision: 1,
		})
		const summary = summarizeApiSurface(annotation)
		expect(summary.kind).toBe("tool")
		expect(summary.name).toBe("plugin.acme.foo.ping")
		expect(summary.tier).toBe("stable")
		expect(summary.unstable).toBe(false)
		expect(summary.revision).toBe(1)
		expect(summary.deprecation).toBeNull()
	})

	test("summarizes a proposed surface as unstable", () => {
		const annotation = annotateApiSurface({
			kind: "bridge",
			name: "system-context-block-v2",
			tier: "proposed",
		})
		const summary = summarizeApiSurface(annotation)
		expect(summary.unstable).toBe(true)
	})

	test("summarizes an internal surface with attached deprecation metadata", () => {
		const annotation = annotateApiSurface({
			kind: "tool",
			name: "host-internal-debug",
			tier: "internal",
			deprecation: deprecationPolicySchema.parse({
				replacement: "host-public-debug",
				removalTarget: "1.0.0",
				codemod: { availability: "none" },
				migrationNote: "Move to host-public-debug.",
			}),
		})
		const summary = summarizeApiSurface(annotation)
		expect(summary.unstable).toBe(true)
		expect(summary.deprecation).not.toBeNull()
		expect(summary.deprecation?.replacement).toBe("host-public-debug")
		expect(summary.deprecation?.removalTarget).toBe("1.0.0")
		expect(summary.deprecation?.codemodAvailability).toBe("none")
		expect(summary.deprecation?.hasManualSteps).toBe(false)
	})
})
