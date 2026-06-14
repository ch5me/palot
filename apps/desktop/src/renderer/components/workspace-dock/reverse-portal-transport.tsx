import {
	createHtmlPortalNode,
	HtmlPortalNode,
	InPortal,
	OutPortal,
} from "react-reverse-portal"
import type { PropsWithChildren } from "react"
import type {
	StablePanelAttachmentTarget,
	StablePanelHostId,
	StablePanelSize,
	SurfaceTransport,
	SurfaceTransportHandle,
} from "./stable-panel-host-runtime"

export interface ReversePortalTransportHandle extends SurfaceTransportHandle {
	portalNode: HtmlPortalNode
	currentAttachmentId: string | null
	lastKnownSize: StablePanelSize | null
}

export function createReversePortalTransport(): SurfaceTransport<ReversePortalTransportHandle> {
	return {
		kind: "reverse-portal",
		createHost: (hostId: StablePanelHostId) => ({
			hostId,
			portalNode: createHtmlPortalNode({
				attributes: {
					"data-stable-host-id": hostId,
				},
			}),
			currentAttachmentId: null,
			lastKnownSize: null,
		}),
		attachHost: (handle: ReversePortalTransportHandle, target: StablePanelAttachmentTarget) => {
			handle.currentAttachmentId = target.attachmentId
		},
		detachHost: (handle: ReversePortalTransportHandle) => {
			handle.currentAttachmentId = null
		},
		resizeHost: (handle: ReversePortalTransportHandle, size: StablePanelSize) => {
			handle.lastKnownSize = { ...size }
		},
	}
}

export function StablePanelHostInPortal({
	handle,
	children,
}: PropsWithChildren<{ handle: ReversePortalTransportHandle }>) {
	return <InPortal node={handle.portalNode}>{children}</InPortal>
}

export function StablePanelHostAttachmentOutlet({
	handle,
	attachmentId,
}: {
	handle: ReversePortalTransportHandle
	attachmentId: string
}) {
	if (handle.currentAttachmentId !== attachmentId) {
		return null
	}

	return <OutPortal node={handle.portalNode} />
}
