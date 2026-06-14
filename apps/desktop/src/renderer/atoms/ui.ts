import { atom } from "jotai"
import { atomFamily, atomWithStorage } from "jotai/utils"
import { fireflySurfacePreferencesAtom, type NavSidebarTabId } from "./preferences"
import type { FileDiff, FireflyLogicalPanelAction, FireflySurfaceTarget } from "../lib/types"
import {
	closeWorkspacePanelAtom,
	focusWorkspacePanelAtom,
	legacyDescriptorIdFromSidePanelTabId,
	legacySidePanelWorkspaceInstanceAtom,
	LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID,
	legacyPanelInstanceIdForDescriptorId,
	openWorkspacePanelAtom,
	sidePanelActiveTabCompatAtom,
	sidePanelFocusTokenCompatAtom,
	sidePanelOpenCompatAtom,
	type SidePanelTabId,
	setAvailableSidePanelTabsCompatAtom,
	setSidePanelActiveTabCompatAtom,
} from "./workspace"

export const commandPaletteOpenAtom = atom(false)

export const leftPanelOpenAtom = atom(true)

export type SidebarSectionId = "active" | "pinned" | "recent" | "pm" | "projects"

export const sidebarSectionOpenAtom = atomWithStorage<Record<SidebarSectionId, boolean>>(
	"elf:sidebar-sections",
	{
		active: true,
		pinned: true,
		recent: true,
		pm: true,
		projects: true,
	},
)

export const viewedSessionIdAtom = atom<string | null>(null)

export const NAV_SIDEBAR_TABS = ["built-in", "built-in-duplicate"] as const satisfies readonly NavSidebarTabId[]

export interface SidePanelRoute {
	tab: SidePanelTabId
	focusToken: number
}

export interface PaneRoutingState {
	sidePanel: SidePanelRoute | null
}

export interface LogicalPanelRouteRequest {
	logicalPanelId: string
	preferredZoneId: "side-panel" | "main-pane"
	action: FireflyLogicalPanelAction
	focusAuthorityOwner: "workspace" | "stable-host" | "compatibility-adapter"
	legacySidePanelTabId?: SidePanelTabId
	allowCreate?: boolean
	requestedBy?: string
}

export const sidePanelOpenAtom = sidePanelOpenCompatAtom

export const sidePanelActiveTabAtom = sidePanelActiveTabCompatAtom

export const setSidePanelActiveTabAtom = setSidePanelActiveTabCompatAtom

export const navSidebarActiveTabAtom = atom<NavSidebarTabId>(
	(get) => get(fireflySurfacePreferencesAtom).lastNavSidebarTab,
)

export const setNavSidebarActiveTabAtom = atom(null, (get, set, tab: NavSidebarTabId) => {
	set(fireflySurfacePreferencesAtom, {
		...get(fireflySurfacePreferencesAtom),
		lastNavSidebarTab: tab,
	})
})

export const setAvailableNavSidebarTabsAtom = atom(null, (get, set, tabs: NavSidebarTabId[]) => {
	if (tabs.length === 0) {
		return
	}

	const activeTab = get(navSidebarActiveTabAtom)
	if (tabs.includes(activeTab)) {
		return
	}

	set(setNavSidebarActiveTabAtom, tabs[0])
})

export const sidePanelFocusTokenAtom = sidePanelFocusTokenCompatAtom

export const paneRoutingStateAtom = atom<PaneRoutingState>((get) => ({
	sidePanel: get(sidePanelOpenAtom)
		? {
			tab: get(sidePanelActiveTabAtom),
			focusToken: get(sidePanelFocusTokenAtom),
		}
		: null,
}))

export const openSidePanelTabAtom = atom(null, (_get, set, tab: SidePanelTabId) => {
	set(routeLogicalPanelAtom, {
		logicalPanelId: legacyDescriptorIdFromSidePanelTabId(tab),
		preferredZoneId: "side-panel",
		action: "reveal-preferred-zone",
		focusAuthorityOwner: "compatibility-adapter",
		legacySidePanelTabId: tab,
		allowCreate: true,
		requestedBy: "compatibility-adapter",
	})
})

export const routeLogicalPanelAtom = atom(null, (get, set, request: LogicalPanelRouteRequest) => {
	const descriptorId = request.logicalPanelId
	const panelInstances = get(legacySidePanelWorkspaceInstanceAtom).panelInstances
	const existing = panelInstances.find((panel) => panel.descriptorId === descriptorId)

	if (request.action === "focus-existing") {
		if (!existing) {
			throw new Error(`cannot focus missing logical panel: ${descriptorId}`)
		}
		set(focusWorkspacePanelAtom, {
			workspaceInstanceId: LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID,
			logicalInstanceId: existing.logicalInstanceId,
			requestedBy: request.focusAuthorityOwner,
		})
		return
	}

	if (request.action === "create-if-allowed" && !request.allowCreate && existing) {
		set(focusWorkspacePanelAtom, {
			workspaceInstanceId: LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID,
			logicalInstanceId: existing.logicalInstanceId,
			requestedBy: request.focusAuthorityOwner,
		})
		return
	}

	if (existing) {
		const command = {
			type: "open-panel-instance",
			workspaceInstanceId: LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID,
			logicalInstanceId: existing.logicalInstanceId,
			requestFocus: true,
			requestedBy: request.focusAuthorityOwner,
		} as const
		set(openWorkspacePanelAtom, command)
		return
	}

	const command = {
		type: "open-panel-descriptor",
		workspaceInstanceId: LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID,
		descriptorId,
		logicalInstanceId: legacyPanelInstanceIdForDescriptorId(descriptorId),
		zoneId: request.preferredZoneId,
		requestFocus: true,
		requestedBy: request.focusAuthorityOwner,
	} as const
	set(openWorkspacePanelAtom, command)
})

export const openFireflySurfaceTargetAtom = atom(null, (_get, set, target: FireflySurfaceTarget) => {
	if (target.kind === "logical-panel") {
		set(routeLogicalPanelAtom, {
			logicalPanelId: target.logicalPanelId,
			preferredZoneId: target.preferredZoneId,
			action: target.action,
			focusAuthorityOwner: target.focusAuthorityOwner,
			legacySidePanelTabId: target.legacySidePanelTabId,
			allowCreate: target.action === "create-if-allowed",
			requestedBy: target.focusAuthorityOwner,
		})
		return
	}

	set(openWorkspacePanelAtom, {
		type: "open-panel-descriptor",
		workspaceInstanceId: LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID,
		descriptorId: target.descriptorId,
		zoneId: target.zoneId,
		requestFocus: true,
		requestedBy: target.focusAuthorityOwner,
	})
})

export const focusFireflySurfaceTargetAtom = atom(null, (_get, set, target: FireflySurfaceTarget) => {
	if (target.kind === "logical-panel") {
		set(routeLogicalPanelAtom, {
			logicalPanelId: target.logicalPanelId,
			preferredZoneId: target.preferredZoneId,
			action: "focus-existing",
			focusAuthorityOwner: target.focusAuthorityOwner,
			legacySidePanelTabId: target.legacySidePanelTabId,
			allowCreate: false,
			requestedBy: target.focusAuthorityOwner,
		})
		return
	}

	set(focusWorkspacePanelAtom, {
		workspaceInstanceId: LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID,
		logicalInstanceId: `panel:${target.descriptorId}`,
		requestedBy: target.focusAuthorityOwner,
	})
})

export const closeSidePanelAtom = closeWorkspacePanelAtom

export const setAvailableSidePanelTabsAtom = setAvailableSidePanelTabsCompatAtom

export const reviewPanelOpenAtom = sidePanelOpenAtom

export const reviewPanelSelectedFileAtom = atom<string | null>(null)

export const viewFileInDiffPanelAtom = atom(null, (_get, set, filePath: string) => {
	set(openSidePanelTabAtom, "review")
	set(reviewPanelSelectedFileAtom, filePath)
})

export type DiffStyle = "unified" | "split"

export interface ReviewPanelSettings {
	diffStyle: DiffStyle
	expanded: boolean
}

export const reviewPanelSettingsAtom = atomWithStorage<ReviewPanelSettings>(
	"elf:review-panel-settings",
	{ diffStyle: "unified", expanded: false },
)

export const sessionDiffFamily = atomFamily((_sessionId: string) => atom<FileDiff[]>([]))

export const setSessionDiffAtom = atom(
	null,
	(_get, set, args: { sessionId: string; diffs: FileDiff[] }) => {
		set(sessionDiffFamily(args.sessionId), args.diffs)
	},
)

export const diffFilterFamily = atomFamily((_sessionId: string) => atom<string | null>(null))

export const sessionDiffStatsFamily = atomFamily((sessionId: string) =>
	atom((get) => {
		const diffs = get(sessionDiffFamily(sessionId))
		let additions = 0
		let deletions = 0
		for (const diff of diffs) {
			additions += diff.additions
			deletions += diff.deletions
		}
		return { additions, deletions, fileCount: diffs.length }
	}),
)
