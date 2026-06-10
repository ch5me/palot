#!/usr/bin/env bun
import fs from "node:fs"
import path from "node:path"

interface FixtureRecord {
	name: string
	ownershipMode: "local-only" | "cloud-only" | "handoff-derived"
	canonicalStore: "local" | "gateway"
	restorePolicy: "none" | "reproject_on_boot" | "reproject_and_reauth_if_needed"
	runtimeState: "not_projected" | "projected" | "active" | "degraded" | "offline"
	status:
		| "connected"
		| "needs_auth"
		| "missing_env"
		| "degraded"
		| "offline"
		| "testing"
		| "installing"
		| "configured"
	lastHealthyAt: string | null
}

interface FixtureEnvelope {
	records: Record<string, FixtureRecord>
}

const FIXTURES: Record<string, FixtureEnvelope> = {
	mixed: {
		records: {
			github: {
				name: "github",
				ownershipMode: "cloud-only",
				canonicalStore: "gateway",
				restorePolicy: "reproject_and_reauth_if_needed",
				runtimeState: "active",
				status: "connected",
				lastHealthyAt: "2026-06-06T00:00:00.000Z",
			},
			postgres: {
				name: "postgres",
				ownershipMode: "local-only",
				canonicalStore: "local",
				restorePolicy: "reproject_on_boot",
				runtimeState: "projected",
				status: "configured",
				lastHealthyAt: null,
			},
		},
	},
	cloudOnly: {
		records: {
			notion: {
				name: "notion",
				ownershipMode: "cloud-only",
				canonicalStore: "gateway",
				restorePolicy: "reproject_and_reauth_if_needed",
				runtimeState: "degraded",
				status: "needs_auth",
				lastHealthyAt: null,
			},
		},
	},
	localOnly: {
		records: {
			filesystem: {
				name: "filesystem",
				ownershipMode: "local-only",
				canonicalStore: "local",
				restorePolicy: "reproject_on_boot",
				runtimeState: "active",
				status: "connected",
				lastHealthyAt: "2026-06-06T00:00:00.000Z",
			},
		},
	},
}

function parseArgs(argv: string[]) {
	const args = { scenario: "mixed", output: "" }
	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index]
		if (value === "--scenario") {
			args.scenario = argv[index + 1] ?? args.scenario
			index += 1
			continue
		}
		if (value === "--output") {
			args.output = argv[index + 1] ?? args.output
			index += 1
		}
	}
	return args
}

function main() {
	const args = parseArgs(process.argv.slice(2))
	const fixture = FIXTURES[args.scenario]
	if (!fixture) {
		throw new Error(`Unknown scenario: ${args.scenario}`)
	}
	const outputPath = path.resolve(args.output || `/tmp/palot-mcp-${args.scenario}.json`)
	fs.mkdirSync(path.dirname(outputPath), { recursive: true })
	fs.writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf-8")
	process.stdout.write(`${outputPath}\n`)
}

main()
