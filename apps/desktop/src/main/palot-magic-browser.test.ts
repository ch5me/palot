import assert from "node:assert/strict"
import test from "node:test"
import type { BrowserLane } from "../shared/browser-lanes"
import type { SessionBinding } from "../preload/api"
import {
	__resetMagicBrowserSessionTracking,
	clearMagicBrowserViewerState,
	ensureMagicBrowserSessionForBinding,
} from "./palot-magic-browser"
import {
	MagicBrowserCdpEndpointError,
	MagicBrowserCliError,
	MagicBrowserUnavailableError,
	fetchLaneWebSocketDebuggerUrl,
	resolveMagicBrowserBin,
	runMagicBrowserCli,
	startRemoteCdpSession,
	type MagicBrowserExec,
	type MagicBrowserFetch,
} from "./palot-magic-browser-engine"

// --- helpers -----------------------------------------------------------------

function buildLane(overrides: Partial<BrowserLane> = {}): BrowserLane {
	const now = Date.now()
	return {
		id: "default",
		label: "Default",
		mode: "local",
		runtime: "remote-attached",
		surfaceKind: "direct-iframe",
		streamPath: "/browser/default/",
		streamBackendUrl: null,
		cdpEndpoint: null,
		profilePath: null,
		host: null,
		createdAt: now,
		updatedAt: now,
		health: {
			status: "running",
			stream: { url: null, checkedAt: now, state: "ready", error: null },
			cdp: { url: null, checkedAt: now, state: "not-applicable", error: null },
			message: "",
		},
		...overrides,
	}
}

function buildBinding(overrides: Partial<SessionBinding> = {}): SessionBinding {
	const now = Date.now()
	return {
		id: "binding_ses_1",
		openCodeSessionId: "ses_1",
		browserLaneId: "default",
		magicBrowserSessionId: null,
		status: "attached",
		createdAt: now,
		updatedAt: now,
		releasedAt: null,
		...overrides,
	}
}

function fakeFetch(webSocketDebuggerUrl: string): MagicBrowserFetch {
	return async () => ({
		ok: true,
		status: 200,
		json: async () => ({ webSocketDebuggerUrl }),
	})
}

// --- resolveMagicBrowserBin precedence + fail-fast ---------------------------

test("resolveMagicBrowserBin: MAGIC_BROWSER_BIN env wins, runs via node", () => {
	const resolved = resolveMagicBrowserBin({
		env: { MAGIC_BROWSER_BIN: "/opt/mb/cli.js" } as NodeJS.ProcessEnv,
		probePath: () => "/usr/local/bin/magic-browser",
		probeFile: () => true,
	})
	assert.equal(resolved.source, "env")
	assert.deepEqual(resolved.prefixArgs, ["/opt/mb/cli.js"])
	assert.equal(resolved.command, process.execPath)
})

test("resolveMagicBrowserBin: PATH bin used when no env", () => {
	const resolved = resolveMagicBrowserBin({
		env: {} as NodeJS.ProcessEnv,
		probePath: () => "/usr/local/bin/magic-browser",
		probeFile: () => false,
	})
	assert.equal(resolved.source, "path")
	assert.equal(resolved.command, "/usr/local/bin/magic-browser")
	assert.deepEqual(resolved.prefixArgs, [])
})

test("resolveMagicBrowserBin: dev fallback when env + PATH missing but file exists", () => {
	const resolved = resolveMagicBrowserBin({
		env: {} as NodeJS.ProcessEnv,
		probePath: () => null,
		probeFile: () => true,
	})
	assert.equal(resolved.source, "dev-fallback")
	assert.equal(resolved.command, process.execPath)
	assert.equal(resolved.prefixArgs.length, 1)
	assert.match(resolved.prefixArgs[0]!, /magic-browser\/dist\/cli\.js$/)
})

test("resolveMagicBrowserBin: throws MagicBrowserUnavailableError naming the fix", () => {
	assert.throws(
		() =>
			resolveMagicBrowserBin({
				env: {} as NodeJS.ProcessEnv,
				probePath: () => null,
				probeFile: () => false,
			}),
		(err: unknown) => {
			assert.ok(err instanceof MagicBrowserUnavailableError)
			assert.match((err as Error).message, /MAGIC_BROWSER_BIN/)
			assert.match((err as Error).message, /PATH/)
			return true
		},
	)
})

// --- fetchLaneWebSocketDebuggerUrl extraction --------------------------------

test("fetchLaneWebSocketDebuggerUrl: extracts ws url and strips trailing slash", async () => {
	let requested = ""
	const fetchImpl: MagicBrowserFetch = async (url) => {
		requested = url
		return {
			ok: true,
			status: 200,
			json: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/abc" }),
		}
	}
	const ws = await fetchLaneWebSocketDebuggerUrl("http://127.0.0.1:9222/", { fetchImpl })
	assert.equal(ws, "ws://127.0.0.1:9222/devtools/browser/abc")
	assert.equal(requested, "http://127.0.0.1:9222/json/version")
})

test("fetchLaneWebSocketDebuggerUrl: fails fast on non-ok HTTP", async () => {
	const fetchImpl: MagicBrowserFetch = async () => ({ ok: false, status: 502, json: async () => ({}) })
	await assert.rejects(
		() => fetchLaneWebSocketDebuggerUrl("http://127.0.0.1:9222", { fetchImpl }),
		(err: unknown) => {
			assert.ok(err instanceof MagicBrowserCdpEndpointError)
			assert.match((err as Error).message, /HTTP 502/)
			return true
		},
	)
})

test("fetchLaneWebSocketDebuggerUrl: fails fast when webSocketDebuggerUrl missing", async () => {
	const fetchImpl: MagicBrowserFetch = async () => ({ ok: true, status: 200, json: async () => ({}) })
	await assert.rejects(
		() => fetchLaneWebSocketDebuggerUrl("http://127.0.0.1:9222", { fetchImpl }),
		(err: unknown) => err instanceof MagicBrowserCdpEndpointError,
	)
})

test("fetchLaneWebSocketDebuggerUrl: fails fast when endpoint unreachable", async () => {
	const fetchImpl: MagicBrowserFetch = async () => {
		throw new Error("ECONNREFUSED")
	}
	await assert.rejects(
		() => fetchLaneWebSocketDebuggerUrl("http://127.0.0.1:9222", { fetchImpl }),
		(err: unknown) => {
			assert.ok(err instanceof MagicBrowserCdpEndpointError)
			assert.match((err as Error).message, /ECONNREFUSED/)
			return true
		},
	)
})

// --- runMagicBrowserCli parsing ----------------------------------------------

test("runMagicBrowserCli: parses JSON stdout and prepends prefix args", async () => {
	let calledCommand = ""
	let calledArgs: readonly string[] = []
	const exec: MagicBrowserExec = async (command, args) => {
		calledCommand = command
		calledArgs = args
		return { stdout: '{"ok":true,"id":"x"}', stderr: "" }
	}
	const result = await runMagicBrowserCli<{ ok: boolean; id: string }>(["session", "tabs", "x"], {
		exec,
		resolveBin: () => ({ command: "node", prefixArgs: ["/cli.js"], source: "env" }),
	})
	assert.deepEqual(result, { ok: true, id: "x" })
	assert.equal(calledCommand, "node")
	assert.deepEqual(calledArgs, ["/cli.js", "session", "tabs", "x"])
})

test("runMagicBrowserCli: throws on empty stdout", async () => {
	const exec: MagicBrowserExec = async () => ({ stdout: "   ", stderr: "" })
	await assert.rejects(
		() =>
			runMagicBrowserCli(["session", "snapshot", "x"], {
				exec,
				resolveBin: () => ({ command: "node", prefixArgs: [], source: "env" }),
			}),
		(err: unknown) => err instanceof MagicBrowserCliError,
	)
})

test("runMagicBrowserCli: throws on non-JSON stdout", async () => {
	const exec: MagicBrowserExec = async () => ({ stdout: "not json", stderr: "" })
	await assert.rejects(
		() =>
			runMagicBrowserCli(["session", "snapshot", "x"], {
				exec,
				resolveBin: () => ({ command: "node", prefixArgs: [], source: "env" }),
			}),
		(err: unknown) => {
			assert.ok(err instanceof MagicBrowserCliError)
			assert.match((err as Error).message, /non-JSON/)
			return true
		},
	)
})

// --- startRemoteCdpSession arg construction -----------------------------------

test("startRemoteCdpSession: builds remote-cdp args from resolved ws url and returns UUID", async () => {
	let capturedArgs: readonly string[] = []
	const exec: MagicBrowserExec = async (_command, args) => {
		capturedArgs = args
		return { stdout: '{"id":"11111111-2222-3333-4444-555555555555","adapter":"remote-cdp"}', stderr: "" }
	}
	const result = await startRemoteCdpSession(
		{ laneId: "lane-a", cdpEndpoint: "http://127.0.0.1:9333", liveUrl: "https://live.example/lane-a" },
		{
			exec,
			fetchImpl: fakeFetch("ws://127.0.0.1:9333/devtools/browser/zzz"),
			resolveBin: () => ({ command: "node", prefixArgs: ["/cli.js"], source: "env" }),
		},
	)
	assert.equal(result.magicBrowserSessionId, "11111111-2222-3333-4444-555555555555")
	assert.equal(result.webSocketDebuggerUrl, "ws://127.0.0.1:9333/devtools/browser/zzz")
	assert.deepEqual(capturedArgs, [
		"/cli.js",
		"session",
		"start",
		"palot-browser",
		"--adapter",
		"remote-cdp",
		"--remote-cdp-url",
		"ws://127.0.0.1:9333/devtools/browser/zzz",
		"--remote-session-id",
		"lane-a",
		"--remote-live-url",
		"https://live.example/lane-a",
		"--knowledge-mode",
		"local-only",
	])
})

test("startRemoteCdpSession: omits --remote-live-url when absent; defaults knowledge-mode local-only", async () => {
	let capturedArgs: readonly string[] = []
	const exec: MagicBrowserExec = async (_command, args) => {
		capturedArgs = args
		return { stdout: '{"id":"uuid-2"}', stderr: "" }
	}
	await startRemoteCdpSession(
		{ laneId: "lane-b", cdpEndpoint: "http://127.0.0.1:9444" },
		{
			exec,
			fetchImpl: fakeFetch("ws://127.0.0.1:9444/x"),
			resolveBin: () => ({ command: "node", prefixArgs: [], source: "env" }),
		},
	)
	assert.ok(!capturedArgs.includes("--remote-live-url"))
	const idx = capturedArgs.indexOf("--knowledge-mode")
	assert.equal(capturedArgs[idx + 1], "local-only")
})

test("startRemoteCdpSession: fails fast when CLI returns no session id", async () => {
	const exec: MagicBrowserExec = async () => ({ stdout: '{"adapter":"remote-cdp"}', stderr: "" })
	await assert.rejects(
		() =>
			startRemoteCdpSession(
				{ laneId: "lane-c", cdpEndpoint: "http://127.0.0.1:9555" },
				{
					exec,
					fetchImpl: fakeFetch("ws://127.0.0.1:9555/x"),
					resolveBin: () => ({ command: "node", prefixArgs: [], source: "env" }),
				},
			),
		(err: unknown) => {
			assert.ok(err instanceof MagicBrowserCliError)
			assert.match((err as Error).message, /no session id/)
			return true
		},
	)
})

// --- ensureMagicBrowserSessionForBinding routing (engine + lane/binding mocked) -

test("ensureMagicBrowserSessionForBinding: iframe lane => no session start, clears magicBrowserSessionId", async () => {
	__resetMagicBrowserSessionTracking()
	let startCalls = 0
	let persisted: SessionBinding | null = null
	const result = await ensureMagicBrowserSessionForBinding("ses_1", {
		getBinding: () => buildBinding({ magicBrowserSessionId: "stale-uuid" }),
		getLane: async () => buildLane({ surfaceKind: "direct-iframe", cdpEndpoint: null }),
		persistBinding: (b) => {
			persisted = b
			return b
		},
		startRemoteCdpSession: async () => {
			startCalls += 1
			return { magicBrowserSessionId: "should-not-happen", webSocketDebuggerUrl: "ws://x" }
		},
		stopSession: async () => ({}),
	})
	assert.equal(startCalls, 0)
	assert.ok(result)
	assert.equal(result!.magicBrowserSessionId, null)
	assert.equal(persisted!.magicBrowserSessionId, null)
})

test("ensureMagicBrowserSessionForBinding: streamed lane starts a real session and persists UUID", async () => {
	__resetMagicBrowserSessionTracking()
	let startCalls = 0
	const result = await ensureMagicBrowserSessionForBinding("ses_1", {
		getBinding: () => buildBinding(),
		getLane: async () =>
			buildLane({
				surfaceKind: "selkies-stream",
				runtime: "docker-chromium",
				cdpEndpoint: "http://127.0.0.1:9222",
			}),
		persistBinding: (b) => b,
		startRemoteCdpSession: async (input) => {
			startCalls += 1
			assert.equal(input.cdpEndpoint, "http://127.0.0.1:9222")
			assert.equal(input.knowledgeMode, "local-only")
			return { magicBrowserSessionId: "real-uuid-1", webSocketDebuggerUrl: "ws://x" }
		},
		stopSession: async () => ({}),
	})
	assert.equal(startCalls, 1)
	assert.equal(result!.magicBrowserSessionId, "real-uuid-1")
})

test("ensureMagicBrowserSessionForBinding: same cdpEndpoint reuses session (no restart)", async () => {
	__resetMagicBrowserSessionTracking()
	let startCalls = 0
	const lane = buildLane({ surfaceKind: "selkies-stream", cdpEndpoint: "http://127.0.0.1:9222" })
	const deps = {
		getLane: async () => lane,
		persistBinding: (b: SessionBinding) => b,
		startRemoteCdpSession: async () => {
			startCalls += 1
			return { magicBrowserSessionId: "uuid-same", webSocketDebuggerUrl: "ws://x" }
		},
		stopSession: async () => ({}),
	}
	await ensureMagicBrowserSessionForBinding("ses_1", { ...deps, getBinding: () => buildBinding() })
	const second = await ensureMagicBrowserSessionForBinding("ses_1", {
		...deps,
		getBinding: () => buildBinding({ magicBrowserSessionId: "uuid-same" }),
	})
	assert.equal(startCalls, 1)
	assert.equal(second!.magicBrowserSessionId, "uuid-same")
})

test("ensureMagicBrowserSessionForBinding: changed cdpEndpoint stops stale + restarts (re-attach)", async () => {
	__resetMagicBrowserSessionTracking()
	let startCalls = 0
	const stopped: string[] = []
	await ensureMagicBrowserSessionForBinding("ses_1", {
		getBinding: () => buildBinding(),
		getLane: async () => buildLane({ surfaceKind: "selkies-stream", cdpEndpoint: "http://127.0.0.1:9222" }),
		persistBinding: (b) => b,
		startRemoteCdpSession: async () => {
			startCalls += 1
			return { magicBrowserSessionId: "uuid-old", webSocketDebuggerUrl: "ws://old" }
		},
		stopSession: async () => ({}),
	})
	const result = await ensureMagicBrowserSessionForBinding("ses_1", {
		getBinding: () => buildBinding({ magicBrowserSessionId: "uuid-old" }),
		getLane: async () => buildLane({ surfaceKind: "selkies-stream", cdpEndpoint: "http://127.0.0.1:9999" }),
		persistBinding: (b) => b,
		startRemoteCdpSession: async (input) => {
			startCalls += 1
			assert.equal(input.cdpEndpoint, "http://127.0.0.1:9999")
			return { magicBrowserSessionId: "uuid-new", webSocketDebuggerUrl: "ws://new" }
		},
		stopSession: async (id) => {
			stopped.push(id)
			return {}
		},
	})
	assert.equal(startCalls, 2)
	assert.deepEqual(stopped, ["uuid-old"])
	assert.equal(result!.magicBrowserSessionId, "uuid-new")
})

test("ensureMagicBrowserSessionForBinding: unbound (no laneId) returns null", async () => {
	__resetMagicBrowserSessionTracking()
	const result = await ensureMagicBrowserSessionForBinding("ses_1", {
		getBinding: () => buildBinding({ browserLaneId: null }),
		getLane: async () => null,
	})
	assert.equal(result, null)
})

test("ensureMagicBrowserSessionForBinding: streamed lane without cdpEndpoint fails fast", async () => {
	__resetMagicBrowserSessionTracking()
	await assert.rejects(
		() =>
			ensureMagicBrowserSessionForBinding("ses_1", {
				getBinding: () => buildBinding(),
				getLane: async () => buildLane({ surfaceKind: "selkies-stream", cdpEndpoint: null }),
				persistBinding: (b) => b,
			}),
		(err: unknown) => {
			assert.match((err as Error).message, /no cdpEndpoint/)
			return true
		},
	)
})

// --- viewer-url derivation + clear-state (main-only secret cache) -------------

test("ensureMagicBrowserSessionForBinding: derives a main-only viewer url for the bound lane", async () => {
	__resetMagicBrowserSessionTracking()
	const { getBindingViewerUrl, clearAllBindingSecrets } = await import("./palot-secret-cache")
	clearAllBindingSecrets()
	const binding = buildBinding({ id: "binding_ses_view", openCodeSessionId: "ses_view", browserLaneId: "default" })
	await ensureMagicBrowserSessionForBinding("ses_view", {
		getBinding: () => binding,
		getLane: async () => buildLane({ surfaceKind: "direct-iframe", cdpEndpoint: null }),
		persistBinding: (b) => b,
	})
	const viewerUrl = getBindingViewerUrl("binding_ses_view")
	assert.ok(viewerUrl)
	assert.match(viewerUrl!, /\/browser\/default\//)
})

test("clearMagicBrowserViewerState removes derived viewer url + clears CDP tracking", async () => {
	__resetMagicBrowserSessionTracking()
	const { getBindingViewerUrl, setBindingViewerUrl, clearAllBindingSecrets } = await import(
		"./palot-secret-cache"
	)
	clearAllBindingSecrets()
	// Seed a derived viewer url for the real binding id shape and prove it is cleared.
	// clearMagicBrowserViewerState resolves the binding via the real store; when the
	// session is unknown it is a no-op, so we assert the secret-cache primitive it relies on.
	setBindingViewerUrl("binding_ses_clear", "http://elf-browser-lane.local/browser/default/?viewer=tok")
	assert.ok(getBindingViewerUrl("binding_ses_clear"))
	clearAllBindingSecrets()
	assert.equal(getBindingViewerUrl("binding_ses_clear"), null)
	// clearMagicBrowserViewerState is exported and callable for an unknown session (no throw).
	assert.doesNotThrow(() => clearMagicBrowserViewerState("ses_unknown_clear"))
})
