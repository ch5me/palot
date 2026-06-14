import type { HostPanelSlot } from "./firefly-plugin/descriptor"

export const WORKSPACE_HOST_POLICIES = ["stable", "remount-ok"] as const
export type WorkspaceHostPolicy = (typeof WORKSPACE_HOST_POLICIES)[number]

export const WORKSPACE_MULTIPLICITY_POLICIES = ["singleton", "multi-instance"] as const
export type WorkspaceMultiplicityPolicy = (typeof WORKSPACE_MULTIPLICITY_POLICIES)[number]

export const FOCUS_AUTHORITY_OWNERS = ["workspace", "stable-host", "compatibility-adapter"] as const
export type FocusAuthorityOwner = (typeof FOCUS_AUTHORITY_OWNERS)[number]

export const DOCK_ZONE_IDS = ["side-panel", "main-pane"] as const satisfies readonly HostPanelSlot[]
export type DockZoneId = (typeof DOCK_ZONE_IDS)[number]

export type WorkspacePanelDescriptorId = string
export type WorkspacePanelInstanceId = string
export type StableHostInstanceId = string
export type WorkspaceInstanceId = string
export type DockSlotAttachmentId = string

export interface WorkspaceFocusAuthorityPolicy {
	owner: FocusAuthorityOwner
	transferable: boolean
}

export interface WorkspacePanelDescriptor {
	descriptorId: WorkspacePanelDescriptorId
	defaultZoneId: DockZoneId
	hostPolicy: WorkspaceHostPolicy
	multiplicityPolicy: WorkspaceMultiplicityPolicy
	focusAuthority: WorkspaceFocusAuthorityPolicy
}

export interface WorkspacePanelInstance {
	logicalInstanceId: WorkspacePanelInstanceId
	descriptorId: WorkspacePanelDescriptorId
	workspaceInstanceId: WorkspaceInstanceId
	stableHostId: StableHostInstanceId
	isOpen: boolean
}

export interface StableHostInstance {
	stableHostId: StableHostInstanceId
	workspaceInstanceId: WorkspaceInstanceId
	zoneId: DockZoneId
	hostPolicy: WorkspaceHostPolicy
	attachmentIds: DockSlotAttachmentId[]
	activeLogicalInstanceId: WorkspacePanelInstanceId | null
}

export interface DockSlotAttachment {
	attachmentId: DockSlotAttachmentId
	workspaceInstanceId: WorkspaceInstanceId
	stableHostId: StableHostInstanceId
	logicalInstanceId: WorkspacePanelInstanceId
	zoneId: DockZoneId
	order: number
	visible: boolean
}

export interface WorkspaceFocusState {
	owner: FocusAuthorityOwner
	logicalInstanceId: WorkspacePanelInstanceId
	sequence: number
}

export interface WorkspaceInstance {
	workspaceInstanceId: WorkspaceInstanceId
	descriptors: WorkspacePanelDescriptor[]
	panelInstances: WorkspacePanelInstance[]
	stableHosts: StableHostInstance[]
	attachments: DockSlotAttachment[]
	focus: WorkspaceFocusState | null
}

export interface WorkspacePlacementCommand {
	type: "place-panel-instance"
	workspaceInstanceId: WorkspaceInstanceId
	logicalInstanceId: WorkspacePanelInstanceId
	stableHostId: StableHostInstanceId
	attachmentId: DockSlotAttachmentId
	zoneId: DockZoneId
	order?: number
	requestedBy: FocusAuthorityOwner
}

export interface WorkspaceOpenDescriptorCommand {
	type: "open-panel-descriptor"
	workspaceInstanceId: WorkspaceInstanceId
	descriptorId: WorkspacePanelDescriptorId
	logicalInstanceId?: WorkspacePanelInstanceId
	stableHostId?: StableHostInstanceId
	zoneId?: DockZoneId
	requestFocus?: boolean
	requestedBy: FocusAuthorityOwner
}

export interface WorkspaceOpenInstanceCommand {
	type: "open-panel-instance"
	workspaceInstanceId: WorkspaceInstanceId
	logicalInstanceId: WorkspacePanelInstanceId
	requestFocus?: boolean
	requestedBy: FocusAuthorityOwner
}

export interface WorkspaceFocusCommand {
	type: "focus-panel-instance"
	workspaceInstanceId: WorkspaceInstanceId
	logicalInstanceId: WorkspacePanelInstanceId
	requestedBy: FocusAuthorityOwner
}

export type WorkspaceOpenCommand = WorkspaceOpenDescriptorCommand | WorkspaceOpenInstanceCommand
