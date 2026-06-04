import { Button } from "@ch5me/elf-ui/components/button"
import { useAtomValue, useSetAtom } from "jotai"
import { activeFireflyProfileAtom, fireflyProfilePreferencesAtom, setActiveFireflyProfileAtom } from "../../atoms/preferences"
import { SettingsRow } from "./settings-row"
import { SettingsSection } from "./settings-section"

export function ProfileSettings() {
	const preferences = useAtomValue(fireflyProfilePreferencesAtom)
	const activeProfile = useAtomValue(activeFireflyProfileAtom)
	const setActiveProfile = useSetAtom(setActiveFireflyProfileAtom)

	return (
		<SettingsSection
			title="Profiles"
			description="Profiles are local-only for now. They preserve a future seam for switching workspace preferences and account context per device."
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
		</SettingsSection>
	)
}
