import assert from "node:assert/strict"
import test from "node:test"
import { encodeBrowserLaneAuth, parseBrowserLaneArgs, readBrowserLaneAuthFromEnv } from "./lib"

test("parse browser lane args supports remote mode and ssh target", () => {
	const args = parseBrowserLaneArgs([
		"--mode",
		"remote",
		"--ssh",
		"root@example",
		"--lane",
		"remote-default",
	])
	assert.equal(args.mode, "remote")
	assert.equal(args.ssh, "root@example")
	assert.equal(args.lane, "remote-default")
})

test("encodeBrowserLaneAuth produces basic auth header value", () => {
	const value = encodeBrowserLaneAuth({ user: "abc", password: "abc" })
	const expected = `Basic ${Buffer.from("abc:abc").toString("base64")}`
	assert.equal(value, expected)
})

test("readBrowserLaneAuthFromEnv returns null when missing", () => {
	assert.equal(readBrowserLaneAuthFromEnv({}), null)
})

test("parse browser lane args supports explicit remote endpoints", () => {
	const args = parseBrowserLaneArgs([
		"--mode",
		"remote",
		"--stream-backend-url",
		"https://remote.example/browser/remote-default/",
		"--cdp-endpoint",
		"https://remote.example/devtools/browser/remote-default",
		"--profile-path",
		"/srv/browser-profiles/remote-default",
	])
	assert.equal(args.streamBackendUrl, "https://remote.example/browser/remote-default/")
	assert.equal(args.cdpEndpoint, "https://remote.example/devtools/browser/remote-default")
	assert.equal(args.profilePath, "/srv/browser-profiles/remote-default")
})

test("parse browser lane args defaults to local default lane", () => {
	const args = parseBrowserLaneArgs([])
	assert.equal(args.mode, "local")
	assert.equal(args.lane, "default")
	assert.equal(args.ssh, null)
	assert.equal(args.verbose, false)
})

test("parse browser lane args supports verbose flag", () => {
	const args = parseBrowserLaneArgs(["--verbose"])
	assert.equal(args.verbose, true)
})
