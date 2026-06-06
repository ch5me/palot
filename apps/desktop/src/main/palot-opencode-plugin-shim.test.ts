import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function writePluginFile(contents: string): string {
	const dir = mkdtempSync(path.join(tmpdir(), "palot-plugin-shim-"))
	const filePath = path.join(dir, "plugin.mjs")
	writeFileSync(filePath, contents, "utf-8")
	return filePath
}

test("loadPalotPluginModule accepts default export module shape", async () => {
	const filePath = writePluginFile(
		`export default { id: "palot-test", server: async () => ({ tool: {} }) }`,
	)
	try {
		const mod = await import("./palot-opencode-plugin-shim")
		const loaded = await mod.loadPalotPluginModule(filePath)
		assert.equal(loaded.id, "palot-test")
		assert.equal(typeof loaded.server, "function")
	} finally {
		rmSync(path.dirname(filePath), { recursive: true, force: true })
	}
})

test("loadPalotPluginModule rejects invalid module shape", async () => {
	const filePath = writePluginFile(`export default { nope: true }`)
	try {
		const mod = await import("./palot-opencode-plugin-shim")
		await assert.rejects(() => mod.loadPalotPluginModule(filePath), /Invalid Palot plugin module/)
	} finally {
		rmSync(path.dirname(filePath), { recursive: true, force: true })
	}
})
