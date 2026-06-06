import assert from "node:assert/strict"
import test from "node:test"

test("secret cache stores token only in memory", async () => {
	const mod = await import("./palot-secret-cache")
	mod.clearAllBindingSecrets()
	const saved = mod.setBindingSecret("binding_a", "viewer-token")
	assert.equal(saved.bindingId, "binding_a")
	assert.equal(mod.getBindingSecret("binding_a")?.viewerAuthToken, "viewer-token")
	assert.equal(mod.clearBindingSecret("binding_a"), true)
	assert.equal(mod.getBindingSecret("binding_a"), null)
})
