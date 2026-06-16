#!/usr/bin/env node
/**
 * sign-plugin-package — sign a Firefly plugin package (.fpk / .vsix).
 *
 * Builds a `CanonicalSignedManifest` {namespace, name, version, contentSha256,
 * algorithm, signedAt, publisherKeyId}, signs `canonicalManifestBytes(manifest)`
 * with ed25519, and emits `<out>.sig.json` = `ServedSignatureMetadata`.
 *
 * Usage (prod — private key from Hush):
 *   node scripts/sign-plugin-package.mjs \
 *     --in <pkg.fpk> --out <pkg.fpk> \
 *     --key-id firefly-registry-root-2026 \
 *     --namespace bobsoft --name linter --version 0.1.0 \
 *     --hush-key FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY
 *
 * Usage (ephemeral — throwaway ed25519 for CI / fixtures):
 *   node scripts/sign-plugin-package.mjs \
 *     --in <pkg.fpk> --out <pkg.fpk> \
 *     --key-id ephemeral-test-key \
 *     --namespace bobsoft --name linter --version 0.1.0 \
 *     --ephemeral --anchor-out <keyId>.ephemeral.pub.pem
 *
 * Flags:
 *   --in <path>          Package file to sign (read for SHA-256; not re-written).
 *   --out <path>         Output basename; writes <out>.sig.json alongside.
 *                        Defaults to same path as --in.
 *   --key-id <id>        Key identifier embedded in the manifest.
 *   --namespace <ns>     Plugin namespace.
 *   --name <n>           Plugin name.
 *   --version <v>        Plugin version.
 *   --signed-at <iso>    Override the signing timestamp (default: now).
 *   --hush-key <KEY>     Hush secret name for the private key PEM (default:
 *                        FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY). Ignored when
 *                        --ephemeral is set.
 *   --ephemeral          Generate a throwaway ed25519 keypair. The private key is
 *                        used only in-process and never stored.
 *   --anchor-out <path>  When --ephemeral: write the public SPKI PEM here.
 *   --dry-run            Parse + validate only; do not write any files.
 *
 * NEVER prints the private key.
 */

import { createHash, createPrivateKey, generateKeyPairSync, sign as cryptoSign } from "node:crypto"
import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "..")

function arg(name, fallback = undefined) {
	const i = process.argv.indexOf(`--${name}`)
	if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1]
	return fallback
}

const hasFlag = (name) => process.argv.includes(`--${name}`)

function die(msg) {
	console.error(`error: ${msg}`)
	process.exit(1)
}

// ---------------------------------------------------------------------------
// Canonical manifest serialization
// Must byte-match `canonicalManifestBytes` in registry-signature-contract.ts.
// ---------------------------------------------------------------------------

function canonicalManifestBytes(m) {
	const ordered = {
		namespace: m.namespace,
		name: m.name,
		version: m.version,
		contentSha256: m.contentSha256,
		algorithm: m.algorithm,
		signedAt: m.signedAt,
		publisherKeyId: m.publisherKeyId,
	}
	return Buffer.from(JSON.stringify(ordered), "utf8")
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const inPath = arg("in")
const outBase = arg("out", inPath)
const keyId = arg("key-id")
const namespace = arg("namespace")
const name = arg("name")
const version = arg("version")
const signedAt = arg("signed-at", new Date().toISOString())
const hushKey = arg("hush-key", "FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY")
const ephemeral = hasFlag("ephemeral")
const anchorOut = arg("anchor-out")
const dryRun = hasFlag("dry-run")

if (!inPath) die("--in <path> is required")
if (!outBase) die("--out <path> is required (or defaults to --in)")
if (!keyId) die("--key-id <id> is required")
if (!namespace) die("--namespace <ns> is required")
if (!name) die("--name <n> is required")
if (!version) die("--version <v> is required")

// ---------------------------------------------------------------------------
// Read package bytes
// ---------------------------------------------------------------------------

const absIn = resolve(inPath)
let pkgBytes
try {
	pkgBytes = readFileSync(absIn)
} catch (err) {
	die(`cannot read --in ${absIn}: ${err.message}`)
}

const contentSha256 = createHash("sha256").update(pkgBytes).digest("hex")

// ---------------------------------------------------------------------------
// Build canonical manifest
// ---------------------------------------------------------------------------

/** @type {import('../apps/desktop/src/shared/firefly-plugin/registry-signature-contract.js').CanonicalSignedManifest} */
const manifest = {
	namespace,
	name,
	version,
	contentSha256,
	algorithm: "ed25519",
	signedAt,
	publisherKeyId: keyId,
}

const manifestBytes = canonicalManifestBytes(manifest)

// ---------------------------------------------------------------------------
// Resolve signing key
// ---------------------------------------------------------------------------

let privKey
if (ephemeral) {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519")
	privKey = privateKey

	const pubPem = publicKey.export({ type: "spki", format: "pem" })

	if (anchorOut && !dryRun) {
		const absAnchor = resolve(anchorOut)
		mkdirSync(dirname(absAnchor), { recursive: true })
		writeFileSync(absAnchor, pubPem, { mode: 0o644 })
		console.log(`ephemeral pubkey -> ${absAnchor}`)
	} else if (anchorOut && dryRun) {
		console.log(`[dry-run] would write ephemeral pubkey -> ${resolve(anchorOut)}`)
	} else {
		// Still print to stdout so callers can capture it without --anchor-out.
		console.log("ephemeral public key (SPKI PEM, non-secret):")
		console.log(pubPem.trim())
	}
} else {
	// Prod path: read private key PEM from Hush via stdin pipe.
	if (dryRun) {
		console.log(`[dry-run] would read hush secret "${hushKey}" (repo-local) via stdin`)
	} else {
		const res = spawnSync("hush", ["get", hushKey], {
			cwd: repoRoot,
			stdio: ["ignore", "pipe", "inherit"],
			timeout: 20000,
		})
		if (res.status !== 0) {
			die(`"hush get ${hushKey}" failed (status ${res.status}). Is the secret set? Run: hush set ${hushKey}`)
		}
		const privPem = res.stdout.toString("utf8").trim()
		if (!privPem) die(`"hush get ${hushKey}" returned empty output`)
		try {
			privKey = createPrivateKey(privPem)
		} catch (err) {
			die(`failed to parse private key PEM from hush: ${err.message}`)
		}
	}
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

let signatureB64
if (dryRun) {
	console.log("[dry-run] would sign canonicalManifestBytes with ed25519")
	signatureB64 = "<dry-run-signature>"
} else {
	const sigBuffer = cryptoSign(null, manifestBytes, privKey)
	signatureB64 = sigBuffer.toString("base64")
}

// ---------------------------------------------------------------------------
// Emit .sig.json (ServedSignatureMetadata)
// ---------------------------------------------------------------------------

/** @type {import('../apps/desktop/src/shared/firefly-plugin/registry-signature-contract.js').ServedSignatureMetadata} */
const sigMeta = { manifest, signatureB64 }

const sigJson = JSON.stringify(sigMeta, null, 2)
const absOut = resolve(outBase)
const sigPath = `${absOut}.sig.json`

if (dryRun) {
	console.log(`[dry-run] would write signature metadata -> ${sigPath}`)
	console.log("[dry-run] manifest:", JSON.stringify(manifest, null, 2))
} else {
	writeFileSync(sigPath, sigJson + "\n", { mode: 0o644 })
	console.log(`signed  : ${absIn}`)
	console.log(`manifest: contentSha256=${contentSha256}`)
	console.log(`sig.json: ${sigPath}`)
}
