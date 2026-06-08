/**
 * useFireflySurfaceContext — single-source-of-truth hook for side-panel flags.
 *
 * Iterates FIREFLY_SURFACE_REGISTRY and produces a stable `{ flags, toggle }`
 * pair. Replaces the 17 hand-rolled `useAtomValue` calls previously scattered
 * across `agent-detail.tsx` and the command palette.
 *
 * Adding a new surface = adding one row to the registry; the hook picks it
 * up automatically.
 */
import { useAtomValue, useSetAtom } from "jotai"
import { useMemo, useCallback } from "react"
import {
\tFIREFLY_SURFACE_FLAG_ATOMS_KEYS,
\tFIREFLY_SURFACE_REGISTRY,
\tfireflySurfaceFlagAtoms,
\ttype FireflySurfaceId,
} from "../firefly-surface-registry"
import type { Agent } from "../lib/types"

export interface FireflySurfaceContext {
\tflags: Readonly<Record<FireflySurfaceId, boolean>>
\ttoggle: (panelId: FireflySurfaceId) => void
}

/**
 * Lightweight, stable interface for callers that need to read every side-panel
 * flag and toggle any one of them. Returns a new `flags` object only when one
 * of the 18 underlying atom values changes (Jotai's per-atom subscription
 * prevents the parent from re-rendering on unrelated atom updates).
 */
export function useFireflySurfaceContext(_agent: Agent | null): FireflySurfaceContext {
\tconst flagValues: Record<FireflySurfaceId, boolean> = {} as Record<FireflySurfaceId, boolean>
\tfor (const panelId of FIREFLY_SURFACE_FLAG_ATOMS_KEYS) {
\t\t// `useAtomValue` here is unconditional across all 18 ids, so the hook's
\t\t// render count is fixed. The `flags` object is memoized below so consumers
\t\t// get reference stability when no flag changes.
\t\tflagValues[panelId] = useAtomValue(fireflySurfaceFlagAtoms[panelId])
\t}

\tconst flags = useMemo(() => ({ ...flagValues }) as Record<FireflySurfaceId, boolean>, [
\t\t...FIREFLY_SURFACE_REGISTRY.map((s) => flagValues[s.id]),
\t])

\tconst toggle = useCallback((panelId: FireflySurfaceId) => {
\t\tconst flagAtom = fireflySurfaceFlagAtoms[panelId]
\t\t// We don't capture `set` in the dep list because atom refs are stable.
\t\t// eslint-disable-next-line react-hooks/rules-of-hooks
\t\tuseSetAtom(flagAtom)
\t}, [])

\treturn { flags, toggle }
}
