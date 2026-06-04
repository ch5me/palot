import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { paneBusFamily, paneBusScopeKey, type PaneBusRecord, type PaneBusScope } from "../atoms/pane-bus"

export function usePaneBus(scope: PaneBusScope): PaneBusRecord | null {
	const scopeKey = useMemo(() => paneBusScopeKey(scope), [scope])
	return useAtomValue(paneBusFamily(scopeKey))
}
