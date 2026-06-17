/**
 * Canonical OpenCode runtime contract for alpha launch.
 *
 * This descriptor states intended runtime path. Callers must fail loud when
 * declared runtime is unavailable. No silent bundled -> existing -> remote
 * fallback.
 */

export type OpenCodeRuntimeMode = "bundled-local" | "existing-local" | "remote-http"

export type OpenCodeRuntimeSource = "bundled-portable" | "existing-daemon" | "remote-url"

export type OpenCodeRuntimeOwnership = "elf-managed" | "externally-managed"

export type OpenCodeRuntimeLifecycle = "managed" | "attach-only"

export interface OpenCodeRuntimeDescriptor {
	mode: OpenCodeRuntimeMode
	source: OpenCodeRuntimeSource
	ownership: OpenCodeRuntimeOwnership
	lifecycle: OpenCodeRuntimeLifecycle
}
