#!/usr/bin/env node
/**
 * mint-plugin-signing-key — mint a Firefly marketplace registry signing keypair.
 *
 * CH5 is the marketplace authority (the "Microsoft" role, modeled on the VS Code
 * marketplace repository-signing scheme). firefly-cloud signs every package it
 * serves with the PRIVATE half; palot bakes the PUBLIC half in as a trust anchor,
 * so a downloaded package derives `signed-third-party`.
 *
 * - Algorithm: ed25519 (signature-verify.ts's first-class path).
 * - Private key (PKCS#8 PEM)  -> repo-local Hush, NEVER printed, NEVER committed.
 * - Public key (SPKI PEM)     -> committed trust anchor (non-secret).
 * - Rotation: re-run with a new --key-id; clients trust a MAP of key ids, so old
 *   ids stay valid until explicitly revoked.
 *
 * Usage:
 *   node scripts/mint-plugin-signing-key.mjs \
 *     --key-id firefly-registry-root-2026 \
 *     [--hush-key FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY] \
 *     [--anchor-dir apps/desktop/src/shared/firefly-plugin/trust-anchors] \
 *     [--dry-run]
 *
 * Never prints the private key. Prints only the public key, key id, and fingerprint.
 */

import { generateKeyPairSync, createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "..")

function arg(name, fallback) {
	const i = process.argv.indexOf(`--${name}`)
	if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1]
	return fallback
}
const hasFlag = (name) => process.argv.includes(`--${name}`)

const keyId = arg("key-id", "firefly-registry-root-2026")
const hushKey = arg("hush-key", "FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY")
const anchorDir = arg("anchor-dir", "apps/desktop/src/shared/firefly-plugin/trust-anchors")
const dryRun = hasFlag("dry-run")

if (!/^[a-z0-9-]+$/.test(keyId)) {
	console.error(`error: --key-id must be kebab-case [a-z0-9-]; got "${keyId}"`)
	process.exit(1)
}

// 1. Generate ed25519 keypair.
const { publicKey, privateKey } = generateKeyPairSync("ed25519")
const privPem = privateKey.export({ type: "pkcs8", format: "pem" })
const pubPem = publicKey.export({ type: "spki", format: "pem" })
const pubDer = publicKey.export({ type: "spki", format: "der" })
const fingerprint = createHash("sha256").update(pubDer).digest("hex")

// 2. Write the public trust anchor (non-secret, committed).
const anchorPath = join(repoRoot, anchorDir, `${keyId}.pub.pem`)
if (dryRun) {
	console.log(`[dry-run] would write public anchor -> ${anchorPath}`)
	console.log(`[dry-run] would set hush secret "${hushKey}" (repo-local) from stdin`)
} else {
	mkdirSync(dirname(anchorPath), { recursive: true })
	writeFileSync(anchorPath, pubPem, { mode: 0o644 })

	// 3. Store the PRIVATE key in repo-local Hush via stdin (AI-safe, never printed).
	const res = spawnSync("hush", ["set", hushKey], {
		cwd: repoRoot,
		input: privPem,
		stdio: ["pipe", "inherit", "inherit"],
		timeout: 20000,
	})
	if (res.status !== 0) {
		console.error(`error: "hush set ${hushKey}" failed (status ${res.status}). Public anchor written; private NOT stored.`)
		process.exit(res.status ?? 1)
	}

	// 4. Confirm presence (name only, never value).
	const has = spawnSync("hush", ["has", hushKey], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] })
	if (has.status !== 0) {
		console.error(`error: "hush has ${hushKey}" returned non-zero after set — secret not confirmed.`)
		process.exit(1)
	}
}

// 5. Report (all non-secret).
console.log("")
console.log("=== Firefly registry signing key minted ===")
console.log(`key id      : ${keyId}`)
console.log(`algorithm   : ed25519`)
console.log(`fingerprint : sha256:${fingerprint}`)
console.log(`hush secret : ${hushKey} (repo-local, private — never committed)`)
console.log(`trust anchor: ${join(anchorDir, `${keyId}.pub.pem`)} (public — committed)`)
console.log("")
console.log("public key (SPKI PEM, non-secret):")
console.log(pubPem.trim())
