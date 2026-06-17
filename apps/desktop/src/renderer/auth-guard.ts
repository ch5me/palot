import { redirect } from "@tanstack/react-router"
import type { ElfAuthStateDto } from "../preload/api"

/**
 * Auth guard for protected routes (CH5COMPAC4C-300).
 *
 * Used as the `beforeLoad` of the protected `sidebarLayout` route. It asks the
 * main process for the current auth state and redirects to `/login` when there
 * is no token, so a freshly installed (or signed-out) user can never land on a
 * protected route — enforcement no longer depends on the first failing API call.
 *
 * Outside Electron (the browser-mode staging window, where the `window.elf`
 * preload bridge is absent) there is no token surface to check, so the guard is
 * a no-op and routing proceeds. This matches the browser-mode verification
 * policy in AGENTS.md.
 *
 * The auth-state reader is injected so the guard is unit-testable without a DOM
 * or router harness; the router wires in the real `window.elf.auth.getState`.
 */
export type AuthStateReader = () => Promise<ElfAuthStateDto | null>

/**
 * Resolve the reader against the live `window.elf` bridge, or `null` when the
 * bridge is absent (browser mode / SSR), signalling "do not enforce".
 */
export function resolveAuthStateReader(): AuthStateReader | null {
	if (typeof window === "undefined" || !("elf" in window)) return null
	return () => window.elf.auth.getState()
}

/**
 * Throws a `/login` redirect when the user is not authenticated. A `null`
 * reader (no preload bridge) means "cannot enforce here" and is treated as a
 * pass-through.
 */
export async function requireAuthenticated(reader: AuthStateReader | null): Promise<void> {
	if (!reader) return
	const state = await reader()
	if (!state?.hasToken) {
		throw redirect({ to: "/login" })
	}
}
