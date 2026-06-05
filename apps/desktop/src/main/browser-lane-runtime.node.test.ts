import assert from "node:assert/strict"
import test from "node:test"
import { renderBrowserLaneCompose } from "./browser-lane-runtime"

test("browser lane compose keeps persistent profile volume and split ports", () => {
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
	assert.doesNotMatch(compose, /--window-size/)
})
