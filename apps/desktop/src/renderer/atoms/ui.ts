import { atom } from "jotai"
import { atomFamily, atomWithStorage } from "jotai/utils"
import { fireflySurfacePreferencesAtom } from "./preferences"
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

export type SidePanelTabId =
	| "review"
	| "browser"
	| "notes"
	| "pulse"
	| "memory"
	| "files"
	| "terminal"
	| "editor"
	| "plugins"
	| "bridges"
	| "crm"
	| "studio"
	| "voice"
	| "oracle"
	| "claude"
	| "ch5pm"
	| "artifacts"
	| "pdf-review"

export interface SidePanelRoute {
	tab: SidePanelTabId
	focusToken: number
}

export interface PaneRoutingState {
	sidePanel: SidePanelRoute | null
}

export const sidePanelOpenAtom = atomWithStorage<boolean>("elf:side-panel-open", false)

export const sidePanelActiveTabAtom = atom<SidePanelTabId>((get) => get(fireflySurfacePreferencesAtom).lastSidePanelTab)

export const setSidePanelActiveTabAtom = atom(null, (get, set, tab: SidePanelTabId) => {
	set(fireflySurfacePreferencesAtom, {
		...get(fireflySurfacePreferencesAtom),
		lastSidePanelTab: tab,
	})
})

export const sidePanelFocusTokenAtom = atom(0)

export const paneRoutingStateAtom = atom<PaneRoutingState>((get) => ({
	sidePanel: get(sidePanelOpenAtom)
		? {
			tab: get(sidePanelActiveTabAtom),
			focusToken: get(sidePanelFocusTokenAtom)
		}
		: null,
}))

export const openSidePanelTabAtom = atom(null, (get, set, tab: SidePanelTabId) => {
	set(sidePanelOpenAtom, true)
	set(setSidePanelActiveTabAtom, tab)
	set(sidePanelFocusTokenAtom, get(sidePanelFocusTokenAtom) + 1)
})

export const closeSidePanelAtom = atom(null, (_get, set) => {
	set(sidePanelOpenAtom, false)
})

export const setAvailableSidePanelTabsAtom = atom(null, (get, set, tabs: SidePanelTabId[]) => {
	if (tabs.length === 0) {
		set(sidePanelOpenAtom, false)
		return
	}

	const activeTab = get(sidePanelActiveTabAtom)
	if (tabs.includes(activeTab)) {
		return
	}

	set(setSidePanelActiveTabAtom, tabs[0])
	set(sidePanelFocusTokenAtom, get(sidePanelFocusTokenAtom) + 1)
})

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
