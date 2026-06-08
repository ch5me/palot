/**
 * Firefly Plugin System V2 — Index barrel
 *
 * The manifest schema is the canonical source of truth; the descriptor is
 * the validated, normalized form projections read from. This barrel
 * re-exports the public surface so host code can import everything from
 * one path.
 */

export * from "./manifest"
export * from "./descriptor"
export * from "./capabilities"
export * from "./tool-projection"
export * from "./family-contracts"
export * from "./palot-bridge-manifest"
export * from "./api-versioning"
export * from "./runtime-supervision"
export * from "./renderer-projection"
