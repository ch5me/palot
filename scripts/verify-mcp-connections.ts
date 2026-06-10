#!/usr/bin/env bun
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { summarizeMcpVerification } from "../apps/desktop/src/renderer/lib/mcp-connections-verification"

interface ConnectionRecordSnapshot {
	name: string
	authState?: string
	testState?: string
	status?: string
	runtimeState?: string
	lastHealthyAt?: string | null
	canonicalStore?: string
	ownershipMode?: string
	restorePolicy?: string
	credentialMode?: string
	metadata?: Record<string, unknown>
}

interface RecordFile {
	records?: Record<string, ConnectionRecordSnapshot>
}

function parseArgs(argv: string[]) {
	const args = { file: "", requireGateway: false, requireCloudRestore: false }
	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index]
		if (value === "--file") {
			args.file = argv[index + 1] ?? ""
			index += 1
			continue
		}
		if (value === "--require-gateway") {
			args.requireGateway = true
			continue
		}
		if (value === "--require-cloud-restore") {
			args.requireCloudRestore = true
		}
	}
	return args
}

function fail(message: string): never {
	throw new Error(message)
}

function main() {
	const args = parseArgs(process.argv.slice(2))
	if (!args.file)
		fail(
			"Usage: bun scripts/verify-mcp-connections.ts --file <records.json> [--require-gateway] [--require-cloud-restore]",
		)
	const filePath = path.resolve(args.file)
	if (!fs.existsSync(filePath)) fail(`Connection records file not found: ${filePath}`)
	const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as RecordFile
	const records = Object.values(parsed.records ?? {})
	if (records.length === 0) fail("No MCP connection records found")

	const snapshot = summarizeMcpVerification(records)
	assert.equal(snapshot.serverNames.length, records.length)
	assert.equal(snapshot.ownershipModes.length, records.length)
	assert.equal(snapshot.hydrationStates.length, records.length)
	assert.equal(snapshot.statuses.length, records.length)

	for (const record of records) {
		if (record.ownershipMode === "cloud-only") {
			assert.equal(
				record.canonicalStore,
				"gateway",
				`cloud-only record ${record.name} must use gateway canonical store`,
			)
			if (args.requireCloudRestore) {
				assert.equal(
					record.restorePolicy,
					"reproject_and_reauth_if_needed",
					`cloud-only record ${record.name} must use cloud restore policy`,
				)
			}
		}
		if (record.ownershipMode === "local-only") {
			assert.equal(
				record.canonicalStore,
				"local",
				`local-only record ${record.name} must use local canonical store`,
			)
		}
	}

	if (args.requireGateway) {
		assert.ok(snapshot.gatewayCount > 0, "Expected at least one gateway-owned MCP record")
	}

	process.stdout.write(
		`${JSON.stringify(
			{
				ok: true,
				recordCount: records.length,
				snapshot,
			},
			null,
			2,
		)}\n`,
	)
}

main()
