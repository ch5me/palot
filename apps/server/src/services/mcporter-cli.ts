import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export interface McporterCommand {
	file: string
	args: string[]
}

let cachedCommand: { file: string; useNode: boolean } | null = null

function collectSearchRoots() {
	const roots = new Set<string>()
	const startDirs = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))]

	for (const startDir of startDirs) {
		let current = startDir
		while (true) {
			roots.add(current)
			const parent = path.dirname(current)
			if (parent === current) break
			current = parent
		}
	}

	return Array.from(roots)
}

function resolveInstalledMcporter() {
	const binName = process.platform === "win32" ? "mcporter.cmd" : "mcporter"

	for (const root of collectSearchRoots()) {
		const shimPath = path.join(root, "node_modules", ".bin", binName)
		if (fs.existsSync(shimPath)) {
			return { file: shimPath, useNode: false }
		}

		const cliPath = path.join(root, "node_modules", "mcporter", "dist", "cli.js")
		if (fs.existsSync(cliPath)) {
			return { file: cliPath, useNode: true }
		}
	}

	throw new Error("Failed to resolve installed mcporter CLI")
}

export function resolveMcporterCommand(args: string[]): McporterCommand {
	cachedCommand ??= resolveInstalledMcporter()
	if (cachedCommand.useNode) {
		return { file: process.execPath, args: [cachedCommand.file, ...args] }
	}
	return { file: cachedCommand.file, args }
}
