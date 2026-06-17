/**
 * A2d migration column-existence proof.
 *
 * Runs the full Drizzle migration set against a FRESH in-memory libsql DB
 * (the same path `ensureDb()` exercises at runtime) and asserts the four
 * signature-provenance columns added by
 * `20260617000000_extension-package-signature-provenance` exist on
 * `extension_packages`.
 *
 * This is the tripwire for a malformed migration dir name: the runtime
 * migrator reads ONLY the directory-name timestamp (`YYYYMMDDHHMMSS`, strictly
 * > 20260616213300) + `migration.sql`; if the dir name does not parse or the
 * timestamp is not greater, the ALTERs never apply and these columns are
 * missing. (`snapshot.json`/`prevIds` is INERT at runtime.)
 */

import { describe, expect, it } from "bun:test"

import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"
import { sql } from "drizzle-orm"

import * as schema from "../../automation/schema"

async function freshMigratedDb() {
	const client = createClient({ url: ":memory:" })
	const db = drizzle({ client, schema })
	await migrate(db, { migrationsFolder: "./drizzle" })
	return db
}

const PROVENANCE_COLUMNS = [
	"publisher_key_id",
	"signature_algorithm",
	"signature_b64",
	"signed_manifest_json",
] as const

describe("extension_packages signature-provenance migration", () => {
	it("adds the four provenance columns to a freshly migrated DB", async () => {
		const db = await freshMigratedDb()
		const rows = (await db.all(
			sql`PRAGMA table_info(extension_packages)`,
		)) as Array<{ name: string }>
		const columnNames = new Set(rows.map((r) => r.name))

		for (const col of PROVENANCE_COLUMNS) {
			expect(columnNames.has(col)).toBe(true)
		}
	})

	it("the new provenance columns are nullable (no default required on insert)", async () => {
		const db = await freshMigratedDb()
		const rows = (await db.all(
			sql`PRAGMA table_info(extension_packages)`,
		)) as Array<{ name: string; notnull: number; dflt_value: string | null }>
		const byName = new Map(rows.map((r) => [r.name, r]))

		for (const col of PROVENANCE_COLUMNS) {
			const info = byName.get(col)
			expect(info).toBeDefined()
			// notnull=0 → nullable; existing rows tolerate the ADD COLUMN.
			expect(info!.notnull).toBe(0)
		}
	})

	it("accepts an insert that populates the provenance columns", async () => {
		const db = await freshMigratedDb()
		const now = Date.now()
		await db.insert(schema.extensionPackages).values({
			id: "sha-prov-1",
			externalId: "bobsoft.linter",
			publisher: "bobsoft",
			name: "linter",
			version: "0.1.0",
			registrySource: "manual-vsix",
			unpackedPath: "/tmp/pkg/sha-prov-1",
			signatureState: "verified",
			scanState: "clean",
			publisherKeyId: "firefly-registry-root-2026",
			signatureAlgorithm: "ed25519",
			signatureB64: "AAAA",
			signedManifestJson: JSON.stringify({ namespace: "bobsoft", name: "linter", version: "0.1.0" }),
			createdAt: now,
		})

		const fetched = await db.all(
			sql`SELECT publisher_key_id, signature_algorithm, signature_b64, signed_manifest_json
			    FROM extension_packages WHERE id = 'sha-prov-1'`,
		)
		expect(fetched).toHaveLength(1)
		const row = fetched[0] as Record<string, unknown>
		expect(row.publisher_key_id).toBe("firefly-registry-root-2026")
		expect(row.signature_algorithm).toBe("ed25519")
		expect(row.signature_b64).toBe("AAAA")
	})
})
