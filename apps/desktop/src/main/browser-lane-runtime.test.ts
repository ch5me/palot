import assert from "node:assert/strict"
import test from "node:test"
import {
	createBrowserLaneRuntimeConfig,
	renderBrowserLaneCompose,
} from "./browser-lane-runtime"

test("builds distinct stream and cdp endpoints", async () => {
	const config = await createBrowserLaneRuntimeConfig(
		{
			id: "default",
			label: "Default",
			mode: "local",
			runtime: "docker-chromium",
			streamBackendUrl: null,
			cdpEndpoint: null,
			profilePath: "/tmp/browser-profile-default",
			host: null,
			createdAt: 1,
			updatedAt: 2,
		},
		{
			platform: process.platform,
			localRuntimeSupported: true,
			remoteAttachSupported: process.platform !== "win32",
			docker: { installed: true, version: "Docker version 27" },
			compose: { available: true, command: "docker compose", version: "v2" },
			unsupportedReason: null,
			remediation: null,
		},
	)
	assert.match(config.streamBackendUrl, /:/)
	assert.match(config.cdpEndpoint, /:/)
	assert.notEqual(config.streamBackendUrl, config.cdpEndpoint)
	assert.equal(config.startUrl, "https://example.com")
})

test("renders persistent profile volume in compose", () => {
	const compose = renderBrowserLaneCompose({
		laneId: "default",
		host: "127.0.0.1",
		streamPort: 3901,
		cdpPort: 9229,
		profilePath: "/tmp/browser-profile-default",
		runtimeDir: "/tmp/browser-runtime-default",
		composeFile: "/tmp/browser-runtime-default/docker-compose.yml",
		envFile: "/tmp/browser-runtime-default/.env",
		streamBackendUrl: "http://127.0.0.1:3901",
		cdpEndpoint: "http://127.0.0.1:9229",
		auth: { user: "abc", password: "abc" },
		startUrl: "https://example.com",
	})
	assert.match(compose, /\/tmp\/browser-profile-default:\/config/)
	assert.match(compose, /"3901:3000"/)
	assert.match(compose, /"9229:9222"/)
	assert.match(compose, /NO_DECOR=1/)
	assert.match(compose, /--app=https:\/\/example\.com/)
	assert.doesNotMatch(compose, /SELKIES_MANUAL_WIDTH/)
	assert.doesNotMatch(compose, /SELKIES_MANUAL_HEIGHT/)
	assert.doesNotMatch(compose, /--window-size/)
})
