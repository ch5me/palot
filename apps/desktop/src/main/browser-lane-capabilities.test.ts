import assert from "node:assert/strict"
import test from "node:test"
import { detectBrowserLaneCapabilities } from "./browser-lane-capabilities"

test("reports local runtime support when docker and compose exist", async () => {
	const report = await detectBrowserLaneCapabilities(async (command, args) => {
		const key = `${command} ${args.join(" ")}`
		if (key === "docker --version") return "Docker version 27.0.0"
		if (key === "docker compose version") return "Docker Compose version v2.29.0"
		return null
	})
	assert.equal(report.docker.installed, true)
	assert.equal(report.compose.available, true)
	assert.equal(report.compose.command, "docker compose")
	assert.equal(report.localRuntimeSupported, true)
})

test("returns actionable unsupported reason when docker missing", async () => {
	const report = await detectBrowserLaneCapabilities(async () => null)
	assert.equal(report.localRuntimeSupported, false)
	assert.equal(report.unsupportedReason, "Docker not installed")
	assert.match(report.remediation ?? "", /Install Docker/)
})
