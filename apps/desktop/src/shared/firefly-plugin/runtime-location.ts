/**
 * Firefly Plugin System V2 — runtime location resolution (the §2.3 matrix)
 *
 * THE SINGLE SOURCE OF TRUTH for "where does this extension's code run?".
 * Importable by both the Electron main process and the renderer (and the
 * future web build): types + pure functions only, no Electron imports, no
 * side-effects.
 *
 * The core idea (design §2.1):
 *
 *   > Host kind declares the runtime *contract*. The build + environment
 *   > decides the *location* that fulfills that contract.
 *
 * `resolveRuntimeLocation` IS the §2.3 matrix. Every consumer (supervisor
 * transport selection, projection "unsupported on this surface" badges,
 * compatibility solving) asks this one function rather than re-encoding the
 * matrix locally — so the matrix is one edit, not N (design-smell S10).
 *
 * Fail-fast, no silent fallback (CH5 principle #9): an extension with no
 * location for the current surface returns an explicit `{ supported: false }`
 * with a named reason. It is never silently mapped to a wrong location.
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Host kind — the runtime contract a manifest declares (design §2.3)
// ---------------------------------------------------------------------------

/**
 * Closed taxonomy. New tiers are a deliberate design change (they need a new
 * matrix row + transport), so this set is safe to hardcode; adding a value
 * here forces the exhaustive `switch` in `resolveRuntimeLocation` to handle it.
 */
export const HOST_KINDS = ["data-only", "builtin-main", "node-worker", "web-worker", "iframe-view"] as const
export type HostKind = (typeof HOST_KINDS)[number]
export const hostKindSchema = z.enum(HOST_KINDS)

// ---------------------------------------------------------------------------
// Runtime location — where the contract is fulfilled (design §2.2)
// ---------------------------------------------------------------------------

export const RUNTIME_LOCATIONS = [
	"none", // data-only: no code runs; host projects the manifest
	"electron-main", // host-owned built-in code in the Electron main process
	"electron-utility", // Node utility process / worker thread (Electron only)
	"browser-worker", // Web Worker in the renderer (both builds)
	"cloud-host", // Node extension host inside firefly-cloud (remote RPC)
	"iframe", // sandboxed iframe UI (both builds)
] as const
export type RuntimeLocation = (typeof RUNTIME_LOCATIONS)[number]

// ---------------------------------------------------------------------------
// Build surface — which build is running / which a version supports
// ---------------------------------------------------------------------------

export const BUILD_SURFACES = ["electron", "web"] as const
export type BuildSurface = (typeof BUILD_SURFACES)[number]
export const buildSurfaceSchema = z.enum(BUILD_SURFACES)

/**
 * Web strategy for a `node-worker` extension: either it runs remotely in the
 * firefly-cloud extension host, or it is explicitly unsupported on web. There
 * is no third "run Node in the browser" option — that does not exist.
 */
export const WEB_STRATEGIES = ["cloud-host", "unsupported"] as const
export type WebStrategy = (typeof WEB_STRATEGIES)[number]
export const webStrategySchema = z.enum(WEB_STRATEGIES)

// ---------------------------------------------------------------------------
// Runtime declaration — the manifest `runtime` block (design §2.5)
// ---------------------------------------------------------------------------

/**
 * `runtime` is OPTIONAL on the manifest. When omitted, the host infers a
 * back-compat default via `inferDefaultHostKind` (see descriptor.ts), so the
 * existing built-ins keep their current behavior untouched. New / third-party
 * extensions SHOULD declare it explicitly.
 */
export const runtimeDeclarationSchema = z
	.object({
		hostKind: hostKindSchema,
		/** Which builds this version supports. */
		surfaces: z.array(buildSurfaceSchema).min(1).default(["electron", "web"]),
		/** node-worker on web: run in firefly-cloud, or declare it unsupported. */
		webStrategy: webStrategySchema.default("unsupported"),
	})
	.strict()
export type RuntimeDeclaration = z.infer<typeof runtimeDeclarationSchema>

export const DEFAULT_RUNTIME_SURFACES: readonly BuildSurface[] = ["electron", "web"]

// ---------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------

export type RuntimeResolution =
	| { readonly supported: true; readonly location: RuntimeLocation }
	| { readonly supported: false; readonly reasonCode: string; readonly reason: string }

export interface ResolveRuntimeLocationInput {
	readonly hostKind: HostKind
	readonly build: BuildSurface
	readonly webStrategy: WebStrategy
	readonly surfaces: readonly BuildSurface[]
}

/**
 * Resolve the `RuntimeLocation` for a host kind on a given build — design
 * §2.3 verbatim. Pure & total: the `switch` is exhaustive over `HostKind`, so
 * adding a tier is a compile error here until the matrix row is written.
 *
 * Returns an explicit unsupported result (never a silent fallback) when:
 *   - the version does not declare support for the current build, or
 *   - a `node-worker` is asked to run on web with `webStrategy: "unsupported"`.
 */
export function resolveRuntimeLocation(input: ResolveRuntimeLocationInput): RuntimeResolution {
	const { hostKind, build, webStrategy, surfaces } = input

	if (!surfaces.includes(build)) {
		return {
			supported: false,
			reasonCode: "surface_unsupported",
			reason: `extension does not declare support for the ${build} build (declared surfaces: ${surfaces.join(", ") || "none"})`,
		}
	}

	switch (hostKind) {
		case "data-only":
			return { supported: true, location: "none" }
		case "iframe-view":
			return { supported: true, location: "iframe" }
		case "web-worker":
			return { supported: true, location: "browser-worker" }
		case "builtin-main":
			return build === "electron"
				? { supported: true, location: "electron-main" }
				: { supported: true, location: "cloud-host" }
		case "node-worker":
			if (build === "electron") {
				return { supported: true, location: "electron-utility" }
			}
			// web build
			if (webStrategy === "cloud-host") {
				return { supported: true, location: "cloud-host" }
			}
			return {
				supported: false,
				reasonCode: "node_worker_unsupported_on_web",
				reason:
					'node-worker extension requires Node and cannot run in the browser; set runtime.webStrategy to "cloud-host" once the firefly-cloud extension host is available (Phase 3)',
			}
	}
}

// ---------------------------------------------------------------------------
// Back-compat host-kind inference
// ---------------------------------------------------------------------------

/**
 * Contribution shape used to infer a default `hostKind` for manifests that
 * predate the `runtime` block. Counts of each contribution family plus the
 * bridge flag are sufficient — we never need the contribution contents.
 */
export interface HostKindInferenceInput {
	readonly codeContributions: number
	readonly uiContributions: number
	readonly dataContributions: number
}

/**
 * Infer the default `hostKind` for a manifest that does not declare `runtime`.
 *
 * - Pure data packs (only themes/snippets/languages/grammars/icon-themes, no
 *   code and no UI) → `data-only`: the host just projects the manifest.
 * - Everything else → `builtin-main`: matches today's behavior, where every
 *   built-in registers host-side command/tool handlers in the main process.
 *
 * This is a back-compat default only. New and third-party extensions should
 * declare `runtime.hostKind` explicitly rather than rely on inference.
 */
export function inferDefaultHostKind(input: HostKindInferenceInput): HostKind {
	if (input.codeContributions === 0 && input.uiContributions === 0) {
		return "data-only"
	}
	return "builtin-main"
}
