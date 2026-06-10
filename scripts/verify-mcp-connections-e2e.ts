#!/usr/bin/env bun
import fs from "node:fs"
import path from "node:path"
import { buildMcpE2eSnapshot } from "../apps/desktop/src/renderer/lib/mcp-connections-e2e"

interface RecordFile {
	records?: Record<
		string,
		{
			name: string
			authState?: string
			testState?: string
			status?: string
			runtimeState?: string
			lastHealthyAt?: string | null
			canonicalStore?: string
			ownershipMode?: string
			restorePolicy?: string
		}
	>
}

function parseArgs(argv: string[]) {
	const args = { file: "", visibleTextFile: "", domSnapshotFile: "" }
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === "--file") {
			args.file = argv[index + 1] ?? ""
			index += 1
			continue
		}
		if (argv[index] === "--visible-text-file") {
			args.visibleTextFile = argv[index + 1] ?? ""
			index += 1
			continue
		}
		if (argv[index] === "--dom-snapshot-file") {
			args.domSnapshotFile = argv[index + 1] ?? ""
			index += 1
		}
	}
	return args
}

function readOptionalTextFile(filePath: string): string | undefined {
	if (!filePath) return undefined
	const resolvedPath = path.resolve(filePath)
	if (!fs.existsSync(resolvedPath)) throw new Error(`DOM evidence file not found: ${resolvedPath}`)
	return fs.readFileSync(resolvedPath, "utf-8")
}

function main() {
	const args = parseArgs(process.argv.slice(2))
	if (!args.file)
		throw new Error("Usage: bun scripts/verify-mcp-connections-e2e.ts --file <records.json>")
	const filePath = path.resolve(args.file)
	if (!fs.existsSync(filePath)) throw new Error(`Connection records file not found: ${filePath}`)
	const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as RecordFile
	const records = Object.values(parsed.records ?? {})
	if (records.length === 0) throw new Error("No MCP connection records found")
	const visibleText = readOptionalTextFile(args.visibleTextFile)
	const domSnapshot = readOptionalTextFile(args.domSnapshotFile)
	const domInput = visibleText || domSnapshot ? { visibleText, domSnapshot } : undefined
	const snapshot = buildMcpE2eSnapshot(records, domInput)
	const ok = snapshot.domReadiness ? snapshot.domReadiness.ready : true
	process.stdout.write(`${JSON.stringify({ ok, snapshot }, null, 2)}\n`)
	if (!ok) process.exitCode = 1
}

main()
