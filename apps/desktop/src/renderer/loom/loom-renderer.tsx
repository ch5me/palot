import { memo } from "react"
import { GenUiBlock } from "../genui/genui-renderer"
import type { LoomNode } from "./use-loom-session"

function LoomRendererImpl({ tree }: { tree: LoomNode | null }) {
	if (!tree) return null
	return <RenderNode node={tree} />
}

function RenderNode({ node }: { node: LoomNode }) {
	return (
		<div data-loom-node-id={node.id}>
			<GenUiBlock name={node.component} props={node.props ?? {}} />
			{node.children?.map((child) => <RenderNode key={child.id} node={child} />)}
		</div>
	)
}

export const LoomRenderer = memo(LoomRendererImpl)
