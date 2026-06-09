import { memo } from "react"
import { useFireflyPluginComponents } from "../hooks/use-firefly-plugins"
import { LoomComponentMount } from "../components/loom/component-mount"
import { useLoomContext } from "./loom-context"
import type { LoomNode } from "./use-loom-session"

interface LoomBindingHostProps {
	node: LoomNode
}

function LoomBindingHostImpl({ node }: LoomBindingHostProps) {
	const loom = useLoomContext()
	const projectedComponents = useFireflyPluginComponents().data?.components ?? []
	const projectedComponent = projectedComponents.find((component) => component.id === node.component) ?? null
	const props = { ...(node.props ?? {}) }

	if (node.component === "decision_card" && loom) {
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

	return <LoomComponentMount componentId={node.component} props={props} projectedComponent={projectedComponent} />
}

export const LoomBindingHost = memo(LoomBindingHostImpl)
