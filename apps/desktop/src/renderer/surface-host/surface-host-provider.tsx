import { createContext, type ReactNode, useContext, useState } from "react"
import { SurfaceRegistry } from "./registry"
import { ReversePortalTransport } from "./transport-reverse-portal"

const SurfaceHostContext = createContext<SurfaceRegistry | null>(null)

/**
 * Provides the app-owned {@link SurfaceRegistry} (backed by a
 * {@link ReversePortalTransport}). Mount near the app root, above both the
 * hidden host layer and the dock shell. The registry + transport are created
 * once via lazy `useState` initializers so the identity survives re-renders and
 * StrictMode double-invokes do not produce two registries.
 */
export function SurfaceHostProvider({ children }: { children: ReactNode }) {
	const [registry] = useState(() => new SurfaceRegistry(new ReversePortalTransport()))
	return <SurfaceHostContext.Provider value={registry}>{children}</SurfaceHostContext.Provider>
}

/** Access the surface registry. Throws if used outside {@link SurfaceHostProvider}. */
export function useSurfaceRegistry(): SurfaceRegistry {
	const registry = useContext(SurfaceHostContext)
	if (!registry) {
		throw new Error("useSurfaceRegistry must be used within a SurfaceHostProvider")
	}
	return registry
}
