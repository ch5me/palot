import { describe, expect, test } from "bun:test"
import { isVoiceSupported, parseTranscript } from "./voice"

describe("isVoiceSupported", () => {
	test("returns an object with available flag and reason", () => {
		const result = isVoiceSupported()
		expect(typeof result.available).toBe("boolean")
		expect(result.reason === null || typeof result.reason === "string").toBe(true)
	})

	test("returns a clear reason in non-browser runtimes", () => {
		const result = isVoiceSupported()
		if (typeof navigator === "undefined" || !navigator.mediaDevices) {
			expect(result.available).toBe(false)
			expect(typeof result.reason).toBe("string")
		}
	})
})

describe("parseTranscript", () => {
	test("returns trimmed text from whisper JSON shape", () => {
		expect(parseTranscript('{"text":"hello world"}')).toBe("hello world")
		expect(parseTranscript('  {"text": "  spaced  "}  ')).toBe("spaced")
	})

	test("throws on malformed JSON", () => {
		expect(() => parseTranscript("not json at all")).toThrow(/could not parse transcription response/)
	})

	test("throws when text is missing or wrong type", () => {
		expect(() => parseTranscript("{}")).toThrow(/no text/)
		expect(() => parseTranscript('{"text":42}')).toThrow(/no text/)
	})
})
