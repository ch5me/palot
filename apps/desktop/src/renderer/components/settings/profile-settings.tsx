import { Button } from "@ch5me/elf-ui/components/button"
import { Input } from "@ch5me/elf-ui/components/input"
import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import {
	activeFireflyProfileAtom,
	createFireflyProfileAtom,
	fireflyProfilePreferencesAtom,
	setActiveFireflyProfileAtom,
} from "../../atoms/preferences"
import { SettingsRow } from "./settings-row"
import { SettingsSection } from "./settings-section"

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
		</div>
	)
}
