import { memo } from "react"
import type { LoomNode } from "./use-loom-session"
import { LoomBindingHost } from "./loom-binding-host"

function LoomRendererImpl({ tree }: { tree: LoomNode | null }) {
	if (!tree) return null
	return <RenderNode node={tree} />
}

function RenderNode({ node }: { node: LoomNode }) {
	return (
		<div data-loom-node-id={node.id}>
			<LoomBindingHost node={node} />
			{node.children?.map((child) => <RenderNode key={child.id} node={child} />)}
		</div>
	)
}

export const LoomRenderer = memo(LoomRendererImpl)
