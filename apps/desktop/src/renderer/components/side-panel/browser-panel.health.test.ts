import { describe, expect, test } from "bun:test"
import { buildDirectIframeHealth } from "./browser-panel"

describe("browser panel direct iframe health", () => {
	test("marks cleared target as stopped with no stream URL", () => {
		const health = buildDirectIframeHealth("about:blank", false)
		expect(health.status).toBe("stopped")
		expect(health.stream.url).toBeNull()
		expect(health.stream.state).toBe("unknown")
		expect(health.message).toBe("Target cleared")
		expect(health.cdp.state).toBe("not-applicable")
	})

	test("marks reachable target as running", () => {
		const health = buildDirectIframeHealth("https://example.com/app", true)
		expect(health.status).toBe("running")
		expect(health.stream.url).toBe("https://example.com/app")
		expect(health.stream.state).toBe("ready")
		expect(health.message).toBe("Direct iframe ready")
		expect(health.cdp.state).toBe("not-applicable")
	})

	test("marks unreachable target as error", () => {
		const health = buildDirectIframeHealth("https://example.com/app", false)
		expect(health.status).toBe("error")
		expect(health.stream.url).toBe("https://example.com/app")
		expect(health.stream.state).toBe("failed")
		expect(health.stream.error).toBe("Target URL unreachable")
		expect(health.message).toBe("Direct iframe unreachable or not configured")
		expect(health.cdp.state).toBe("not-applicable")
	})
})
