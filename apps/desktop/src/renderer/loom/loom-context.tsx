import { createContext, useContext } from "react"
import { useLoomSession } from "./use-loom-session"

const LoomSessionContext = createContext<ReturnType<typeof useLoomSession> | null>(null)

export function LoomContextProvider({
	sessionId,
	children,
}: {
	sessionId: string | null
	children: React.ReactNode
}) {
	const value = useLoomSession({ sessionId })
	return <LoomSessionContext.Provider value={value}>{children}</LoomSessionContext.Provider>
}

export function useLoomContext() {
	return useContext(LoomSessionContext)
}
