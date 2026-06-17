import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ch5me/ch5-ui-web";
import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import {
	activeFireflyProfileAtom,
	createFireflyProfileAtom,
	fireflyProfilePreferencesAtom,
	setActiveFireflyProfileAtom,
	upsertFireflyProfileAtom,
} from "../../atoms/preferences"
import {
	FIREFLY_MODE_DESCRIPTIONS,
	FIREFLY_MODES,
	type FireflyMode,
	type FireflyProfile,
	isFireflyMode,
	resolveFireflyMode,
} from "../../lib/profile"
import { SettingsRow } from "./settings-row"
import { SettingsSection } from "./settings-section"

const FIREFLY_MODE_LABELS: Record<FireflyMode, string> = {
	consumer: "Consumer",
	simple: "Simple",
	power: "Power",
	custom: "Custom",
}

function parseVisibleAgents(raw: string): string[] | undefined {
	const names = raw
		.split(",")
		.map((name) => name.trim())
		.filter((name) => name.length > 0)
	return names.length > 0 ? names : undefined
}

function ProfileModeRow({ profile }: { profile: FireflyProfile }) {
	const upsertProfile = useSetAtom(upsertFireflyProfileAtom)
	const mode = resolveFireflyMode(profile)
	const [visibleAgentsDraft, setVisibleAgentsDraft] = useState(
		(profile.visibleAgents ?? []).join(", "),
	)

	return (
		<SettingsRow label={profile.label} description={FIREFLY_MODE_DESCRIPTIONS[mode]}>
			<div className="flex flex-col items-end gap-2">
				<Select
					value={mode}
					onValueChange={(value) => {
						if (isFireflyMode(value)) {
							upsertProfile({ ...profile, mode: value })
						}
					}}
					items={FIREFLY_MODE_LABELS}
				>
					<SelectTrigger className="h-9 w-44">
						<SelectValue />
					</SelectTrigger>
					<SelectContent align="end" alignItemWithTrigger={false}>
						{FIREFLY_MODES.map((option) => (
							<SelectItem key={option} value={option}>
								<div className="flex flex-col items-start">
									<span>{FIREFLY_MODE_LABELS[option]}</span>
									<span className="text-xs text-muted-foreground">
										{FIREFLY_MODE_DESCRIPTIONS[option]}
									</span>
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{mode === "custom" && (
					<Input
						value={visibleAgentsDraft}
						onChange={(event) => setVisibleAgentsDraft(event.target.value)}
						onBlur={() =>
							upsertProfile({ ...profile, visibleAgents: parseVisibleAgents(visibleAgentsDraft) })
						}
						placeholder="Visible agents (comma-separated, empty = all)"
						className="h-9 w-72"
					/>
				)}
			</div>
		</SettingsRow>
	)
}

export function ProfileSettings() {
	const preferences = useAtomValue(fireflyProfilePreferencesAtom)
	const activeProfile = useAtomValue(activeFireflyProfileAtom)
	const setActiveProfile = useSetAtom(setActiveFireflyProfileAtom)
	const createProfile = useSetAtom(createFireflyProfileAtom)
	const [nextProfileLabel, setNextProfileLabel] = useState("")

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-xl font-semibold">Profiles</h2>
			</div>

			<SettingsSection
				title="Account context"
				description="Profiles are local-only for now. They persist on this device and are not synced through OpenCode or any remote service."
			>
				<SettingsRow
					label="Active profile"
					description={activeProfile.description ?? "Local profile for this device"}
				>
					<div className="flex flex-wrap justify-end gap-2">
						{preferences.profiles.map((profile) => (
							<Button
								key={profile.id}
								type="button"
								variant={profile.id === activeProfile.id ? "default" : "outline"}
								size="sm"
								onClick={() => setActiveProfile(profile.id)}
							>
								{profile.label}
							</Button>
						))}
					</div>
				</SettingsRow>
				<SettingsRow
					label="Create local profile"
					description="Adds another device-local account context label for browser/session preference work."
				>
					<form
						className="flex items-center gap-2"
						onSubmit={(event) => {
							event.preventDefault()
							createProfile(nextProfileLabel)
							setNextProfileLabel("")
						}}
					>
						<Input
							value={nextProfileLabel}
							onChange={(event) => setNextProfileLabel(event.target.value)}
							placeholder="work, personal, staging"
							className="h-9 w-44"
						/>
						<Button type="submit" size="sm" variant="outline">
							Add
						</Button>
					</form>
				</SettingsRow>
			</SettingsSection>

			<SettingsSection
				title="Mode presets"
				description="Each profile has a mode that controls how much of the agent/model machinery the chat composer reveals. Modes only change what is shown — every mode talks to the same agents."
			>
				{preferences.profiles.map((profile) => (
					<ProfileModeRow key={profile.id} profile={profile} />
				))}
			</SettingsSection>
		</div>
	)
}
