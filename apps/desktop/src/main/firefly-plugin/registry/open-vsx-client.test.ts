/**
 * Tests for the Open VSX registry client (read-only).
 *
 * Uses injectable fetch to avoid real network calls.
 */

import { describe, expect, test } from "bun:test"

import {
	createOpenVsxClient,
	OPEN_VSX_BASE_URL,
	OpenVsxApiError,
	type FetchFn,
	type RegistrySearchResult,
	type RegistryVersionMetadata,
} from "./open-vsx-client"

// ---------------------------------------------------------------------------
// Fake fetch helpers
// ---------------------------------------------------------------------------

function makeOkResponse(body: unknown): ReturnType<FetchFn> {
	return Promise.resolve({
		ok: true,
		status: 200,
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(JSON.stringify(body)),
	})
}

function makeErrorResponse(status: number, body = ""): ReturnType<FetchFn> {
	return Promise.resolve({
		ok: false,
		status,
		json: () => Promise.reject(new Error("not json")),
		text: () => Promise.resolve(body),
	})
}

// ---------------------------------------------------------------------------
// Fixture data (minimal valid API responses)
// ---------------------------------------------------------------------------

const SEARCH_RESPONSE = {
	offset: 0,
	totalSize: 1,
	extensions: [
		{
			namespace: "zhuangtongfa",
			name: "material-theme",
			displayName: "One Dark Pro",
			description: "Atom's iconic One Dark theme",
			version: "3.21.5",
			timestamp: "2024-01-15T10:00:00.000Z",
			averageRating: 4.8,
			downloadCount: 2000000,
			files: {
				icon: "https://open-vsx.org/api/zhuangtongfa/material-theme/3.21.5/file/icon.png",
				download: "https://open-vsx.org/api/zhuangtongfa/material-theme/3.21.5/file/download",
			},
		},
	],
}

const VERSION_RESPONSE = {
	namespace: "zhuangtongfa",
	name: "material-theme",
	displayName: "One Dark Pro",
	description: "Atom's iconic One Dark theme",
	version: "3.21.5",
	timestamp: "2024-01-15T10:00:00.000Z",
	engines: { vscode: "^1.50.0" },
	categories: ["Themes"],
	tags: ["dark", "atom", "one-dark"],
	license: "MIT",
	homepage: "https://github.com/Binaryify/OneDark-Pro",
	repository: { url: "https://github.com/Binaryify/OneDark-Pro.git" },
	bugs: { url: "https://github.com/Binaryify/OneDark-Pro/issues" },
	files: {
		icon: "https://open-vsx.org/.../icon.png",
		download: "https://open-vsx.org/.../download",
		sha256: "https://open-vsx.org/.../sha256",
		readme: "https://open-vsx.org/.../readme",
		changelog: "https://open-vsx.org/.../changelog",
	},
	contributes: {
		themes: [
			{ id: "OneDark-Pro", label: "One Dark Pro", uiTheme: "vs-dark", path: "./themes/OneDark-Pro.json" },
		],
	},
}

// ---------------------------------------------------------------------------
// createOpenVsxClient — basic shape
// ---------------------------------------------------------------------------

describe("createOpenVsxClient", () => {
	test("exposes registryId, kind, baseUrl", () => {
		const client = createOpenVsxClient({ fetch: () => makeOkResponse({}) })
		expect(client.registryId).toBe("open-vsx")
		expect(client.kind).toBe("open-vsx")
		expect(client.baseUrl).toBe(OPEN_VSX_BASE_URL)
	})

	test("accepts custom baseUrl and registryId", () => {
		const client = createOpenVsxClient({
			baseUrl: "https://my-mirror.example.com/api",
			registryId: "my-vsx",
			fetch: () => makeOkResponse({}),
		})
		expect(client.baseUrl).toBe("https://my-mirror.example.com/api")
		expect(client.registryId).toBe("my-vsx")
	})

	test("strips trailing slash from baseUrl", () => {
		const client = createOpenVsxClient({
			baseUrl: "https://open-vsx.org/api/",
			fetch: () => makeOkResponse({}),
		})
		expect(client.baseUrl).toBe("https://open-vsx.org/api")
	})
})

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

describe("client.search", () => {
	test("calls the correct endpoint with no options", async () => {
		let capturedUrl = ""
		const fakeFetch: FetchFn = (url) => {
			capturedUrl = url
			return makeOkResponse(SEARCH_RESPONSE)
		}
		const client = createOpenVsxClient({ fetch: fakeFetch, baseUrl: "https://api.example.com" })
		await client.search()
		expect(capturedUrl).toBe("https://api.example.com/v2/-/search")
	})

	test("encodes query string params", async () => {
		let capturedUrl = ""
		const fakeFetch: FetchFn = (url) => {
			capturedUrl = url
			return makeOkResponse(SEARCH_RESPONSE)
		}
		const client = createOpenVsxClient({ fetch: fakeFetch, baseUrl: "https://api.example.com" })
		await client.search({ query: "dark theme", category: "Themes", size: 20, offset: 10 })
		expect(capturedUrl).toContain("query=dark+theme")
		expect(capturedUrl).toContain("category=Themes")
		expect(capturedUrl).toContain("size=20")
		expect(capturedUrl).toContain("offset=10")
	})

	test("caps size at 100", async () => {
		let capturedUrl = ""
		const fakeFetch: FetchFn = (url) => {
			capturedUrl = url
			return makeOkResponse(SEARCH_RESPONSE)
		}
		const client = createOpenVsxClient({ fetch: fakeFetch, baseUrl: "https://api.example.com" })
		await client.search({ size: 9999 })
		expect(capturedUrl).toContain("size=100")
	})

	test("returns typed RegistrySearchResult", async () => {
		const client = createOpenVsxClient({
			fetch: () => makeOkResponse(SEARCH_RESPONSE),
		})
		const result: RegistrySearchResult = await client.search({ query: "one dark" })
		expect(result.totalSize).toBe(1)
		expect(result.offset).toBe(0)
		expect(result.extensions).toHaveLength(1)
		const ext = result.extensions[0]!
		expect(ext.namespace).toBe("zhuangtongfa")
		expect(ext.name).toBe("material-theme")
		expect(ext.displayName).toBe("One Dark Pro")
		expect(ext.version).toBe("3.21.5")
		expect(ext.downloadCount).toBe(2000000)
		expect(ext.iconUrl).toContain("icon.png")
	})

	test("handles empty search response", async () => {
		const client = createOpenVsxClient({
			fetch: () => makeOkResponse({ offset: 0, totalSize: 0, extensions: [] }),
		})
		const result = await client.search()
		expect(result.extensions).toHaveLength(0)
		expect(result.totalSize).toBe(0)
	})

	test("defaults missing optional fields to null", async () => {
		const minimalEntry = {
			offset: 0,
			totalSize: 1,
			extensions: [
				{
					namespace: "foo",
					name: "bar",
					version: "1.0.0",
					files: {},
				},
			],
		}
		const client = createOpenVsxClient({ fetch: () => makeOkResponse(minimalEntry) })
		const result = await client.search()
		const ext = result.extensions[0]!
		expect(ext.displayName).toBeNull()
		expect(ext.description).toBeNull()
		expect(ext.timestamp).toBeNull()
		expect(ext.averageRating).toBeNull()
		expect(ext.downloadCount).toBeNull()
		expect(ext.iconUrl).toBeNull()
	})

	test("throws OpenVsxApiError on non-2xx response", async () => {
		const client = createOpenVsxClient({
			fetch: () => makeErrorResponse(404, "not found"),
		})
		await expect(client.search()).rejects.toThrow(OpenVsxApiError)
	})

	test("OpenVsxApiError carries status and endpoint", async () => {
		const client = createOpenVsxClient({
			fetch: () => makeErrorResponse(429, "rate limited"),
			baseUrl: "https://api.example.com",
		})
		let caught: OpenVsxApiError | null = null
		try {
			await client.search()
		} catch (err) {
			caught = err as OpenVsxApiError
		}
		expect(caught).not.toBeNull()
		expect(caught?.status).toBe(429)
		expect(caught?.endpoint).toBe("/v2/-/search")
	})
})

// ---------------------------------------------------------------------------
// getVersion
// ---------------------------------------------------------------------------

describe("client.getVersion", () => {
	test("calls the correct endpoint", async () => {
		let capturedUrl = ""
		const fakeFetch: FetchFn = (url) => {
			capturedUrl = url
			return makeOkResponse(VERSION_RESPONSE)
		}
		const client = createOpenVsxClient({ fetch: fakeFetch, baseUrl: "https://api.example.com" })
		await client.getVersion("zhuangtongfa", "material-theme", "3.21.5")
		expect(capturedUrl).toBe("https://api.example.com/zhuangtongfa/material-theme/3.21.5")
	})

	test("URL-encodes namespace, name, version", async () => {
		let capturedUrl = ""
		const fakeFetch: FetchFn = (url) => {
			capturedUrl = url
			return makeOkResponse(VERSION_RESPONSE)
		}
		const client = createOpenVsxClient({ fetch: fakeFetch, baseUrl: "https://api.example.com" })
		await client.getVersion("my ns", "my ext", "1.0.0+build")
		expect(capturedUrl).toContain("my%20ns")
		expect(capturedUrl).toContain("my%20ext")
	})

	test("returns typed RegistryVersionMetadata", async () => {
		const client = createOpenVsxClient({
			fetch: () => makeOkResponse(VERSION_RESPONSE),
		})
		const meta: RegistryVersionMetadata = await client.getVersion(
			"zhuangtongfa",
			"material-theme",
			"3.21.5",
		)
		expect(meta.namespace).toBe("zhuangtongfa")
		expect(meta.name).toBe("material-theme")
		expect(meta.version).toBe("3.21.5")
		expect(meta.license).toBe("MIT")
		expect(meta.engines).toMatchObject({ vscode: "^1.50.0" })
		expect(meta.categories).toContain("Themes")
		expect(meta.downloadUrl).toContain("download")
		expect(meta.repository).toBe("https://github.com/Binaryify/OneDark-Pro.git")
		expect(meta.bugs).toBe("https://github.com/Binaryify/OneDark-Pro/issues")
	})

	test("contributes field is preserved", async () => {
		const client = createOpenVsxClient({ fetch: () => makeOkResponse(VERSION_RESPONSE) })
		const meta = await client.getVersion("a", "b", "1.0.0")
		expect(meta.contributes).not.toBeNull()
		expect(Array.isArray((meta.contributes as Record<string, unknown>)["themes"])).toBe(true)
	})

	test("null repository and bugs when absent", async () => {
		const rawNoRepo = { ...VERSION_RESPONSE, repository: null, bugs: null }
		const client = createOpenVsxClient({ fetch: () => makeOkResponse(rawNoRepo) })
		const meta = await client.getVersion("a", "b", "1.0.0")
		expect(meta.repository).toBeNull()
		expect(meta.bugs).toBeNull()
	})

	test("throws OpenVsxApiError on 404", async () => {
		const client = createOpenVsxClient({ fetch: () => makeErrorResponse(404) })
		await expect(client.getVersion("ns", "name", "1.0.0")).rejects.toThrow(OpenVsxApiError)
	})
})

// ---------------------------------------------------------------------------
// getLatest
// ---------------------------------------------------------------------------

describe("client.getLatest", () => {
	test("calls the /latest endpoint", async () => {
		let capturedUrl = ""
		const fakeFetch: FetchFn = (url) => {
			capturedUrl = url
			return makeOkResponse(VERSION_RESPONSE)
		}
		const client = createOpenVsxClient({ fetch: fakeFetch, baseUrl: "https://api.example.com" })
		await client.getLatest("zhuangtongfa", "material-theme")
		expect(capturedUrl).toBe("https://api.example.com/zhuangtongfa/material-theme/latest")
	})

	test("returns the same shape as getVersion", async () => {
		const client = createOpenVsxClient({ fetch: () => makeOkResponse(VERSION_RESPONSE) })
		const meta = await client.getLatest("zhuangtongfa", "material-theme")
		expect(meta.namespace).toBe("zhuangtongfa")
		expect(meta.version).toBe("3.21.5")
	})

	test("throws OpenVsxApiError on 500", async () => {
		const client = createOpenVsxClient({ fetch: () => makeErrorResponse(500, "server error") })
		await expect(client.getLatest("ns", "name")).rejects.toThrow(OpenVsxApiError)
	})
})

// ---------------------------------------------------------------------------
// OpenVsxApiError shape
// ---------------------------------------------------------------------------

describe("OpenVsxApiError", () => {
	test("is an instance of Error", () => {
		const err = new OpenVsxApiError(404, "/api/foo", "not found")
		expect(err instanceof Error).toBe(true)
	})

	test("name is OpenVsxApiError", () => {
		const err = new OpenVsxApiError(404, "/api/foo", "not found")
		expect(err.name).toBe("OpenVsxApiError")
	})

	test("message includes status, endpoint, and body", () => {
		const err = new OpenVsxApiError(429, "/api/search", "rate limited")
		expect(err.message).toContain("429")
		expect(err.message).toContain("/api/search")
		expect(err.message).toContain("rate limited")
	})
})
