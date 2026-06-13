#!/usr/bin/env node
import { spawn } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const DEFAULT_BASE_URL = "http://storybook.elf.localhost"
const DEFAULT_OUT = ".sisyphus/evidence/storybook-coverage/render-proof"
const VIEWPORTS = [
	{ name: "desktop", width: 1440, height: 900, mobile: false },
	{ name: "mobile", width: 390, height: 844, mobile: true },
]

function parseArgs(argv) {
	const options = {
		baseUrl: DEFAULT_BASE_URL,
		chromePath: DEFAULT_CHROME,
		outDir: DEFAULT_OUT,
		port: 9227,
		storyIds: [],
	}

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index]
		if (arg === "--base-url") {
			options.baseUrl = argv.at(index + 1) ?? options.baseUrl
			index += 1
			continue
		}
		if (arg === "--chrome") {
			options.chromePath = argv.at(index + 1) ?? options.chromePath
			index += 1
			continue
		}
		if (arg === "--out") {
			options.outDir = argv.at(index + 1) ?? options.outDir
			index += 1
			continue
		}
		if (arg === "--port") {
			options.port = Number(argv.at(index + 1) ?? options.port)
			index += 1
			continue
		}
		options.storyIds.push(arg)
	}

	return options
}

function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForChrome(port) {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		try {
			const response = await fetch(`http://127.0.0.1:${port}/json/version`)
			if (response.ok) return
		} catch {
			// Keep polling until Chrome opens its CDP port.
		}
		await wait(250)
	}
	throw new Error("Chrome CDP did not start")
}

let socketId = 0

async function openPage(port, url) {
	const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
		method: "PUT",
	})
	if (!response.ok) throw new Error(`new page failed ${response.status}`)

	const target = await response.json()
	const socket = new WebSocket(target.webSocketDebuggerUrl)

	await new Promise((resolve, reject) => {
		socket.addEventListener("open", resolve, { once: true })
		socket.addEventListener("error", reject, { once: true })
	})

	const pending = new Map()
	const consoleMessages = []

	socket.addEventListener("message", (event) => {
		const message = JSON.parse(event.data)
		if (message.id && pending.has(message.id)) {
			const handlers = pending.get(message.id)
			pending.delete(message.id)
			if (message.error) handlers.reject(new Error(message.error.message))
			else handlers.resolve(message.result)
			return
		}

		if (message.method === "Runtime.consoleAPICalled") {
			consoleMessages.push({
				type: message.params.type,
				text: message.params.args.map((arg) => arg.value || arg.description || "").join(" "),
			})
		}

		if (message.method === "Log.entryAdded") {
			consoleMessages.push({
				type: message.params.entry.level,
				text: message.params.entry.text,
				url: message.params.entry.url || "",
			})
		}
	})

	function send(method, params = {}) {
		const id = ++socketId
		socket.send(JSON.stringify({ id, method, params }))
		return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
	}

	return { socket, send, consoleMessages, targetId: target.id }
}

async function verifyStory({ baseUrl, outDir, port, storyId, viewport }) {
	const url = `${baseUrl}/iframe.html?id=${storyId}&viewMode=story`
	const page = await openPage(port, url)

	try {
		await page.send("Runtime.enable")
		await page.send("Log.enable")
		await page.send("Page.enable")
		await page.send("Emulation.setDeviceMetricsOverride", {
			width: viewport.width,
			height: viewport.height,
			deviceScaleFactor: 1,
			mobile: viewport.mobile,
		})
		await page.send("Page.navigate", { url })

		let rendered
		for (let attempt = 0; attempt < 80; attempt += 1) {
			const result = await page.send("Runtime.evaluate", {
				expression: `(() => {
					const root = document.querySelector("#storybook-root") || document.body;
					const rect = root.getBoundingClientRect();
					const visibleError = [...document.querySelectorAll(".sb-errordisplay, #error-message")].find((el) => {
						const style = getComputedStyle(el);
						const box = el.getBoundingClientRect();
						return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
					});
					return {
						ready: document.readyState,
						width: rect.width,
						height: rect.height,
						childCount: root.querySelectorAll("*").length,
						textLength: (root.innerText || "").trim().length,
						errorText: visibleError?.textContent || "",
					};
				})()`,
				returnByValue: true,
			})

			rendered = result.result.value
			if (
				rendered.ready === "complete" &&
				rendered.width > 0 &&
				rendered.height > 0 &&
				rendered.childCount > 0 &&
				!rendered.errorText
			) {
				break
			}

			await wait(250)
			if (attempt === 79) {
				throw new Error(`${storyId} ${viewport.name} did not render: ${JSON.stringify(rendered)}`)
			}
		}

		const errors = page.consoleMessages.filter(
			(message) =>
				["error", "warning"].includes(message.type) &&
				!/favicon|Download the React DevTools/i.test(message.text) &&
				!/favicon/i.test(message.url || ""),
		)
		if (errors.some((message) => message.type === "error")) {
			throw new Error(`${storyId} ${viewport.name} console error: ${JSON.stringify(errors)}`)
		}

		const screenshot = await page.send("Page.captureScreenshot", {
			format: "png",
			captureBeyondViewport: false,
		})
		const buffer = Buffer.from(screenshot.data, "base64")
		if (buffer.length < 1000) throw new Error(`${storyId} ${viewport.name} screenshot too small`)

		const screenshotFile = path.join(outDir, `${storyId}-${viewport.name}.png`)
		await writeFile(screenshotFile, buffer)

		return {
			storyId,
			viewport: viewport.name,
			width: Math.round(rendered.width),
			height: Math.round(rendered.height),
			childCount: rendered.childCount,
			textLength: rendered.textLength,
			screenshot: screenshotFile,
			warnings: errors.length,
		}
	} finally {
		page.socket.close()
		await fetch(`http://127.0.0.1:${port}/json/close/${page.targetId}`).catch(() => {})
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2))
	if (options.storyIds.length === 0) {
		throw new Error("Usage: node scripts/storybook/render-proof.mjs --out <dir> <story-id> [...]")
	}

	const outDir = path.resolve(options.outDir)
	const userDataDir = path.join(tmpdir(), `palot-storybook-chrome-${Date.now()}`)
	await mkdir(outDir, { recursive: true })

	const chrome = spawn(options.chromePath, [
		"--headless=new",
		`--remote-debugging-port=${options.port}`,
		`--user-data-dir=${userDataDir}`,
		"--no-first-run",
		"--disable-gpu",
		"about:blank",
	], {
		stdio: ["ignore", "ignore", "ignore"],
	})

	try {
		await waitForChrome(options.port)
		const results = []
		for (const storyId of options.storyIds) {
			for (const viewport of VIEWPORTS) {
				results.push(await verifyStory({ ...options, outDir, storyId, viewport }))
			}
		}

		await writeFile(
			path.join(outDir, "render-proof.json"),
			JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
		)

		console.log(
			JSON.stringify(
				{
					ok: true,
					count: results.length,
					proofDir: outDir,
					results: results.map(
						(result) =>
							`${result.storyId}:${result.viewport}:${result.width}x${result.height}:nodes${result.childCount}`,
					),
				},
				null,
				2,
			),
		)
	} finally {
		chrome.kill("SIGTERM")
		await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
	}
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
