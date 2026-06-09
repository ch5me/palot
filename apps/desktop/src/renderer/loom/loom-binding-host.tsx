import { memo } from "react"
import { resolveGenUiEntry } from "../genui/registry"
import { useLoomContext } from "./loom-context"
import type { LoomNode } from "./use-loom-session"

interface LoomBindingHostProps {
	node: LoomNode
}

function LoomBindingHostImpl({ node }: LoomBindingHostProps) {
	const loom = useLoomContext()
	const entry = resolveGenUiEntry(node.component)
	if (!entry) return null
	const Component = entry.Component as React.ComponentType<Record<string, unknown>>
	const props = { ...(node.props ?? {}) }

	if (entry.name === "decision_card" && loom) {
		props.onSelect = (optionId: string) => {
			loom.sendStateDelta({ nodeId: node.id, field: "selected", value: optionId })
		}
		props.onSubmit = (payload: { optionId: string }) => {
			void loom.sendEvent({ type: "submit", nodeId: node.id, payload })
		}
		props.onNotesChange = (value: string) => {
			loom.sendStateDelta({ nodeId: node.id, field: "notes", value })
		}
	}

	return <Component {...props} />
}

export const LoomBindingHost = memo(LoomBindingHostImpl)
