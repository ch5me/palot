import { promises as fs } from "node:fs"
import path from "node:path"
import { Hono } from "hono"

const app = new Hono()

const EDIT_TEXT_CAP = 8 * 1024 * 1024

function normalizePath(filePath: string): string {
	return path.resolve(filePath)
}

function getAllowedRoots(): string[] {
	const roots = process.env.ELF_ALLOWED_FILE_ROOTS?.split(path.delimiter)
		.map((root) => root.trim())
		.filter(Boolean)

	if (roots && roots.length > 0) {
		return roots.map(normalizePath)
	}

	return [normalizePath(process.cwd())]
}

function isWithinRoot(filePath: string, root: string): boolean {
	if (filePath === root) {
		return true
	}
	const relative = path.relative(root, filePath)
	return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function assertAllowedPath(filePath: string): string {
	const normalized = normalizePath(filePath)
	const allowedRoots = getAllowedRoots()
	if (allowedRoots.some((root) => isWithinRoot(normalized, root))) {
		return normalized
	}
	throw new Error(`Path is outside allowed roots: ${allowedRoots.join(", ")}`)
}

async function readUtf8TextFile(filePath: string): Promise<string> {
	const file = Bun.file(filePath)
	const size = file.size
	if (size > EDIT_TEXT_CAP) {
		throw new Error(`file too large to edit (${Math.floor(size / (1024 * 1024))} MB > 8 MB)`)
	}
	return file.text()
}

async function writeUtf8TextFile(filePath: string, content: string): Promise<void> {
	const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.elf-tmp`)
	await Bun.write(tempPath, content)
	await fs.rename(tempPath, filePath)
}

const routes = app
	.get("/text", async (c) => {
		try {
			const requestedPath = c.req.query("path")
			if (!requestedPath) {
				return c.json({ error: "path query parameter is required" }, 400)
			}
			const filePath = assertAllowedPath(requestedPath)
			const content = await readUtf8TextFile(filePath)
			return c.text(content, 200)
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to read text file"
			const status = message.startsWith("Path is outside allowed roots") ? 403 : 400
			return c.json({ error: message }, status)
		}
	})
	.put("/text", async (c) => {
		try {
			const body = await c.req.json()
			if (
				typeof body !== "object" ||
				body === null ||
				typeof body.path !== "string" ||
				body.path.length === 0 ||
				typeof body.content !== "string"
			) {
				return c.json({ error: "path and content are required" }, 400)
			}
			const filePath = assertAllowedPath(body.path)
			await writeUtf8TextFile(filePath, body.content)
			return c.json({ ok: true }, 200)
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to write text file"
			const status = message.startsWith("Path is outside allowed roots") ? 403 : 400
			return c.json({ error: message }, status)
		}
	})

export default routes
