import assert from "node:assert/strict"
import test from "node:test"
import {
	chromeCliForConfig,
	createBrowserLaneRuntimeConfig,
	renderBrowserLaneCompose,
} from "./browser-lane-runtime"

test("builds distinct stream and cdp endpoints", async () => {
	const config = await createBrowserLaneRuntimeConfig(
		{
			id: "default",
			label: "Default",
			surfaceKind: "selkies-stream",
			runtimeOwnership: "managed-local",
			deploymentLocation: "local",
			targetUrl: null,
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
	assert.equal(
		config.cdpContainerEndpoint,
		process.platform === "darwin"
			? `http://127.0.0.1:${config.cdpPort}`
			: `http://host.docker.internal:${config.cdpPort}`,
	)
	assert.equal(config.startUrl, "https://example.com")
})

test("managed-local runtime config honors explicit target url as start url", async () => {
	const config = await createBrowserLaneRuntimeConfig(
		{
			id: "managed-target",
			label: "Managed Target",
			surfaceKind: "selkies-stream",
			runtimeOwnership: "managed-local",
			deploymentLocation: "local",
			targetUrl: "https://example.com/start-here",
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

	assert.equal(config.startUrl, "https://example.com/start-here")
})

test("chrome cli keeps CDP flags and target url", () => {
	const cli = chromeCliForConfig({
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
		cdpContainerEndpoint:
			process.platform === "darwin"
				? "http://127.0.0.1:9229"
				: "http://host.docker.internal:9229",
		auth: { user: "abc", password: "abc" },
		startUrl: "https://example.com",
	})
	assert.match(cli, /--remote-debugging-port=9222/)
	assert.match(cli, /--remote-allow-origins=\*/)
	assert.match(cli, /--app=https:\/\/example\.com/)
})


test("renders persistent profile volume in compose", () => {

	const compose = renderBrowserLaneCompose(
		{
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
			cdpContainerEndpoint:
				process.platform === "darwin"
					? "http://127.0.0.1:9229"
					: "http://host.docker.internal:9229",
			auth: { user: "abc", password: "abc" },
			startUrl: "https://example.com",
		},
		"/tmp/browser-runtime-default/elf-cdp-supervisor.sh",
	)
	assert.match(compose, /\/tmp\/browser-profile-default:\/config/)
	assert.match(compose, /"3901:3000"/)
	assert.match(compose, /"9229:9223"/)
	assert.match(compose, /\/custom-cont-init\.d\/elf-cdp-supervisor\.sh/)
	assert.match(compose, /\/tmp\/browser-runtime-default:\/custom-cont-init\.d/)
	assert.match(compose, /NO_DECOR=1/)
	assert.match(compose, /START_URL=https:\/\/example\.com/)
	assert.doesNotMatch(compose, /SELKIES_MANUAL_WIDTH/)
	assert.doesNotMatch(compose, /SELKIES_MANUAL_HEIGHT/)
	assert.doesNotMatch(compose, /--window-size/)
})
