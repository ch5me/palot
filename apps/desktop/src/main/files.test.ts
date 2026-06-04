import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import simpleGit from "simple-git"
import {
	deletePath,
	detectProject,
	getGitStatus,
	listDirectory,
	readDirectoryTree,
	readTextFile,
	saveImageTemp,
	writeTextFile,
} from "./files"

function makeTempDir(name: string): string {
	const directory = path.join(tmpdir(), `elf-files-${name}-${Date.now()}`)
	mkdirSync(directory, { recursive: true })
	return directory
}

test("files seam handles tree/git/read-write/delete and ENOENT", { timeout: 15000 }, async () => {
	const directory = makeTempDir("workspace")
	const nestedDir = path.join(directory, ".claude")
	const filePath = path.join(directory, "notes.md")
	const hiddenPath = path.join(nestedDir, "config.md")
	try {
		mkdirSync(nestedDir, { recursive: true })
		writeFileSync(filePath, "hello world", "utf-8")
		writeFileSync(hiddenPath, "secret", "utf-8")

		const list = listDirectory(directory)
		assert.deepEqual(list.map((entry) => entry.name), ["notes.md"])

		const tree = readDirectoryTree(directory)
		assert.ok(tree.some((entry) => entry.name === ".claude"))

		writeTextFile(filePath, "updated text")
		assert.equal(readTextFile(filePath), "updated text")

		const git = simpleGit({ baseDir: directory, trimmed: true })
		await git.init()
		await git.addConfig("user.name", "Elf Test")
		await git.addConfig("user.email", "elf@example.com")
		await git.add("notes.md")
		await git.commit("init")
		writeTextFile(filePath, "changed again")

		const status = await getGitStatus(directory)
		assert.ok(status.root?.endsWith(path.basename(directory)))
		assert.ok(
			status.entries.some(
				(entry) => path.basename(entry.path) === "notes.md" && entry.status === "M",
			),
		)

		const project = detectProject(filePath)
		assert.equal(project.kind, "unknown")

		const packageJson = path.join(directory, "package.json")
		writeFileSync(packageJson, JSON.stringify({ scripts: { dev: "vite", test: "bun test" } }), "utf-8")
		const nodeProject = detectProject(filePath)
		assert.equal(nodeProject.kind, "node")
		assert.ok(nodeProject.commands.some((command) => command.cmd.includes("dev")))

		const imagePath = saveImageTemp(Buffer.from("abc").toString("base64"), "png")
		assert.equal(path.extname(imagePath), ".png")

		deletePath(filePath)
		assert.throws(() => readTextFile(filePath), /ENOENT/)
		deletePath(filePath)
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
})
