import { describe, expect, it } from "bun:test"

import { lastScope } from "./textmate-runtime"

describe("textmate-runtime", () => {
	it("lastScope picks the most specific scope (deepest)", () => {
		expect(lastScope(["source.ts", "meta.keyword", "keyword.control.ts"])).toBe("keyword.control.ts")
	})

	it("lastScope returns empty string for no scopes", () => {
		expect(lastScope([])).toBe("")
	})

	it("lastScope handles a single scope", () => {
		expect(lastScope(["string.quoted.double.ts"])).toBe("string.quoted.double.ts")
	})
})
