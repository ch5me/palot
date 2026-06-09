import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test"

const mockGetAuthHeader = vi.fn<() => Promise<string | null>>()
const mockGetState = vi.fn<() => Promise<unknown>>()

vi.mock("../auth/token-store", () => ({
  getOrCreateTokenStore: () => ({
    getAuthHeader: mockGetAuthHeader,
    getState: mockGetState,
  }),
}))

async function loadClient() {
  const mod = await import("./firefly-runtime-client")
  return mod
}

beforeEach(() => {
  mockGetAuthHeader.mockReset()
  mockGetState.mockReset()
  delete process.env.FIREFLY_API_URL
  delete process.env.VITE_FIREFLY_API_URL
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("getFireflyRuntimeProvisioningStatus", () => {
  it("uses tokenStore.getAuthHeader() for the Bearer header", async () => {
    mockGetAuthHeader.mockResolvedValue("Bearer {{FF_SEC_000134}}")

    let seenAuth: string | null = null
    let seenUrl: string | null = null
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      seenUrl = typeof input === "string" ? input : input.toString()
      const headers = new Headers(init?.headers ?? undefined)
      seenAuth = headers.get("Authorization")
      return new Response(
        JSON.stringify({
          state: "ready",
          runtimeId: "r-1",
          region: "us-east-1",
          healthy: true,
          lastUpdated: "2026-06-08T20:00:00Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }) as typeof fetch

    const { getFireflyRuntimeProvisioningStatus } = await loadClient()
    const status = await getFireflyRuntimeProvisioningStatus({
      apiUrl: "https://api.example.com",
      fetchImpl,
    })

    expect(status.state).toBe("ready")
    expect(status.runtimeId).toBe("r-1")
    expect(status.region).toBe("us-east-1")
    expect(status.healthy).toBe(true)
    expect(seenUrl).toBe("https://api.example.com/runtime/status")
    expect(seenAuth?.startsWith("Bearer ")).toBe(true)
    expect(seenAuth?.length).toBeGreaterThan("Bearer ".length)
    expect(mockGetAuthHeader).toHaveBeenCalledTimes(1)
  })

  it("throws when no auth token is available", async () => {
    mockGetAuthHeader.mockResolvedValue(null)
    const { getFireflyRuntimeProvisioningStatus } = await loadClient()
    await expect(
      getFireflyRuntimeProvisioningStatus({ apiUrl: "https://api.example.com" }),
    ).rejects.toThrow(/not signed in/)
  })

  it("surfaces a clear error on non-2xx", async () => {
    mockGetAuthHeader.mockResolvedValue("Bearer test-token-value-not-real")
    const fetchImpl = (async () =>
      new Response("boom", { status: 503, statusText: "Service Unavailable" })) as typeof fetch
    const { getFireflyRuntimeProvisioningStatus } = await loadClient()
    await expect(
      getFireflyRuntimeProvisioningStatus({ apiUrl: "https://api.example.com", fetchImpl }),
    ).rejects.toThrow(/503/)
  })
})

describe("claimFireflyRuntime", () => {
  it("POSTs with Bearer auth and source tag", async () => {
    mockGetAuthHeader.mockResolvedValue("Bearer test-token-value-not-real")
    let seenMethod: string | null = null
    let seenBody: string | null = null
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      seenMethod = init?.method ?? null
      seenBody = typeof init?.body === "string" ? init.body : null
      return new Response(JSON.stringify({ runtimeId: "r-1", status: "claimed" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch
    const { claimFireflyRuntime } = await loadClient()
    const result = await claimFireflyRuntime({ apiUrl: "https://api.example.com", fetchImpl })
    expect(seenMethod).toBe("POST")
    expect(JSON.parse(seenBody ?? "{}")).toEqual({ source: "firefly-desktop" })
    expect(result.runtimeId).toBe("r-1")
    expect(result.status).toBe("claimed")
  })
})
