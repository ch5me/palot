import { describe, expect, it } from "bun:test"

import { buildConsentItems, defaultApprovedSelection, describeCapability } from "./capability-consent"

describe("capability-consent model", () => {
	it("orders items most-dangerous first and dedupes", () => {
		const items = buildConsentItems(["net:https-only", "shell:exec", "net:http", "shell:exec"])
		expect(items.map((i) => i.capability)).toEqual(["shell:exec", "net:http", "net:https-only"])
		// shell:exec critical, net:http medium, net:https-only low
		expect(items.map((i) => i.risk)).toEqual(["critical", "medium", "low"])
	})

	it("marks unknown capabilities as critical + not-known", () => {
		const [item] = buildConsentItems(["totally:made-up"])
		expect(item?.risk).toBe("critical")
		expect(item?.knownToHost).toBe(false)
		expect(item?.description).toContain("Unknown capability")
	})

	it("derives a readable description from the catalog", () => {
		expect(describeCapability("net:http")).toBe("Network: http")
		expect(describeCapability("fs:write")).toBe("Filesystem: write")
		expect(describeCapability("host:bridge.session-read")).toContain("Host integration")
	})

	it("is deny-by-default (no pre-selected approvals)", () => {
		expect(defaultApprovedSelection()).toEqual([])
	})
})
