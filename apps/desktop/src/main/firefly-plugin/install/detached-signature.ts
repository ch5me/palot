/**
 * Firefly Plugin Marketplace — detached registry-signature resolution (A2b).
 *
 * Resolves the served `ServedSignatureMetadata` for a download, verifies the
 * CH5 marketplace (repository) signature over the CANONICAL signed manifest,
 * cross-checks `manifest.contentSha256 === sha256(rawBytes)`, and feeds the
 * verified `{signature, publicKeyPem, data}` into `derivePackageTrust`.
 *
 * Source policy (§2, §6.2):
 *   - kind:"firefly"     → read the served `ServedSignatureMetadata` (canonical
 *                          manifest + signatureB64) from the gallery metadata.
 *   - kind:"local-vsix"  → read a `<pkg>.sig.json` sidecar (same shape) when
 *                          present; absent → null (dev/test fixtures).
 *   - kind:"open-vsx"    → ALWAYS null (Open VSX serves no CH5 signature).
 *
 * INVARIANT (cross-repo, §6.2): the server signs `canonicalManifestBytes(manifest)`
 * and the client verifies `canonicalManifestBytes(manifest)` — byte-identical
 * canonical serialization. `contentSha256` inside the manifest binds the actual
 * downloaded bytes (anti-substitution); `version` inside the manifest provides
 * anti-rollback.
 *
 * Fail-fast (CH5 #9): a present-but-invalid signature or a contentSha256
 * mismatch is a HARD throw (`SignatureVerificationError("integrity_mismatch")`)
 * — never silently downgraded. An ABSENT signature returns null so the caller's
 * policy gate (A2c) decides whether unsigned is permitted for the source.
 *
 * This is a MAIN-process module (imports `node:crypto` via signature-verify).
 */

import { createLogger } from "../../logger"
import type { TrustAnchorRegistry } from "../../../shared/firefly-plugin/trust-anchor-registry"
import {
	canonicalManifestBytes,
	type CanonicalSignedManifest,
	type DetachedSignature,
	type ServedSignatureMetadata,
} from "../../../shared/firefly-plugin/registry-signature-contract"
import {
	derivePackageTrust,
	SignatureVerificationError,
	verifyDetachedSignature,
	type SignatureState,
	type TrustTier,
} from "./signature-verify"
import { sha256Hex } from "./package-store"

const log = createLogger("firefly-plugin/detached-signature")

// ---------------------------------------------------------------------------
// Source discriminator
// ---------------------------------------------------------------------------

/**
 * The install-source kind for signature resolution. Mirrors the public
 * `MarketplaceInstallInput.kind` discriminator.
 *
 *  - "firefly"    → signing-authority gallery; signature is served + required.
 *  - "local-vsix" → local file; optional `<pkg>.sig.json` sidecar.
 *  - "open-vsx"   → never carries a CH5 signature.
 */
export type SignatureSourceKind = "firefly" | "local-vsix" | "open-vsx"

/**
 * Maps a signature source kind to the `derivePackageTrust` source vocabulary.
 * The firefly gallery and a manual local VSIX both flow through the
 * marketplace-publisher path ("manual-vsix"); open-vsx keeps its own source.
 */
function trustSourceForKind(
	kind: SignatureSourceKind,
): "open-vsx" | "manual-vsix" {
	return kind === "open-vsx" ? "open-vsx" : "manual-vsix"
}

// ---------------------------------------------------------------------------
// Resolution IO
// ---------------------------------------------------------------------------

/**
 * Minimal IO surface for resolving a signature sidecar/metadata. Kept narrow so
 * tests can inject without a real filesystem.
 */
export interface DetachedSignatureIo {
	/** Read raw bytes from a file. Throws when the file is absent. */
	readFileSync(filePath: string): Buffer
	/** Return true when a path exists. */
	existsSync(pathToCheck: string): boolean
}

// ---------------------------------------------------------------------------
// Input / output
// ---------------------------------------------------------------------------

export interface ResolveDetachedSignatureInput {
	/** The install-source kind (drives where the signature comes from). */
	source: SignatureSourceKind
	/**
	 * The served signature metadata for a `kind:"firefly"` install (read from
	 * the gallery byte+signature endpoint by the caller). Omitted/undefined when
	 * the gallery served no signature.
	 */
	registryMeta?: ServedSignatureMetadata | null
	/** The raw downloaded package bytes (pre-extract). */
	rawBytes: Buffer
	/**
	 * The content-addressed unpacked path. Reserved for future sidecar layouts
	 * that live next to the extracted tree; not read for the MVP sidecar shape.
	 */
	unpackedPath?: string
	/**
	 * For `kind:"local-vsix"`: the original package path. The sidecar is resolved
	 * as `<localPackagePath>.sig.json` when present.
	 */
	localPackagePath?: string
	/** Trust-anchor registry resolving `publisherKeyId → public PEM`. */
	trustAnchorRegistry: TrustAnchorRegistry
	/** Injectable IO for sidecar reads. */
	io: DetachedSignatureIo
	/** Original download URL (diagnostic logging only). */
	downloadUrl?: string | null
}

/**
 * The verified provenance produced by a resolved + valid signature. Persisted
 * onto the `extension_packages` row (A2d) and used to derive trust.
 */
export interface ResolvedSignatureProvenance {
	signatureState: SignatureState
	trustTier: TrustTier
	/** The verified canonical signed manifest (anti-rollback / anti-substitution). */
	signedManifest: CanonicalSignedManifest
	/** The detached signature as carried on the wire. */
	signature: DetachedSignature
	/** The publisher key id that resolved + verified. */
	publisherKeyId: string
}

// ---------------------------------------------------------------------------
// Sidecar reader (local-vsix)
// ---------------------------------------------------------------------------

/**
 * Read a `<localPackagePath>.sig.json` sidecar carrying `ServedSignatureMetadata`.
 * Returns null when the sidecar is absent (a valid unsigned local install).
 * Throws when the sidecar exists but is unparseable (fail-loud, never silent).
 */
function readLocalSidecar(
	localPackagePath: string,
	io: DetachedSignatureIo,
): ServedSignatureMetadata | null {
	const sidecarPath = `${localPackagePath}.sig.json`
	if (!io.existsSync(sidecarPath)) return null
	const bytes = io.readFileSync(sidecarPath)
	try {
		return JSON.parse(bytes.toString("utf8")) as ServedSignatureMetadata
	} catch (err) {
		throw new SignatureVerificationError(
			"integrity_mismatch",
			`failed to parse signature sidecar ${sidecarPath}: ${
				err instanceof Error ? err.message : String(err)
			}`,
		)
	}
}

// ---------------------------------------------------------------------------
// Core: resolveDetachedSignature
// ---------------------------------------------------------------------------

/**
 * Resolve + verify the detached registry signature for a download.
 *
 * Returns:
 *   - `ResolvedSignatureProvenance` when a signature is present, verifies, and
 *     its `contentSha256` matches the raw bytes — `trustTier=signed-third-party`.
 *   - a provenance with `trustTier=unsigned-third-party` / `signatureState=unverified`
 *     when a signature is present but the `publisherKeyId` is unknown/revoked to
 *     this host's trust anchors (cannot verify — treated conservatively, NOT a
 *     throw, so the install records the unverified state).
 *   - `null` when NO signature is resolvable for the source (caller's policy
 *     gate decides whether unsigned is permitted).
 *
 * @throws `SignatureVerificationError("integrity_mismatch")` when a present
 *   signature does not verify OR `manifest.contentSha256 !== sha256(rawBytes)`.
 */
export function resolveDetachedSignature(
	input: ResolveDetachedSignatureInput,
): ResolvedSignatureProvenance | null {
	const { source, rawBytes, trustAnchorRegistry, io } = input

	// Open VSX serves no CH5 signature — permanently unsigned.
	if (source === "open-vsx") return null

	// Resolve the served metadata per source kind.
	let served: ServedSignatureMetadata | null = null
	if (source === "firefly") {
		served = input.registryMeta ?? null
	} else {
		// local-vsix: prefer an explicitly served metadata; else read the sidecar.
		served = input.registryMeta ?? null
		if (!served && input.localPackagePath) {
			served = readLocalSidecar(input.localPackagePath, io)
		}
	}

	// No signature resolvable → caller's policy gate decides.
	if (!served) return null

	const manifest = served.manifest
	const signature: DetachedSignature = {
		algorithm: manifest.algorithm,
		signatureB64: served.signatureB64,
		publisherKeyId: manifest.publisherKeyId,
	}

	// Resolve the publisher key → PEM via the injected trust anchors.
	// Unknown/revoked → null PEM → derivePackageTrust yields unverified
	// (conservative, no throw) so the install records the unverified state.
	const publicKeyPem = trustAnchorRegistry.resolve(manifest.publisherKeyId)

	const trustSource = trustSourceForKind(source)
	const data = Buffer.from(canonicalManifestBytes(manifest))

	if (publicKeyPem === null) {
		log.warn("Publisher key not trusted by host; recording unverified", {
			publisherKeyId: manifest.publisherKeyId,
			revoked: trustAnchorRegistry.isRevoked(manifest.publisherKeyId),
		})
		const trust = derivePackageTrust({
			source: trustSource,
			signature,
			publicKeyPem: null,
			data,
		})
		return {
			signatureState: trust.signatureState,
			trustTier: trust.trustTier,
			signedManifest: manifest,
			signature,
			publisherKeyId: manifest.publisherKeyId,
		}
	}

	// Verify the canonical-manifest signature BEFORE trusting any of its fields.
	// derivePackageTrust throws integrity_mismatch on a present-but-invalid sig.
	const trust = derivePackageTrust({
		source: trustSource,
		signature,
		publicKeyPem,
		data,
	})

	// Manifest signature verified. Now cross-check that the signed contentSha256
	// actually binds the bytes we downloaded (anti-substitution). A mismatch is a
	// hard fail — a valid signature over different bytes must never install.
	const actualSha = sha256Hex(rawBytes)
	if (manifest.contentSha256 !== actualSha) {
		throw new SignatureVerificationError(
			"integrity_mismatch",
			`signed manifest contentSha256 mismatch: manifest=${manifest.contentSha256} actual=${actualSha}`,
		)
	}

	// Defense-in-depth: re-affirm the verification result is positive. (The
	// throw above already guards this, but keep the check explicit/fail-loud.)
	const reverify = verifyDetachedSignature({ data, signature, publicKeyPem })
	if (!reverify.verified) {
		throw new SignatureVerificationError(
			"integrity_mismatch",
			`canonical manifest signature did not verify: ${reverify.reason}`,
		)
	}

	log.info("Registry signature verified", {
		publisherKeyId: manifest.publisherKeyId,
		namespace: manifest.namespace,
		name: manifest.name,
		version: manifest.version,
	})

	return {
		signatureState: trust.signatureState,
		trustTier: trust.trustTier,
		signedManifest: manifest,
		signature,
		publisherKeyId: manifest.publisherKeyId,
	}
}
