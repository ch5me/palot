import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type {
	DockSlotAttachment,
	DockSlotAttachmentId,
	DockZoneId,
	FocusAuthorityOwner,
	StableHostInstance,
	StableHostInstanceId,
	WorkspaceFocusState,
	WorkspaceInstance,
	WorkspaceInstanceId,
	WorkspaceOpenCommand,
	WorkspacePanelDescriptor,
	WorkspacePanelDescriptorId,
	WorkspacePanelInstance,
	WorkspacePanelInstanceId,
} from "../../shared/workspace-contract"
import { FIREFLY_SURFACE_IDS } from "../../shared/firefly-surface-ids"
import { fireflySurfacePreferencesAtom, type LastSidePanelTabId } from "./preferences"

export type SidePanelTabId = LastSidePanelTabId

export const LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID =
	"workspace:session-detail" as WorkspaceInstanceId
export const LEGACY_SIDE_PANEL_HOST_INSTANCE_ID =
	"host:session-side-panel" as StableHostInstanceId

const DEFAULT_DOCK_ZONE_ID: DockZoneId = "side-panel"

function isSidePanelTabId(value: string): value is SidePanelTabId {
	return (FIREFLY_SURFACE_IDS as readonly string[]).includes(value)
}

export function legacyDescriptorIdFromSidePanelTabId(tab: SidePanelTabId): WorkspacePanelDescriptorId {
	return tab
}

export function sidePanelTabIdFromDescriptorId(
	descriptorId: WorkspacePanelDescriptorId,
): SidePanelTabId | null {
	return isSidePanelTabId(descriptorId) ? descriptorId : null
}

export function legacyPanelInstanceIdForDescriptorId(
	descriptorId: WorkspacePanelDescriptorId,
): WorkspacePanelInstanceId {
	return `panel:${descriptorId}`
}

export function legacyAttachmentIdForDescriptorId(
	descriptorId: WorkspacePanelDescriptorId,
): DockSlotAttachmentId {
	return `attachment:${DEFAULT_DOCK_ZONE_ID}:${descriptorId}`
}

export function buildLegacyWorkspacePanelDescriptor(
	descriptorId: WorkspacePanelDescriptorId,
): WorkspacePanelDescriptor {
	return {
		descriptorId,
		defaultZoneId: DEFAULT_DOCK_ZONE_ID,
		hostPolicy: "stable",
		multiplicityPolicy: "singleton",
		focusAuthority: {
			owner: "workspace",
			transferable: true,
		},
	}
}

function buildLegacyWorkspacePanelInstance(
	descriptor: WorkspacePanelDescriptor,
	workspaceInstanceId: WorkspaceInstanceId,
	isOpen: boolean,
): WorkspacePanelInstance {
	return {
		logicalInstanceId: legacyPanelInstanceIdForDescriptorId(descriptor.descriptorId),
		descriptorId: descriptor.descriptorId,
		workspaceInstanceId,
		stableHostId: LEGACY_SIDE_PANEL_HOST_INSTANCE_ID,
		isOpen,
	}
}

function buildLegacyDockSlotAttachment(
	panelInstance: WorkspacePanelInstance,
	zoneId: DockZoneId,
	order: number,
	visible: boolean,
): DockSlotAttachment {
	return {
		attachmentId: legacyAttachmentIdForDescriptorId(panelInstance.descriptorId),
		workspaceInstanceId: panelInstance.workspaceInstanceId,
		stableHostId: panelInstance.stableHostId,
		logicalInstanceId: panelInstance.logicalInstanceId,
		zoneId,
		order,
		visible,
	}
}

function buildLegacyStableHostInstance(
	workspaceInstanceId: WorkspaceInstanceId,
	attachments: DockSlotAttachment[],
	focus: WorkspaceFocusState | null,
): StableHostInstance {
	return {
		stableHostId: LEGACY_SIDE_PANEL_HOST_INSTANCE_ID,
		workspaceInstanceId,
		zoneId: DEFAULT_DOCK_ZONE_ID,
		hostPolicy: "stable",
		attachmentIds: attachments.filter((attachment) => attachment.visible).map((attachment) => attachment.attachmentId),
		activeLogicalInstanceId: focus?.logicalInstanceId ?? null,
	}
}

const sidePanelOpenStorageAtom = atomWithStorage<boolean>("elf:side-panel-open", false)

const activeSidePanelDescriptorIdAtom = atom<WorkspacePanelDescriptorId>(
	(get) => legacyDescriptorIdFromSidePanelTabId(get(fireflySurfacePreferencesAtom).lastSidePanelTab),
)

const setActiveSidePanelDescriptorIdAtom = atom(
	null,
	(get, set, descriptorId: WorkspacePanelDescriptorId) => {
		const tabId = sidePanelTabIdFromDescriptorId(descriptorId)
		if (!tabId) {
			throw new Error(`unknown side-panel descriptor id: ${descriptorId}`)
		}
		set(fireflySurfacePreferencesAtom, {
			...get(fireflySurfacePreferencesAtom),
			lastSidePanelTab: tabId,
		})
	},
)

const availableWorkspaceDescriptorIdsAtom = atom<WorkspacePanelDescriptorId[]>([])
const workspaceFocusSequenceAtom = atom(0)
const workspaceFocusAuthorityAtom = atom<FocusAuthorityOwner | null>(null)

export const workspacePanelDescriptorsAtom = atom<WorkspacePanelDescriptor[]>((get) =>
	get(availableWorkspaceDescriptorIdsAtom).map((descriptorId) =>
		buildLegacyWorkspacePanelDescriptor(descriptorId),
	),
)

export const legacySidePanelWorkspaceInstanceAtom = atom<WorkspaceInstance>((get) => {
	const workspaceInstanceId = LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID
	const descriptors = get(workspacePanelDescriptorsAtom)
	const activeDescriptorId = get(activeSidePanelDescriptorIdAtom)
	const isOpen = get(sidePanelOpenStorageAtom)
	const focusAuthorityOwner = get(workspaceFocusAuthorityAtom)
	const focusSequence = get(workspaceFocusSequenceAtom)

	const panelInstances = descriptors.map((descriptor) =>
		buildLegacyWorkspacePanelInstance(
			descriptor,
			workspaceInstanceId,
			isOpen && descriptor.descriptorId === activeDescriptorId,
		),
	)
	const attachments = panelInstances.map((panelInstance, order) =>
		buildLegacyDockSlotAttachment(
			panelInstance,
			DEFAULT_DOCK_ZONE_ID,
			order,
			panelInstance.isOpen,
		),
	)
	const activePanelInstance = panelInstances.find((panelInstance) => panelInstance.isOpen) ?? null
	const focus: WorkspaceFocusState | null =
		activePanelInstance && focusAuthorityOwner
			? {
				owner: focusAuthorityOwner,
				logicalInstanceId: activePanelInstance.logicalInstanceId,
				sequence: focusSequence,
			}
			: null

	return {
		workspaceInstanceId,
		descriptors,
		panelInstances,
		stableHosts: [buildLegacyStableHostInstance(workspaceInstanceId, attachments, focus)],
		attachments,
		focus,
	}
})

export const workspaceInstancesAtom = atom<Record<WorkspaceInstanceId, WorkspaceInstance>>((get) => ({
	[LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID]: get(legacySidePanelWorkspaceInstanceAtom),
}))

export const openWorkspacePanelAtom = atom(null, (get, set, command: WorkspaceOpenCommand) => {
	if (command.workspaceInstanceId !== LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID) {
		throw new Error(`unsupported workspace instance: ${command.workspaceInstanceId}`)
	}

	const descriptorId =
		command.type === "open-panel-descriptor"
			? command.descriptorId
			: get(legacySidePanelWorkspaceInstanceAtom).panelInstances.find(
				(panelInstance) => panelInstance.logicalInstanceId === command.logicalInstanceId,
			)?.descriptorId

	if (!descriptorId) {
		throw new Error("cannot open workspace panel without a descriptor id")
	}

	set(sidePanelOpenStorageAtom, true)
	set(setActiveSidePanelDescriptorIdAtom, descriptorId)
	set(workspaceFocusAuthorityAtom, command.requestedBy)
	if (command.requestFocus ?? true) {
		set(workspaceFocusSequenceAtom, get(workspaceFocusSequenceAtom) + 1)
	}
})

export const focusWorkspacePanelAtom = atom(
	null,
	(get, set, args: { workspaceInstanceId: WorkspaceInstanceId; logicalInstanceId: WorkspacePanelInstanceId; requestedBy: FocusAuthorityOwner }) => {
		if (args.workspaceInstanceId !== LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID) {
			throw new Error(`unsupported workspace instance: ${args.workspaceInstanceId}`)
		}
		const panelInstance = get(legacySidePanelWorkspaceInstanceAtom).panelInstances.find(
			(candidate) => candidate.logicalInstanceId === args.logicalInstanceId,
		)
		if (!panelInstance) {
			throw new Error(`unknown workspace panel instance: ${args.logicalInstanceId}`)
		}

		set(sidePanelOpenStorageAtom, true)
		set(setActiveSidePanelDescriptorIdAtom, panelInstance.descriptorId)
		set(workspaceFocusAuthorityAtom, args.requestedBy)
		set(workspaceFocusSequenceAtom, get(workspaceFocusSequenceAtom) + 1)
	},
)

export const closeWorkspacePanelAtom = atom(null, (_get, set) => {
	set(sidePanelOpenStorageAtom, false)
	set(workspaceFocusAuthorityAtom, null)
})

export const sidePanelOpenCompatAtom = sidePanelOpenStorageAtom

export const sidePanelActiveTabCompatAtom = atom<SidePanelTabId>((get) => {
	const activeDescriptorId = get(activeSidePanelDescriptorIdAtom)
	const tabId = sidePanelTabIdFromDescriptorId(activeDescriptorId)
	if (!tabId) {
		throw new Error(`active side-panel descriptor is not tab-backed: ${activeDescriptorId}`)
	}
	return tabId
})

export const setSidePanelActiveTabCompatAtom = atom(null, (_get, set, tab: SidePanelTabId) => {
	set(setActiveSidePanelDescriptorIdAtom, legacyDescriptorIdFromSidePanelTabId(tab))
	set(workspaceFocusAuthorityAtom, "compatibility-adapter")
})

export const sidePanelFocusTokenCompatAtom = atom(
	(get) => get(legacySidePanelWorkspaceInstanceAtom).focus?.sequence ?? 0,
)

export const setAvailableSidePanelTabsCompatAtom = atom(null, (get, set, tabs: SidePanelTabId[]) => {
	const descriptorIds = tabs.map((tab) => legacyDescriptorIdFromSidePanelTabId(tab))
	set(availableWorkspaceDescriptorIdsAtom, descriptorIds)

	if (tabs.length === 0) {
		set(closeWorkspacePanelAtom)
		return
	}

	const activeDescriptorId = get(activeSidePanelDescriptorIdAtom)
	if (descriptorIds.includes(activeDescriptorId)) {
		return
	}

	set(setActiveSidePanelDescriptorIdAtom, descriptorIds[0])
	set(workspaceFocusAuthorityAtom, "compatibility-adapter")
	set(workspaceFocusSequenceAtom, get(workspaceFocusSequenceAtom) + 1)
})
