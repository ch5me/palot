import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import path from "node:path"
import { execFile } from "node:child_process"
import simpleGit from "simple-git"

export interface FileSystemEntry {
	name: string
	path: string
	type: "file" | "directory"
	mtime: number
}

export type GitCode = "M" | "A" | "D" | "R" | "U"

export interface GitEntry {
	path: string
	status: GitCode
}

export interface GitStatusResult {
	root: string | null
	entries: GitEntry[]
}

export interface RepoPulse {
	root: string
	name: string
	branch: string
	dirty: number
	ahead: number
	behind: number
}

export interface RunCommand {
	label: string
	cmd: string
}

export interface ProjectRun {
	kind: string
	root: string | null
	commands: RunCommand[]
}

export interface ProjectInfo {
	name: string
	root: string
	kind: string
	commands: RunCommand[]
	mtime: number
}

export type FilePreviewKind = "text" | "image" | "pdf" | "office" | "binary"

export interface FilePreview {
	kind: FilePreviewKind
	text: string | null
	size: number
	name: string
	truncated: boolean
}

export interface OfficeConversionResult {
	pdfPath: string
	cacheHit: boolean
}

const EDIT_TEXT_CAP = 8 * 1024 * 1024
const PREVIEW_TEXT_CAP = 256 * 1024
const PROJECT_SCAN_DEPTH = 4
const PROJECT_SCAN_CAP = 200

function resolveDirectory(directory?: string): string {
	return directory?.trim() ? directory : homedir()
}

function safeStatMtime(filePath: string): number {
	try {
		return statSync(filePath).mtimeMs / 1000
	} catch {
		return 0
	}
}

function createEntry(name: string, filePath: string, isDirectory: boolean): FileSystemEntry {
	return {
		name,
		path: filePath,
		type: isDirectory ? "directory" : "file",
		mtime: safeStatMtime(filePath),
	}
}

function sortEntries(entries: FileSystemEntry[]): FileSystemEntry[] {
	return entries.sort((a, b) => {
		if (a.type !== b.type) {
			return a.type === "directory" ? -1 : 1
		}
		return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
	})
}

function readDirectoryInternal(directory: string, includeDotfiles: boolean): FileSystemEntry[] {
	const entries = readdirSync(resolveDirectory(directory), { withFileTypes: true })
	const mapped = entries
		.filter((entry) => {
			if (includeDotfiles) {
				return entry.name !== ".git" && entry.name !== ".DS_Store"
			}
			return !entry.name.startsWith(".")
		})
		.map((entry) => {
			const filePath = path.join(resolveDirectory(directory), entry.name)
			return createEntry(entry.name, filePath, entry.isDirectory())
		})
	return sortEntries(mapped)
}

export function listDirectory(directory?: string): FileSystemEntry[] {
	return readDirectoryInternal(resolveDirectory(directory), false)
}

export function readDirectoryTree(directory?: string): FileSystemEntry[] {
	return readDirectoryInternal(resolveDirectory(directory), true)
}

function simplifyStatus(index: string, workingTree: string): GitCode {
	const pair = `${index}${workingTree}`
	if (pair === "??") {
		return "U"
	}
	if (pair.includes("D")) {
		return "D"
	}
	if (pair.includes("A")) {
		return "A"
	}
	if (pair.includes("R")) {
		return "R"
	}
	return "M"
}

export async function getGitStatus(directory: string): Promise<GitStatusResult> {
	const git = simpleGit({ baseDir: directory, trimmed: true })
	try {
		const root = (await git.revparse(["--show-toplevel"]))?.trim() || null
		if (!root) {
			return { root: null, entries: [] }
		}
		const status = await git.status()
		const entries: GitEntry[] = status.files.map((file) => ({
			path: path.join(root, file.path),
			status: simplifyStatus(file.index, file.working_dir),
		}))
		return { root, entries }
	} catch {
		return { root: null, entries: [] }
	}
}

export async function getGitPulse(paths: string[]): Promise<RepoPulse[]> {
	const results: RepoPulse[] = []
	for (const root of paths) {
		const name = path.basename(root) || root
		const git = simpleGit({ baseDir: root, trimmed: true })
		try {
			const branch = (await git.revparse(["--abbrev-ref", "HEAD"]))?.trim() || ""
			const status = await git.status()
			let ahead = 0
			let behind = 0
			try {
				const raw = await git.raw(["rev-list", "--count", "--left-right", "@{upstream}...HEAD"])
				const [behindRaw, aheadRaw] = raw.trim().split(/\s+/)
				behind = Number.parseInt(behindRaw ?? "0", 10) || 0
				ahead = Number.parseInt(aheadRaw ?? "0", 10) || 0
			} catch {
				// no upstream
			}
			results.push({
				root,
				name,
				branch,
				dirty: status.files.length,
				ahead,
				behind,
			})
		} catch {
			results.push({ root, name, branch: "", dirty: 0, ahead: 0, behind: 0 })
		}
	}
	return results
}

function nodeScripts(directory: string): RunCommand[] {
	const packageJson = path.join(directory, "package.json")
	if (!existsSync(packageJson)) {
		return [{ label: "npm start", cmd: "npm start" }]
	}
	const text = readFileSync(packageJson, "utf-8")
	const parsed = JSON.parse(text) as { scripts?: Record<string, string> }
	const scriptNames = Object.keys(parsed.scripts ?? {})
	const priority = ["dev", "start", "serve", "build", "test"]
	scriptNames.sort((a, b) => {
		const aIndex = priority.indexOf(a)
		const bIndex = priority.indexOf(b)
		return (aIndex === -1 ? priority.length : aIndex) - (bIndex === -1 ? priority.length : bIndex)
	})
	const packageManager = existsSync(path.join(directory, "pnpm-lock.yaml"))
		? "pnpm"
		: existsSync(path.join(directory, "yarn.lock"))
			? "yarn"
			: existsSync(path.join(directory, "bun.lockb")) || existsSync(path.join(directory, "bun.lock"))
				? "bun"
				: "npm"
	return scriptNames.length > 0
		? scriptNames.map((name) => ({
				label: packageManager === "npm" ? `npm run ${name}` : `${packageManager} ${name}`,
				cmd: packageManager === "npm" ? `npm run ${name}` : `${packageManager} ${name}`,
			}))
		: [{ label: `${packageManager} start`, cmd: `${packageManager} start` }]
}

function detectProjectAt(directory: string): ProjectRun | null {
	const has = (name: string) => existsSync(path.join(directory, name))
	if (has("pubspec.yaml")) {
		return {
			kind: "flutter",
			root: directory,
			commands: [
				{ label: "flutter run", cmd: "flutter run" },
				{ label: "flutter run --release", cmd: "flutter run --release" },
				{ label: "flutter test", cmd: "flutter test" },
			],
		}
	}
	if (has("package.json")) {
		return { kind: "node", root: directory, commands: nodeScripts(directory) }
	}
	if (has("Cargo.toml")) {
		return {
			kind: "rust",
			root: directory,
			commands: [
				{ label: "cargo run", cmd: "cargo run" },
				{ label: "cargo test", cmd: "cargo test" },
			],
		}
	}
	if (has("go.mod")) {
		return {
			kind: "go",
			root: directory,
			commands: [
				{ label: "go run .", cmd: "go run ." },
				{ label: "go test ./...", cmd: "go test ./..." },
			],
		}
	}
	if (has("pyproject.toml") || has("requirements.txt") || has("manage.py")) {
		const cmd = has("manage.py") ? "python manage.py runserver" : "python main.py"
		return { kind: "python", root: directory, commands: [{ label: cmd, cmd }] }
	}
	if (has("Makefile")) {
		return { kind: "make", root: directory, commands: [{ label: "make", cmd: "make" }] }
	}
	return null
}

export function detectProject(filePath: string): ProjectRun {
	let current = filePath
	try {
		if (statSync(filePath).isFile()) {
			current = path.dirname(filePath)
		}
	} catch {
		current = path.dirname(filePath)
	}
	for (let i = 0; i < 12; i += 1) {
		const project = detectProjectAt(current)
		if (project) {
			return project
		}
		const parent = path.dirname(current)
		if (parent === current) {
			break
		}
		current = parent
	}
	return { kind: "unknown", root: null, commands: [] }
}

const PRUNED_DIRS = new Set([
	"node_modules",
	".git",
	"build",
	"target",
	"dist",
	".next",
	"Pods",
	".dart_tool",
	"vendor",
	".venv",
	"venv",
	"__pycache__",
	".turbo",
	".cache",
])

export function listProjects(rootDirectory = path.join(homedir(), "Repo")): ProjectInfo[] {
	const results: ProjectInfo[] = []
	const stack: Array<{ directory: string; depth: number }> = [{ directory: rootDirectory, depth: 0 }]
	while (stack.length > 0 && results.length < PROJECT_SCAN_CAP) {
		const current = stack.pop()
		if (!current) {
			break
		}
		const project = detectProjectAt(current.directory)
		if (project?.root) {
			results.push({
				name: path.basename(project.root) || project.root,
				root: project.root,
				kind: project.kind,
				commands: project.commands,
				mtime: Math.floor(safeStatMtime(project.root)),
			})
			continue
		}
		if (current.depth >= PROJECT_SCAN_DEPTH) {
			continue
		}
		let entries
		try {
			entries = readdirSync(current.directory, { withFileTypes: true })
		} catch {
			continue
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) {
				continue
			}
			const entryName = String(entry.name)
			if (entryName.startsWith(".") || PRUNED_DIRS.has(entryName)) {
				continue
			}
			stack.push({ directory: path.join(current.directory, entryName), depth: current.depth + 1 })
		}
	}
	return results.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}

export function getHomeDirectory(): string {
	return homedir()
}

export function readTextFile(filePath: string): string {
	const stat = statSync(filePath)
	if (stat.size > EDIT_TEXT_CAP) {
		throw new Error(`file too large to edit (${Math.floor(stat.size / (1024 * 1024))} MB > 8 MB)`)
	}
	const buffer = readFileSync(filePath)
	try {
		return buffer.toString("utf-8")
	} catch {
		throw new Error("not a UTF-8 text file")
	}
}

export function writeTextFile(filePath: string, content: string): void {
	const directory = path.dirname(filePath)
	const fileName = path.basename(filePath)
	const tempPath = path.join(directory, `.${fileName}.elf-tmp`)
	writeFileSync(tempPath, content, "utf-8")
	renameSync(tempPath, filePath)
}

export function deletePath(filePath: string): void {
	if (!existsSync(filePath)) {
		return
	}
	if (statSync(filePath).isDirectory()) {
		throw new Error("refusing to delete a directory")
	}
	rmSync(filePath)
}

function isOfficeExtension(extension: string): boolean {
	return new Set([
		"doc",
		"docx",
		"docm",
		"dot",
		"dotx",
		"rtf",
		"odt",
		"ott",
		"fodt",
		"xls",
		"xlsx",
		"xlsm",
		"xlsb",
		"ods",
		"ots",
		"fods",
		"ppt",
		"pptx",
		"pptm",
		"pps",
		"ppsx",
		"odp",
		"otp",
		"fodp",
	]).has(extension)
}

export function readFilePreview(filePath: string): FilePreview {
	const stat = statSync(filePath)
	if (!stat.isFile()) {
		throw new Error("not a file")
	}
	const extension = path.extname(filePath).slice(1).toLowerCase()
	const name = path.basename(filePath)
	if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(extension)) {
		return { kind: "image", text: null, size: stat.size, name, truncated: false }
	}
	if (extension === "pdf") {
		return { kind: "pdf", text: null, size: stat.size, name, truncated: false }
	}
	if (isOfficeExtension(extension)) {
		return { kind: "office", text: null, size: stat.size, name, truncated: false }
	}
	const buffer = readFileSync(filePath)
	const truncated = buffer.byteLength > PREVIEW_TEXT_CAP
	const previewBytes = truncated ? buffer.subarray(0, PREVIEW_TEXT_CAP) : buffer
	const text = previewBytes.toString("utf-8")
	const hasNullBytes = previewBytes.includes(0)
	if (hasNullBytes) {
		return { kind: "binary", text: null, size: stat.size, name, truncated: false }
	}
	return { kind: "text", text, size: stat.size, name, truncated }
}

function decodeBase64(data: string): Buffer {
	return Buffer.from(data.replace(/\s+/g, ""), "base64")
}

function fileHash(buffer: Buffer): string {
	return buffer.subarray(0, 4096).reduce((sum, byte) => (sum * 33 + byte) >>> 0, buffer.length).toString(16)
}

export function saveImageTemp(data: string, extension: string): string {
	const bytes = decodeBase64(data)
	if (bytes.byteLength === 0) {
		throw new Error("empty image data")
	}
	const safeExtension = extension.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "png"
	const directory = path.join(tmpdir(), "elf-paste")
	mkdirSync(directory, { recursive: true })
	const filePath = path.join(directory, `paste-${fileHash(bytes)}-${randomBytes(4).toString("hex")}.${safeExtension}`)
	writeFileSync(filePath, bytes)
	return filePath
}

function findSofficeBinary(): string | null {
	const candidates = [
		"/opt/homebrew/bin/soffice",
		"/usr/local/bin/soffice",
		"/Applications/LibreOffice.app/Contents/MacOS/soffice",
		"/usr/bin/soffice",
		"/usr/bin/libreoffice",
	]
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate
		}
	}
	return null
}

function officeCacheKey(filePath: string): string {
	const stat = statSync(filePath)
	const basis = `${filePath}|${stat.mtimeMs}|${stat.size}`
	return Buffer.from(basis).toString("base64url")
}

function runOfficeConvert(binary: string, filePath: string, outDir: string, key: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const profileDir = path.join(tmpdir(), "elf-office-preview", `.profile-${key}`)
		mkdirSync(profileDir, { recursive: true })
		execFile(
			binary,
			[
				"--headless",
				`-env:UserInstallation=file://${profileDir}`,
				"--convert-to",
				"pdf",
				"--outdir",
				outDir,
				filePath,
			],
			(error, _stdout, stderr) => {
				if (error) {
					reject(new Error(stderr.trim() || error.message || "conversion failed"))
					return
				}
				resolve()
			},
		)
	})
}

export async function convertOfficeToPdf(filePath: string): Promise<OfficeConversionResult> {
	const binary = findSofficeBinary()
	if (!binary) {
		throw new Error("LibreOffice (soffice) not found")
	}
	const key = officeCacheKey(filePath)
	const outDir = path.join(tmpdir(), "elf-office-preview", key)
	mkdirSync(outDir, { recursive: true })
	const expectedPdf = path.join(outDir, `${path.basename(filePath, path.extname(filePath))}.pdf`)
	if (existsSync(expectedPdf)) {
		return { pdfPath: expectedPdf, cacheHit: true }
	}
	await runOfficeConvert(binary, filePath, outDir, key)
	if (existsSync(expectedPdf)) {
		return { pdfPath: expectedPdf, cacheHit: false }
	}
	for (const entry of readdirSync(outDir)) {
		if (entry.toLowerCase().endsWith(".pdf")) {
			return { pdfPath: path.join(outDir, entry), cacheHit: false }
		}
	}
	throw new Error("conversion produced no PDF")
}
