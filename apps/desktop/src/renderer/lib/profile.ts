export interface FireflyProfile {
	id: string
	label: string
	description?: string
}

export function normalizeFireflyProfileLabel(label: string): string {
	return label.trim().replace(/\s+/g, " ").slice(0, 32)
}

export const DEFAULT_FIREFLY_PROFILE_ID = "default"

export const DEFAULT_FIREFLY_PROFILE: FireflyProfile = {
	id: DEFAULT_FIREFLY_PROFILE_ID,
	label: "Default",
	description: "Local profile for this device",
}
