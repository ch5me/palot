/**
 * Unit tests for `createFireflyRegistryClient` (Wave 4a).
 *
 * Covers:
 *   1. `getLatest` returns `FireflyVersionMetadata` with `downloadUrl` + `servedSignature`.
 *   2. `getVersion` returns the same shape for a pinned version.
 *   3. Absent base URL (no explicit option, no env var) → `FireflyGalleryUrlMissingError`
 *      thrown on the first API call.
 *   4. Non-2xx response → `FireflyGalleryApiError`.
 *   5. `servedSignature` is null when gallery omits the `signature` field.
 *   6. Zod validation strips unknown fields from the gallery response.
 */

import { describe, expect, it } from "bun:test"
import {
	createFireflyRegistryClient,
	FireflyGalleryApiError,
	FireflyGalleryUrlMissingError,
} from "./firefly-registry-client"
import type { FetchFn } from "./open-vsx-client"
import type { ServedSignatureMetadata } from "../../../shared/firefly-plugin/registry-signature-contract"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_BASE_URL = "https://api.ch5-test.internal"

const FIXTURE_SIGNATURE: ServedSignatureMetadata = {
	manifest: {
		namespace: "ch5",
		name: "code-assist",
		version: "1.2.3",
		contentSha256: "a".repeat(64),
		algorithm: "ed25519",
		signedAt: "2026-06-16T00:00:00.000Z",
		publisherKeyId: "test-key-id",
	},
	signatureB64: "dGVzdHNpZw==",
}

const FIXTURE_GALLERY_RESPONSE = {
	namespace: "ch5",
	name: "code-assist",
	version: "1.2.3",
	displayName: "CH5 Code Assist",
	description: "AI-powered code assistance",
	timestamp: "2026-06-16T00:00:00.000Z",
	engines: { "firefly": ">=0.1.0" },
	categories: ["AI"],
	tags: ["ai", "code"],
	license: "MIT",
	homepage: "https://ch5.ai",
	repository: "https://github.com/ch5/code-assist",
	bugs: "https://github.com/ch5/code-assist/issues",
	downloadUrl: "https://cdn.ch5-test.internal/packages/ch5/code-assist/1.2.3.fpk",
	sha256: "b".repeat(64),
	iconUrl: "https://cdn.ch5-test.internal/icons/ch5/code-assist.png",
	signature: FIXTURE_SIGNATURE,
}

function makeFetchFn(responsesByUrl: Record<string, unknown>): FetchFn {
	return async (url: string) => {
		const body = responsesByUrl[url]
		if (body === undefined) {
			return {
				ok: false,
				status: 404,
				json: async () => ({ error: "not found" }),
				text: async () => "not found",
			}
		}
		if (body instanceof Error) {
			throw body
		}
		return {
			ok: true,
			status: 200,
			json: async () => body,
			text: async () => JSON.stringify(body),
		}
	}
}

function makeErrorFetchFn(status: number, body = ""): FetchFn {
	return async () => ({
		ok: false,
		status,
		json: async () => ({ error: body }),
		text: async () => body,
	})
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createFireflyRegistryClient — getLatest", () => {
	it("returns FireflyVersionMetadata with downloadUrl + servedSignature from gallery response", async () => {
		const expectedUrl = `${TEST_BASE_URL}/firefly-plugin/gallery/ch5/code-assist/latest`
		const client = createFireflyRegistryClient({
			baseUrl: TEST_BASE_URL,
			fetch: makeFetchFn({ [expectedUrl]: FIXTURE_GALLERY_RESPONSE }),
		})

		const meta = await client.getLatest("ch5", "code-assist")

		expect(meta.namespace).toBe("ch5")
		expect(meta.name).toBe("code-assist")
		expect(meta.version).toBe("1.2.3")
		expect(meta.downloadUrl).toBe(
			"https://cdn.ch5-test.internal/packages/ch5/code-assist/1.2.3.fpk",
		)
		expect(meta.sha256).toBe("b".repeat(64))
		expect(meta.displayName).toBe("CH5 Code Assist")
		expect(meta.description).toBe("AI-powered code assistance")
		expect(meta.license).toBe("MIT")
		expect(meta.engines).toEqual({ firefly: ">=0.1.0" })

		// servedSignature carries CanonicalSignedManifest + signatureB64
		expect(meta.servedSignature).not.toBeNull()
		expect(meta.servedSignature!.signatureB64).toBe("dGVzdHNpZw==")
		expect(meta.servedSignature!.manifest.namespace).toBe("ch5")
		expect(meta.servedSignature!.manifest.name).toBe("code-assist")
		expect(meta.servedSignature!.manifest.version).toBe("1.2.3")
		expect(meta.servedSignature!.manifest.publisherKeyId).toBe("test-key-id")
		expect(meta.servedSignature!.manifest.algorithm).toBe("ed25519")
	})

	it("url-encodes namespace and name with special characters", async () => {
		let capturedUrl = ""
		const fetchFn: FetchFn = async (url: string) => {
			capturedUrl = url
			return {
				ok: true,
				status: 200,
				json: async () => ({
					...FIXTURE_GALLERY_RESPONSE,
					namespace: "ch5 org",
					name: "code/assist",
				}),
				text: async () => "",
			}
		}

		const client = createFireflyRegistryClient({ baseUrl: TEST_BASE_URL, fetch: fetchFn })
		await client.getLatest("ch5 org", "code/assist").catch(() => {})
		expect(capturedUrl).toBe(
			`${TEST_BASE_URL}/firefly-plugin/gallery/ch5%20org/code%2Fassist/latest`,
		)
	})
})

describe("createFireflyRegistryClient — getVersion", () => {
	it("returns FireflyVersionMetadata for a pinned version", async () => {
		const expectedUrl = `${TEST_BASE_URL}/firefly-plugin/gallery/ch5/code-assist/1.2.3`
		const client = createFireflyRegistryClient({
			baseUrl: TEST_BASE_URL,
			fetch: makeFetchFn({ [expectedUrl]: FIXTURE_GALLERY_RESPONSE }),
		})

		const meta = await client.getVersion("ch5", "code-assist", "1.2.3")

		expect(meta.version).toBe("1.2.3")
		expect(meta.downloadUrl).toBe(
			"https://cdn.ch5-test.internal/packages/ch5/code-assist/1.2.3.fpk",
		)
		expect(meta.servedSignature).not.toBeNull()
		expect(meta.servedSignature!.manifest.contentSha256).toBe("a".repeat(64))
	})
})

describe("createFireflyRegistryClient — servedSignature absent", () => {
	it("servedSignature is null when gallery omits the signature field (unsigned package)", async () => {
		const responseWithoutSig = { ...FIXTURE_GALLERY_RESPONSE, signature: undefined }
		const expectedUrl = `${TEST_BASE_URL}/firefly-plugin/gallery/ch5/code-assist/latest`
		const client = createFireflyRegistryClient({
			baseUrl: TEST_BASE_URL,
			fetch: makeFetchFn({ [expectedUrl]: responseWithoutSig }),
		})

		const meta = await client.getLatest("ch5", "code-assist")

		expect(meta.servedSignature).toBeNull()
	})

	it("servedSignature is null when gallery explicitly sends null", async () => {
		const responseWithNullSig = { ...FIXTURE_GALLERY_RESPONSE, signature: null }
		const expectedUrl = `${TEST_BASE_URL}/firefly-plugin/gallery/ch5/code-assist/latest`
		const client = createFireflyRegistryClient({
			baseUrl: TEST_BASE_URL,
			fetch: makeFetchFn({ [expectedUrl]: responseWithNullSig }),
		})

		const meta = await client.getLatest("ch5", "code-assist")

		expect(meta.servedSignature).toBeNull()
	})
})

describe("createFireflyRegistryClient — fail-fast on missing base URL", () => {
	it("throws FireflyGalleryUrlMissingError on the first call when no URL is configured", async () => {
		// Ensure the env var is absent for this test by passing an explicit undefined baseUrl
		// and using a fetch that should never be called.
		const neverFetch: FetchFn = async () => {
			throw new Error("fetch should not have been called — URL should fail first")
		}

		// Save + clear the env var temporarily if it is set
		const originalEnv = process.env["FIREFLY_CLOUD_URL"]
		delete process.env["FIREFLY_CLOUD_URL"]

		try {
			const client = createFireflyRegistryClient({ fetch: neverFetch })
			await expect(client.getLatest("ch5", "code-assist")).rejects.toThrow(
				FireflyGalleryUrlMissingError,
			)
		} finally {
			if (originalEnv !== undefined) {
				process.env["FIREFLY_CLOUD_URL"] = originalEnv
			}
		}
	})

	it("resolves base URL from FIREFLY_CLOUD_URL env var when no explicit baseUrl", async () => {
		const envUrl = "https://env-based.ch5.test"
		const expectedUrl = `${envUrl}/firefly-plugin/gallery/ch5/code-assist/latest`
		process.env["FIREFLY_CLOUD_URL"] = envUrl

		try {
			const client = createFireflyRegistryClient({
				fetch: makeFetchFn({ [expectedUrl]: FIXTURE_GALLERY_RESPONSE }),
			})
			const meta = await client.getLatest("ch5", "code-assist")
			expect(meta.version).toBe("1.2.3")
		} finally {
			delete process.env["FIREFLY_CLOUD_URL"]
		}
	})
})

describe("createFireflyRegistryClient — API errors", () => {
	it("throws FireflyGalleryApiError on non-2xx response", async () => {
		const client = createFireflyRegistryClient({
			baseUrl: TEST_BASE_URL,
			fetch: makeErrorFetchFn(404, "extension not found"),
		})

		await expect(client.getLatest("ch5", "missing")).rejects.toThrow(FireflyGalleryApiError)
	})

	it("FireflyGalleryApiError carries the status code and endpoint", async () => {
		const client = createFireflyRegistryClient({
			baseUrl: TEST_BASE_URL,
			fetch: makeErrorFetchFn(500, "internal server error"),
		})

		const err = await client.getLatest("ch5", "code-assist").catch((e: unknown) => e)
		expect(err).toBeInstanceOf(FireflyGalleryApiError)
		const apiErr = err as FireflyGalleryApiError
		expect(apiErr.status).toBe(500)
		expect(apiErr.endpoint).toContain("/firefly-plugin/gallery/")
	})
})

describe("createFireflyRegistryClient — Zod validation", () => {
	it("strips unknown extra fields from the gallery response", async () => {
		const responseWithExtra = {
			...FIXTURE_GALLERY_RESPONSE,
			unknownField: "should be stripped",
			anotherExtra: 42,
		}
		const expectedUrl = `${TEST_BASE_URL}/firefly-plugin/gallery/ch5/code-assist/latest`
		const client = createFireflyRegistryClient({
			baseUrl: TEST_BASE_URL,
			fetch: makeFetchFn({ [expectedUrl]: responseWithExtra }),
		})

		const meta = await client.getLatest("ch5", "code-assist")

		// Should not have unknown fields on the result
		expect((meta as unknown as Record<string, unknown>)["unknownField"]).toBeUndefined()
		// Known fields present
		expect(meta.version).toBe("1.2.3")
	})

	it("throws on a response missing the required downloadUrl field", async () => {
		const badResponse = { ...FIXTURE_GALLERY_RESPONSE, downloadUrl: undefined }
		const expectedUrl = `${TEST_BASE_URL}/firefly-plugin/gallery/ch5/code-assist/latest`
		const client = createFireflyRegistryClient({
			baseUrl: TEST_BASE_URL,
			fetch: makeFetchFn({ [expectedUrl]: badResponse }),
		})

		await expect(client.getLatest("ch5", "code-assist")).rejects.toThrow()
	})
})

describe("createFireflyRegistryClient — registryId / kind", () => {
	it("exposes kind='firefly' and registryId='firefly' by default", () => {
		const client = createFireflyRegistryClient({ baseUrl: TEST_BASE_URL })
		expect(client.kind).toBe("firefly")
		expect(client.registryId).toBe("firefly")
	})

	it("accepts a custom registryId", () => {
		const client = createFireflyRegistryClient({
			baseUrl: TEST_BASE_URL,
			registryId: "firefly-staging",
		})
		expect(client.registryId).toBe("firefly-staging")
	})
})
