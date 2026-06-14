import { atom } from "jotai"
import { atomFamily, atomWithStorage } from "jotai/utils"
import { fireflySurfacePreferencesAtom, type NavSidebarTabId } from "./preferences"
import type { FileDiff, FireflySurfaceTarget } from "../lib/types"
import {
	closeWorkspacePanelAtom,
	focusWorkspacePanelAtom,
	legacyDescriptorIdFromSidePanelTabId,
	LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID,
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
	set(openWorkspacePanelAtom, {
		type: "open-panel-descriptor",
		workspaceInstanceId: LEGACY_SIDE_PANEL_WORKSPACE_INSTANCE_ID,
		descriptorId: legacyDescriptorIdFromSidePanelTabId(tab),
		requestFocus: true,
		requestedBy: "compatibility-adapter",
	})
})

export const openFireflySurfaceTargetAtom = atom(null, (_get, set, target: FireflySurfaceTarget) => {
	if (target.kind === "side-panel") {
		set(openSidePanelTabAtom, target.tab)
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
	if (target.kind === "side-panel") {
		set(openSidePanelTabAtom, target.tab)
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
