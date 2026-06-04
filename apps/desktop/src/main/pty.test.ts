import assert from "node:assert/strict"
import test from "node:test"
import type { IPty } from "node-pty"
import { createPtyController } from "./pty"

function createFakePty(): IPty {
	let onDataHandler: ((data: string) => void) | null = null
	let onExitHandler: ((event: { exitCode: number; signal?: number }) => void) | null = null
	let currentCols = 80
	let currentRows = 24

	return {
		pid: 1234,
		process: "/bin/sh",
		get cols() {
			return currentCols
		},
		get rows() {
			return currentRows
		},
		handleFlowControl: false,
		write(data: string) {
			if (data.includes("hi-from-pty")) {
				onDataHandler?.("hi-from-pty\r\n")
			}
		},
		resize(cols: number, rows: number) {
			currentCols = cols
			currentRows = rows
		},
		clear() {},
		kill() {
			onExitHandler?.({ exitCode: 0, signal: 15 })
		},
		onData(callback: (data: string) => void) {
			onDataHandler = callback
			return {
				dispose() {
					onDataHandler = null
				},
			}
		},
		onExit(callback: (event: { exitCode: number; signal?: number }) => void) {
			onExitHandler = callback
			return {
				dispose() {
					onExitHandler = null
				},
			}
		},
		pause() {},
		resume() {},
	}
}

test("PTY controller spawns a shell, streams output, resizes, and kills", async () => {
	let output = ""
	let exitEvent: { id: number; exitCode: number; signal?: number } | null = null
	const controller = createPtyController({
		spawnPty: () => createFakePty(),
		onData: (event) => {
			output += event.data
		},
		onExit: (event) => {
			exitEvent = event
		},
	})

	const id = controller.spawnShell({ cols: 80, rows: 24, cwd: process.cwd() })
	controller.write(id, "printf 'hi-from-pty\\n'\n")
	assert.match(output, /hi-from-pty/)
	controller.resize(id, 100, 30)
	controller.kill(id)

	if (exitEvent === null) {
		throw new Error("missing exit event")
	}
	const finalExitEvent: { id: number; exitCode: number; signal?: number } = exitEvent
	assert.equal(finalExitEvent.id, id)
	assert.throws(() => controller.kill(999999), /pty session 999999 not found/)
})
