import assert from "node:assert/strict"
import test from "node:test"

function buildHealthcheckShape(input: {
	streamBackendUrl: string
	hostPublishedCdpEndpoint: string
	relayCdpEndpoint: string
	internalCdpEndpoint: string
	stream: { ok: boolean; status: number; error?: string }
	hostPublishedCdp: { ok: boolean; status: number }
	verboseInternal?: {
		ok: boolean
		status: number
		stdout?: string
		error?: string
	}
}) {
	const details: Record<string, unknown> = {
		action: "healthcheck",
		mode: "local",
		laneId: "default",
		streamBackendUrl: input.streamBackendUrl,
		streamPath: "/browser/default/",
		hostPublishedCdpEndpoint: input.hostPublishedCdpEndpoint,
		hostPublishedCdp: input.hostPublishedCdp,
		relayCdp: {
			url: input.relayCdpEndpoint,
			ok:
				input.relayCdpEndpoint === input.hostPublishedCdpEndpoint
					? input.hostPublishedCdp.ok
					: null,
			status:
				input.relayCdpEndpoint === input.hostPublishedCdpEndpoint
					? input.hostPublishedCdp.status
					: null,
			note:
				input.relayCdpEndpoint === input.hostPublishedCdpEndpoint
					? "Host-published port terminates at the relay listener"
					: "Relay endpoint is container-only from this host context",
		},
		internalCdp: {
			url: input.internalCdpEndpoint,
			note: "Chromium binds this loopback endpoint inside the container namespace only; verify with docker exec or cdp-smoke.",
		},
		stream: input.stream,
	}
	if (input.verboseInternal) {
		details.internalCdp = {
			url: input.internalCdpEndpoint,
			...input.verboseInternal,
			note: "Verified via docker exec inside the managed container namespace.",
		}
	}
	return details
}

test("healthcheck local shape reports host relay semantics by default", () => {
	const output = buildHealthcheckShape({
		streamBackendUrl: "http://127.0.0.1:3000",
		hostPublishedCdpEndpoint: "http://127.0.0.1:57589",
		relayCdpEndpoint: "http://127.0.0.1:57589",
		internalCdpEndpoint: "http://127.0.0.1:9222",
		stream: { ok: false, status: 0, error: "stream offline" },
		hostPublishedCdp: { ok: true, status: 200 },
	})

	assert.equal(output.hostPublishedCdpEndpoint, "http://127.0.0.1:57589")
	assert.deepEqual(output.hostPublishedCdp, { ok: true, status: 200 })
	assert.deepEqual(output.relayCdp, {
		url: "http://127.0.0.1:57589",
		ok: true,
		status: 200,
		note: "Host-published port terminates at the relay listener",
	})
	assert.deepEqual(output.internalCdp, {
		url: "http://127.0.0.1:9222",
		note: "Chromium binds this loopback endpoint inside the container namespace only; verify with docker exec or cdp-smoke.",
	})
})

test("healthcheck verbose shape promotes internal docker-exec proof", () => {
	const output = buildHealthcheckShape({
		streamBackendUrl: "http://127.0.0.1:3000",
		hostPublishedCdpEndpoint: "http://127.0.0.1:57589",
		relayCdpEndpoint: "http://127.0.0.1:57589",
		internalCdpEndpoint: "http://127.0.0.1:9222",
		stream: { ok: false, status: 0, error: "stream offline" },
		hostPublishedCdp: { ok: true, status: 200 },
		verboseInternal: { ok: true, status: 200, stdout: '{"Browser":"Chrome/148"}' },
	})

	assert.deepEqual(output.internalCdp, {
		url: "http://127.0.0.1:9222",
		ok: true,
		status: 200,
		stdout: '{"Browser":"Chrome/148"}',
		note: "Verified via docker exec inside the managed container namespace.",
	})
})
