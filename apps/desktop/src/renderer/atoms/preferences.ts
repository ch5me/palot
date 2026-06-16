import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type { WindowChromeTier } from "../../preload/api"
import {
	DEFAULT_FIREFLY_PROFILE,
	DEFAULT_FIREFLY_PROFILE_ID,
	normalizeFireflyProfileLabel,
	type FireflyProfile,
} from "../lib/profile"
import type { ColorScheme } from "../lib/themes"

// ============================================================
// Types
// ============================================================

export type DisplayMode = "default" | "verbose"

export interface PersistedModelRef {
	providerID: string
	modelID: string
	variant?: string
	agent?: string
}

export type LastSidePanelTabId =
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

export type LastDocumentPanelTabId = "studio" | "pdf-review"

export type LastUtilitySidePanelTabId = Exclude<LastSidePanelTabId, LastDocumentPanelTabId>

export function isLastDocumentPanelTabId(tab: LastSidePanelTabId): tab is LastDocumentPanelTabId {
	return tab === "studio" || tab === "pdf-review"
}

/** Canonical id of the built-in "Palot" workspace — host-rendered, always present. */
export const BUILT_IN_NAV_SIDEBAR_TAB_ID = "built-in"

/**
 * A nav-sidebar (left-rail) workspace id. `"built-in"` is the host's own
 * Palot workspace; every other id is a catalog projected-id contributed
 * by a plugin's `navSidebars` family (e.g. `"firefly.folio.folio"`).
 */
export type NavSidebarTabId = string

export interface FireflySurfacePreferences {
	lastUtilitySidePanelTab: LastUtilitySidePanelTabId
	lastDocumentPanelTab: LastDocumentPanelTabId
	documentPanelOpen: boolean
	lastNavSidebarTab: NavSidebarTabId
}

export interface BrowserPanelState {
	url: string
	profileId: string
	zoom: number
	deviceMode: boolean
}

export interface PinnedFact {
	id: string
	text: string
	createdAt: number
}

export interface FireflyProfilePreferences {
	profiles: FireflyProfile[]
	activeProfileId: string
}

// ============================================================
// One-time localStorage format migration
// ============================================================

function migrateFireflySurfacePreferences(): void {
	if (typeof localStorage === "undefined") return
	const key = "elf:firefly-surface-preferences"
	const raw = localStorage.getItem(key)
	if (!raw) return

	try {
		const parsed = JSON.parse(raw) as Partial<FireflySurfacePreferences> & {
			lastSidePanelTab?: LastSidePanelTabId
		}
		const legacyTab = parsed.lastSidePanelTab
		const migratedDocumentTab =
			(parsed.lastDocumentPanelTab as LastSidePanelTabId | undefined) ?? legacyTab ?? "studio"
		const lastDocumentPanelTab: LastDocumentPanelTabId = isLastDocumentPanelTabId(
			migratedDocumentTab,
		)
			? migratedDocumentTab
			: "studio"
		const migratedUtilityTab =
			(parsed.lastUtilitySidePanelTab as LastSidePanelTabId | undefined) ?? legacyTab ?? "review"
		const lastUtilitySidePanelTab: LastUtilitySidePanelTabId = isLastDocumentPanelTabId(
			migratedUtilityTab,
		)
			? "review"
			: migratedUtilityTab

		const next: FireflySurfacePreferences = {
			lastUtilitySidePanelTab,
			lastDocumentPanelTab,
			// Only preserve documentPanelOpen if the stored value is explicitly
			// true. The legacy format had no documentPanelOpen field, so
			// inferring open=true from the legacyTab caused the Studio / Office
			// panel to auto-appear for any user whose last active tab was a
			// document-lane tab. Default closed; let the user re-open.
			documentPanelOpen:
				typeof parsed.documentPanelOpen === "boolean" ? parsed.documentPanelOpen : false,
			// Legacy "built-in-duplicate" placeholder is gone; map it (and any
			// missing value) back to the always-present built-in workspace. A
			// stored catalog tab id that no longer projects is self-healed by
			// setAvailableNavSidebarTabsAtom at runtime.
			lastNavSidebarTab:
				!parsed.lastNavSidebarTab || parsed.lastNavSidebarTab === "built-in-duplicate"
					? "built-in"
					: parsed.lastNavSidebarTab,
		}

		localStorage.setItem(key, JSON.stringify(next))
	} catch {
		// Ignore malformed data
	}
}
migrateFireflySurfacePreferences()

// ============================================================
// Persisted atoms — each is independent with its own localStorage key
// ============================================================

export const displayModeAtom = atomWithStorage<DisplayMode>("elf:displayMode", "default")

export const themeAtom = atomWithStorage<string>("elf:theme", "default")

export const colorSchemeAtom = atomWithStorage<ColorScheme>("elf:colorScheme", "dark")

/**
 * Whether the user prefers opaque (non-transparent) windows.
 * When true, the renderer uses solid backgrounds instead of semi-transparent.
 */
export const opaqueWindowsAtom = atomWithStorage<boolean>("elf:opaqueWindows", false)

/**
 * The active window chrome tier, set by the main process on load.
 * "liquid-glass" = macOS 26+, "vibrancy" = older macOS, "opaque" = non-macOS or user pref.
 * Defaults to "opaque" for browser-mode dev (no Electron).
 */
export const chromeTierAtom = atom<WindowChromeTier>("opaque")

/**
 * Whether the window has any form of transparency (liquid glass or vibrancy).
 * Used by CSS to decide between semi-transparent and solid backgrounds.
 */
export const isTransparentAtom = atom((get) => {
	const tier = get(chromeTierAtom)
	const opaque = get(opaqueWindowsAtom)
	return !opaque && (tier === "liquid-glass" || tier === "vibrancy")
})

export const draftsAtom = atomWithStorage<Record<string, string>>("elf:drafts", {})

export const projectModelsAtom = atomWithStorage<Record<string, PersistedModelRef>>(
	"elf:projectModels",
	{},
)

/**
 * Whether the user has dismissed the automations permissions info banner.
 * Once dismissed, the banner never reappears.
 */
export const automationsBannerDismissedAtom = atomWithStorage<boolean>(
	"elf:automationsBannerDismissed",
	false,
)

export const fireflySurfacePreferencesAtom = atomWithStorage<FireflySurfacePreferences>(
	"elf:firefly-surface-preferences",
	{
		lastUtilitySidePanelTab: "review",
		lastDocumentPanelTab: "studio",
		documentPanelOpen: false,
		lastNavSidebarTab: "built-in",
	},
)

export const browserPanelStateAtom = atomWithStorage<Record<string, BrowserPanelState>>(
	"elf:browser-panel-state",
	{},
)

export const pinnedFactsAtom = atomWithStorage<Record<string, PinnedFact[]>>(
	"elf:pinnedFacts",
	{},
)

export const pinnedSessionsAtom = atomWithStorage<Record<string, number>>("elf:pinnedSessions", {})

export const fireflyProfilePreferencesAtom = atomWithStorage<FireflyProfilePreferences>(
	"elf:fireflyProfilePreferences",
	{
		profiles: [DEFAULT_FIREFLY_PROFILE],
		activeProfileId: DEFAULT_FIREFLY_PROFILE_ID,
	},
)

export const activeFireflyProfileAtom = atom((get) => {
	const preferences = get(fireflyProfilePreferencesAtom)
	return (
		preferences.profiles.find((profile) => profile.id === preferences.activeProfileId) ??
		preferences.profiles[0] ??
		DEFAULT_FIREFLY_PROFILE
	)
})

export const setActiveFireflyProfileAtom = atom(null, (get, set, profileId: string) => {
	const preferences = get(fireflyProfilePreferencesAtom)
	if (!preferences.profiles.some((profile) => profile.id === profileId)) {
		return
	}
	set(fireflyProfilePreferencesAtom, {
		...preferences,
		activeProfileId: profileId,
	})
})

export const upsertFireflyProfileAtom = atom(null, (get, set, profile: FireflyProfile) => {
	const preferences = get(fireflyProfilePreferencesAtom)
	const existingIndex = preferences.profiles.findIndex((item) => item.id === profile.id)
	const profiles =
		existingIndex >= 0
			? preferences.profiles.map((item, index) => (index === existingIndex ? profile : item))
			: [...preferences.profiles, profile]
	set(fireflyProfilePreferencesAtom, {
		profiles,
		activeProfileId: preferences.activeProfileId,
	})
})

export const createFireflyProfileAtom = atom(null, (get, set, label: string) => {
	const normalizedLabel = normalizeFireflyProfileLabel(label)
	if (!normalizedLabel) {
		return
	}

	const preferences = get(fireflyProfilePreferencesAtom)
	const existing = preferences.profiles.find(
		(profile) => profile.label.toLowerCase() === normalizedLabel.toLowerCase(),
	)
	if (existing) {
		set(fireflyProfilePreferencesAtom, {
			...preferences,
			activeProfileId: existing.id,
		})
		return
	}

	const nextProfile: FireflyProfile = {
		id: crypto.randomUUID(),
		label: normalizedLabel,
		description: `Local-only profile for ${normalizedLabel}`,
	}

	set(fireflyProfilePreferencesAtom, {
		profiles: [...preferences.profiles, nextProfile],
		activeProfileId: nextProfile.id,
	})
})

export type MemoryMode = "local" | "hybrid" | "remote"

export const memoryModeAtom = atomWithStorage<MemoryMode>("elf:memoryMode", "local")

export interface MemoryApiConfig {
	apiBaseUrl: string
	projectId: string
	userId: string
}

export const memoryApiConfigAtom = atomWithStorage<MemoryApiConfig>("elf:memoryApiConfig", {
	apiBaseUrl: "",
	projectId: "",
	userId: "",
})

// ============================================================
// Derived atoms for drafts
// ============================================================

/** Read a draft for a specific key */
export const readDraftAtom = (key: string) => atom((get) => get(draftsAtom)[key] ?? "")

/** Set a draft for a specific key (write-only action atom) */
export const setDraftAtom = atom(null, (get, set, args: { key: string; text: string }) => {
	const drafts = { ...get(draftsAtom) }
	if (args.text) {
		drafts[args.key] = args.text
	} else {
		delete drafts[args.key]
	}
	set(draftsAtom, drafts)
})

/** Clear a draft (write-only action atom) */
export const clearDraftAtom = atom(null, (get, set, key: string) => {
	const drafts = { ...get(draftsAtom) }
	delete drafts[key]
	set(draftsAtom, drafts)
})

/** Set a project model (write-only action atom) */
export const setProjectModelAtom = atom(
	null,
	(
		get,
		set,
		args: {
			directory: string
			model: PersistedModelRef
		},
	) => {
		const models = { ...get(projectModelsAtom) }
		models[args.directory] = {
			providerID: args.model.providerID,
			modelID: args.model.modelID,
			variant: args.model.variant,
			agent: args.model.agent,
		}
		set(projectModelsAtom, models)
	},
)

export const addPinnedFactAtom = atom(
	null,
	(get, set, args: { projectKey: string; text: string }) => {
		const text = args.text.trim()
		if (!text) return

		const factsByProject = { ...get(pinnedFactsAtom) }
		const nextFact: PinnedFact = {
			id: crypto.randomUUID(),
			text,
			createdAt: Date.now(),
		}
		factsByProject[args.projectKey] = [nextFact, ...(factsByProject[args.projectKey] ?? [])]
		set(pinnedFactsAtom, factsByProject)
	},
)

export const setBrowserPanelStateAtom = atom(
	null,
	(get, set, args: { sessionId: string; state: BrowserPanelState }) => {
		const nextState = { ...get(browserPanelStateAtom) }
		nextState[args.sessionId] = args.state
		set(browserPanelStateAtom, nextState)
	},
)

export const removePinnedFactAtom = atom(
	null,
	(get, set, args: { projectKey: string; factId: string }) => {
		const facts = get(pinnedFactsAtom)[args.projectKey] ?? []
		const nextFacts = facts.filter((fact) => fact.id !== args.factId)
		const factsByProject = { ...get(pinnedFactsAtom) }
		if (nextFacts.length === 0) {
			delete factsByProject[args.projectKey]
		} else {
			factsByProject[args.projectKey] = nextFacts
		}
		set(pinnedFactsAtom, factsByProject)
	},
)
