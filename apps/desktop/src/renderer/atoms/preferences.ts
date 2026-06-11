import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type { WindowChromeTier } from "../../preload/api"
import {
	DEFAULT_FIREFLY_MODE,
	DEFAULT_FIREFLY_PROFILE,
	DEFAULT_FIREFLY_PROFILE_ID,
	type FireflyProfile,
	migrateFireflyProfile,
	normalizeFireflyProfileLabel,
} from "../lib/profile"
import type { ColorScheme } from "../lib/themes"
import type { SidePanelTabId } from "./ui"

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

export interface FireflySurfacePreferences {
	lastSidePanelTab: SidePanelTabId
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
// One-time migration from Zustand persist to Jotai atomWithStorage
// ============================================================

function migrateFromZustandPersist(): void {
	if (typeof localStorage === "undefined") return
	const oldKey = "elf-preferences"
	const raw = localStorage.getItem(oldKey)
	if (!raw) return

	try {
		const { state } = JSON.parse(raw) // Zustand persist wraps in { state, version }
		if (state.displayMode)
			localStorage.setItem("elf:displayMode", JSON.stringify(state.displayMode))
		if (state.theme) localStorage.setItem("elf:theme", JSON.stringify(state.theme))
		if (state.colorScheme)
			localStorage.setItem("elf:colorScheme", JSON.stringify(state.colorScheme))
		if (state.drafts) localStorage.setItem("elf:drafts", JSON.stringify(state.drafts))
		if (state.projectModels)
			localStorage.setItem("elf:projectModels", JSON.stringify(state.projectModels))

		// Remove old key after successful migration
		localStorage.removeItem(oldKey)
	} catch {
		// Ignore malformed data
	}
}

// Run migration at module load time (before any atoms are read)
migrateFromZustandPersist()

// Migrate removed "compact" display mode to "default"
function migrateDisplayMode(): void {
	if (typeof localStorage === "undefined") return
	const raw = localStorage.getItem("elf:displayMode")
	if (raw === '"compact"') {
		localStorage.setItem("elf:displayMode", '"default"')
	}
}
migrateDisplayMode()

// Migrate stored Firefly profiles to the mode-aware shape (missing mode → "simple")
function migrateFireflyProfileModes(): void {
	if (typeof localStorage === "undefined") return
	const key = "elf:fireflyProfilePreferences"
	const raw = localStorage.getItem(key)
	if (!raw) return

	try {
		const parsed: unknown = JSON.parse(raw)
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!Array.isArray((parsed as { profiles?: unknown }).profiles)
		) {
			return
		}
		const preferences = parsed as FireflyProfilePreferences
		const profiles = preferences.profiles.map(migrateFireflyProfile)
		if (profiles.some((profile, index) => profile !== preferences.profiles[index])) {
			localStorage.setItem(key, JSON.stringify({ ...preferences, profiles }))
		}
	} catch {
		// Ignore malformed data — atomWithStorage falls back to the default
	}
}
migrateFireflyProfileModes()

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
	{ lastSidePanelTab: "review" },
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
	// migrateFireflyProfile guards against pre-mode profiles written by an
	// older app version after the load-time localStorage migration ran.
	return migrateFireflyProfile(
		preferences.profiles.find((profile) => profile.id === preferences.activeProfileId) ??
			preferences.profiles[0] ??
			DEFAULT_FIREFLY_PROFILE,
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
		mode: DEFAULT_FIREFLY_MODE,
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
