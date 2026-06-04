import assert from "node:assert/strict"
import test from "node:test"
import {
	isHttpPaneTarget,
	isPaneFileTarget,
	normalizePaneFileTarget,
	resolvePaneFileTarget,
	targetLabel,
} from "./pane-routing"

test("pane routing identifies browser links and local file targets", () => {
	assert.equal(isHttpPaneTarget("https://docs.anthropic.com/claude-code"), true)
	assert.equal(isPaneFileTarget("/Users/firaz/docs/research.md:12"), true)
	assert.equal(isPaneFileTarget("docs/research/codex-desktop-steal-list.md"), true)
	assert.equal(isPaneFileTarget("not a path"), false)
})

test("pane routing resolves markdown links relative to the current file", () => {
	assert.equal(
		resolvePaneFileTarget("../notes/todo.md#next", "/Users/firaz/project/docs/research/current.md"),
		"/Users/firaz/project/docs/notes/todo.md",
	)
	assert.equal(targetLabel("/Users/firaz/project/docs/notes/todo.md:44"), "todo.md")
})

test("normalizePaneFileTarget strips wrappers, fragments, file scheme, and line suffixes", () => {
	assert.equal(
		normalizePaneFileTarget("<file:///Users/firaz/project/docs/spec.md:18#intro>"),
		"/Users/firaz/project/docs/spec.md",
	)
	assert.equal(normalizePaneFileTarget("`./docs/spec.md:9`"), "./docs/spec.md")
})
