/**
 * F4 — uninstall / disable / update lifecycle.
 *
 * Proves the marketplace lifecycle tears down the LIVE runtime + revokes grants
 * (not just flips a DB row), and that an update re-consents on capability change
 * rather than silently inheriting a previous version's dangerous-capability grant.
 */

import { describe, expect, it } from "bun:test"
import {
	uninstallExtension,
	updateExtension,
	type LifecycleDeps,
	type InstallResult,
	type InstallInput,
} from "./install-orchestrator"

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function makeStore(opts: {
	pluginId: string
	version: string
	installationId: string
}) {
	const calls: { lifecycle: Array<[string, string]> } = { lifecycle: [] }
	const store = {
		getInstallationById: async (id: string) =>
			id === opts.installationId
				? {
						id,
						packageId: "pkg-1",
						lifecycleState: "installed",
						trustTier: "signed-third-party",
						scope: "app",
						appliedThemeId: null,
						installedAt: 1,
						updatedAt: 1,
					}
				: null,
		getExtensionPackage: async (id: string) =>
			id === "pkg-1"
				? {
						id: "pkg-1",
						externalId: opts.pluginId,
						publisher: "bobsoft",
						name: "linter",
						version: opts.version,
						displayName: null,
						registrySource: "manual-vsix" as const,
						vsixPath: null,
						unpackedPath: "/fake/unpacked",
						signatureState: "verified" as const,
						scanState: "clean" as const,
						themesJson: null,
						publisherKeyId: "firefly-registry-root-2026",
						signatureAlgorithm: "ed25519",
						signatureB64: "AAAA",
						signedManifestJson: null,
						pluginManifestJson: null,
						requiredCapabilitiesJson: null,
						createdAt: 1,
					}
				: null,
		updateInstallationLifecycle: async (id: string, state: string) => {
			calls.lifecycle.push([id, state])
		},
	}
	return { store: store as unknown as NonNullable<LifecycleDeps["store"]>, calls }
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------

describe("uninstallExtension (F4)", () => {
	it("tears down the worker, revokes all grants, flips lifecycle, refreshes catalog", async () => {
		const { store, calls } = makeStore({
			pluginId: "bobsoft.linter",
			version: "0.1.0",
			installationId: "inst-1",
		})
		const disabled: string[] = []
		const revoked: string[] = []
		let refreshed = 0

		await uninstallExtension("inst-1", {
			store,
			supervisor: { disable: (id) => disabled.push(id) },
			grantStore: {
				revokeAll: async (id) => {
					revoked.push(id)
				},
				revokeAllForVersion: async () => {},
			},
			refreshCatalog: async () => {
				refreshed += 1
			},
		})

		expect(disabled).toEqual(["bobsoft.linter"]) // worker torn down at the spawn boundary
		expect(revoked).toEqual(["bobsoft.linter"]) // grants revoked so re-install re-consents
		expect(calls.lifecycle).toEqual([["inst-1", "removed"]])
		expect(refreshed).toBe(1)
	})

	it("still flips lifecycle + refreshes when the installation is already gone", async () => {
		const { store, calls } = makeStore({
			pluginId: "bobsoft.linter",
			version: "0.1.0",
			installationId: "inst-1",
		})
		let refreshed = 0
		await uninstallExtension("missing-inst", {
			store,
			supervisor: {
				disable: () => {
					throw new Error("should not be called for an unknown installation")
				},
			},
			grantStore: { revokeAll: async () => {}, revokeAllForVersion: async () => {} },
			refreshCatalog: async () => {
				refreshed += 1
			},
		})
		expect(calls.lifecycle).toEqual([["missing-inst", "removed"]])
		expect(refreshed).toBe(1)
	})
})

// ---------------------------------------------------------------------------
// Update — re-consent on capability change
// ---------------------------------------------------------------------------

describe("updateExtension (F4)", () => {
	function fakeInstallResult(version: string): InstallResult {
		return {
			package: {
				id: "pkg-1",
				externalId: "bobsoft.linter",
				publisher: "bobsoft",
				name: "linter",
				version,
				displayName: null,
				registrySource: "manual-vsix",
				vsixPath: null,
				unpackedPath: "/fake/unpacked",
				signatureState: "verified",
				scanState: "clean",
				themesJson: null,
				publisherKeyId: "firefly-registry-root-2026",
				signatureAlgorithm: "ed25519",
				signatureB64: "AAAA",
				signedManifestJson: null,
				pluginManifestJson: null,
				requiredCapabilitiesJson: null,
				createdAt: 1,
			} as unknown as InstallResult["package"],
			installation: {
				id: "inst-2",
				packageId: "pkg-1",
				lifecycleState: "installed",
				trustTier: "signed-third-party",
				scope: "app",
				appliedThemeId: null,
				installedAt: 1,
				updatedAt: 1,
			} as unknown as InstallResult["installation"],
			themes: [],
			alreadyInstalled: false,
			descriptor: null,
		}
	}

	it("does NOT carry forward a newly-declared medium+ capability (forces re-consent)", async () => {
		// v1 declared+consented net:http; v2 redeclares net:http AND adds fs:write.
		const capturedConsent: Array<readonly string[] | undefined> = []
		const input = {
			kind: "local-vsix",
			vsixPath: "/fake/v2.vsix",
			requiredCapabilities: ["net:http", "fs:write"],
		} as unknown as InstallInput

		await updateExtension(
			input,
			{
				previousCapabilities: ["net:http"],
				consentedCapabilities: ["net:http"], // user previously consented to net:http only
				grantStore: {} as never,
			},
			{
				installFn: async (_input, opts) => {
					capturedConsent.push(opts?.consentedCapabilities)
					return fakeInstallResult("0.2.0")
				},
				grantStore: { revokeAll: async () => {}, revokeAllForVersion: async () => {} },
			},
		)

		const passed = capturedConsent[0] ?? []
		// net:http carries (unchanged + previously consented); fs:write must NOT —
		// it lands back at prompt-required so the user re-consents.
		expect(passed).toContain("net:http")
		expect(passed).not.toContain("fs:write")
	})
})
