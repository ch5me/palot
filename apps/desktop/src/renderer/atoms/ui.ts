import { atom } from "jotai"
import { atomFamily, atomWithStorage } from "jotai/utils"
import { DOCUMENT_SURFACE_IDS, isDocumentSurfaceId } from "../../shared/firefly-surface-ids"
import {
	fireflySurfacePreferencesAtom,
	type LastDocumentPanelTabId,
	type LastSidePanelTabId,
	type LastUtilitySidePanelTabId,
	type NavSidebarTabId,
} from "./preferences"
import type { FileDiff } from "../lib/types"

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

export type SidePanelTabId = LastSidePanelTabId

export const NAV_SIDEBAR_TABS = ["built-in", "built-in-duplicate"] as const satisfies readonly NavSidebarTabId[]

export interface SidePanelRoute {
	tab: SidePanelTabId
	focusToken: number
}

export interface DocumentPanelRoute {
	tab: DocumentPanelTabId
	focusToken: number
}

export interface PaneRoutingState {
	sidePanel: SidePanelRoute | null
	documentPanel: DocumentPanelRoute | null
}

// `:v2` retires the stale `false` values the old force-close behavior persisted
// whenever utility surfaces were briefly empty during load — those would stick
// the right dock collapsed. Bumping the key resets everyone to open-by-default;
// the user's own toggle then persists under the new key.
export const sidePanelOpenAtom = atomWithStorage<boolean>("elf:side-panel-open:v2", true)

export type DocumentPanelTabId = LastDocumentPanelTabId
export type UtilitySidePanelTabId = LastUtilitySidePanelTabId

export const DOCUMENT_PANEL_TABS = DOCUMENT_SURFACE_IDS as readonly DocumentPanelTabId[]

export const isDocumentPanelTab = (value: SidePanelTabId): value is DocumentPanelTabId =>
	isDocumentSurfaceId(value)

// Utility and document lanes persist independently so restore/fallback stays
// deterministic when a session switches or a doc surface becomes unavailable.

export const sidePanelActiveTabAtom = atom<LastUtilitySidePanelTabId>(
	(get) => get(fireflySurfacePreferencesAtom).lastUtilitySidePanelTab,
)

export const setSidePanelActiveTabAtom = atom(null, (get, set, tab: LastUtilitySidePanelTabId) => {
	set(fireflySurfacePreferencesAtom, {
		...get(fireflySurfacePreferencesAtom),
		lastUtilitySidePanelTab: tab,
	})
})

export const documentPanelOpenAtom = atom((get) => get(fireflySurfacePreferencesAtom).documentPanelOpen)

export const setDocumentPanelOpenAtom = atom(null, (get, set, open: boolean) => {
	set(fireflySurfacePreferencesAtom, {
		...get(fireflySurfacePreferencesAtom),
		documentPanelOpen: open,
	})
})

export const documentPanelActiveTabAtom = atom<DocumentPanelTabId>(
	(get) => get(fireflySurfacePreferencesAtom).lastDocumentPanelTab,
)

export const setDocumentPanelActiveTabAtom = atom(null, (get, set, tab: DocumentPanelTabId) => {
	set(fireflySurfacePreferencesAtom, {
		...get(fireflySurfacePreferencesAtom),
		lastDocumentPanelTab: tab,
		documentPanelOpen: true,
	})
})

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

export const sidePanelFocusTokenAtom = atom(0)
export const documentPanelFocusTokenAtom = atom(0)

export const paneRoutingStateAtom = atom<PaneRoutingState>((get) => ({
	sidePanel: get(sidePanelOpenAtom)
		? {
			tab: get(sidePanelActiveTabAtom),
			focusToken: get(sidePanelFocusTokenAtom)
		}
		: null,
	documentPanel: get(documentPanelOpenAtom)
		? {
			tab: get(documentPanelActiveTabAtom),
			focusToken: get(documentPanelFocusTokenAtom),
		}
		: null,
}))

export const openSidePanelTabAtom = atom(null, (get, set, tab: SidePanelTabId) => {
	if (isDocumentPanelTab(tab)) {
		set(setDocumentPanelActiveTabAtom, tab)
		set(documentPanelFocusTokenAtom, get(documentPanelFocusTokenAtom) + 1)
		return
	}
	set(sidePanelOpenAtom, true)
	set(setSidePanelActiveTabAtom, tab)
	set(sidePanelFocusTokenAtom, get(sidePanelFocusTokenAtom) + 1)
})

export const closeSidePanelAtom = atom(null, (_get, set) => {
	set(sidePanelOpenAtom, false)
})

export const closeDocumentPanelAtom = atom(null, (_get, set) => {
	set(setDocumentPanelOpenAtom, false)
})

export const setAvailableSidePanelTabsAtom = atom(
	null,
	(get, set, tabs: UtilitySidePanelTabId[]) => {
		const utilityTabs = tabs.filter((tab): tab is UtilitySidePanelTabId => !isDocumentPanelTab(tab))
		if (utilityTabs.length === 0) {
			// No utility surfaces yet. Do NOT persist `false` here: the right dock
			// zone already self-gates closed via `sidePanelOpen && utilityTabs.length
			// > 0`, and writing false would stick the pane closed after surfaces
			// finish loading (defeating open-by-default).
			return
		}

		const activeTab = get(sidePanelActiveTabAtom) as UtilitySidePanelTabId
		if (utilityTabs.includes(activeTab)) {
			return
		}

		set(setSidePanelActiveTabAtom, utilityTabs[0])
		set(sidePanelFocusTokenAtom, get(sidePanelFocusTokenAtom) + 1)
	},
)

export const setAvailableDocumentPanelTabsAtom = atom(
	null,
	(get, set, tabs: DocumentPanelTabId[]) => {
		if (tabs.length === 0) {
			set(setDocumentPanelOpenAtom, false)
			return
		}

		const activeTab = get(documentPanelActiveTabAtom)
		if (tabs.includes(activeTab)) {
			return
		}

		// Only update the stored tab preference — do NOT open the panel. The
		// panel was not open before this fallback, so forcing it open here is
		// what caused the Studio / Office panel to auto-appear on session load.
		// If the panel IS already open, keep it open (open state is unchanged).
		set(fireflySurfacePreferencesAtom, {
			...get(fireflySurfacePreferencesAtom),
			lastDocumentPanelTab: tabs[0],
		})
		set(documentPanelFocusTokenAtom, get(documentPanelFocusTokenAtom) + 1)
	},
)

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
