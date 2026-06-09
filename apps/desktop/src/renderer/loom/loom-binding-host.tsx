import { memo } from "react"
import { buildPluginCatalog } from "../../main/firefly-plugin/catalog"
import { LoomComponentMount } from "../components/loom/component-mount"
import { useLoomContext } from "./loom-context"
import type { LoomNode } from "./use-loom-session"

interface LoomBindingHostProps {
	node: LoomNode
}

function LoomBindingHostImpl({ node }: LoomBindingHostProps) {
	const loom = useLoomContext()
	const projectedComponents = buildPluginCatalog({ appVersion: "0.11.0" }).projections.components
	const projectedComponent = projectedComponents.find((component) => component.contributionId === node.component) ?? null
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
