import {
	VoiceSelector,
	VoiceSelectorAccent,
	VoiceSelectorAge,
	VoiceSelectorAttributes,
	VoiceSelectorBullet,
	VoiceSelectorContent,
	VoiceSelectorDescription,
	VoiceSelectorGender,
	VoiceSelectorGroup,
	VoiceSelectorInput,
	VoiceSelectorItem,
	VoiceSelectorList,
	VoiceSelectorName,
	VoiceSelectorPreview,
	VoiceSelectorShortcut,
	VoiceSelectorTrigger,
} from "@ch5me/agent-ui-web"
import { Button } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Voice/VoiceSelector",
	component: VoiceSelector,
	render: () => (
		<div className="w-[560px] p-8">
			<VoiceSelector defaultValue="marin" open>
				<VoiceSelectorTrigger render={<Button variant="outline" />}>
					Choose voice
				</VoiceSelectorTrigger>
				<VoiceSelectorContent title="Select narration voice">
					<VoiceSelectorInput placeholder="Search voices..." />
					<VoiceSelectorList>
						<VoiceSelectorGroup heading="Narration">
							<VoiceSelectorItem value="marin">
								<VoiceSelectorPreview />
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<VoiceSelectorName>Marin</VoiceSelectorName>
										<VoiceSelectorShortcut>steady</VoiceSelectorShortcut>
									</div>
									<VoiceSelectorDescription>Clear operator narration.</VoiceSelectorDescription>
									<VoiceSelectorAttributes>
										<VoiceSelectorGender value="female" />
										<VoiceSelectorBullet />
										<VoiceSelectorAccent>US</VoiceSelectorAccent>
										<VoiceSelectorBullet />
										<VoiceSelectorAge>32</VoiceSelectorAge>
									</VoiceSelectorAttributes>
								</div>
							</VoiceSelectorItem>
							<VoiceSelectorItem value="arden">
								<VoiceSelectorPreview playing />
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<VoiceSelectorName>Arden</VoiceSelectorName>
										<VoiceSelectorShortcut>live</VoiceSelectorShortcut>
									</div>
									<VoiceSelectorDescription>Warm handoff summary voice.</VoiceSelectorDescription>
									<VoiceSelectorAttributes>
										<VoiceSelectorGender value="male" />
										<VoiceSelectorBullet />
										<VoiceSelectorAccent>UK</VoiceSelectorAccent>
										<VoiceSelectorBullet />
										<VoiceSelectorAge>41</VoiceSelectorAge>
									</VoiceSelectorAttributes>
								</div>
							</VoiceSelectorItem>
						</VoiceSelectorGroup>
					</VoiceSelectorList>
				</VoiceSelectorContent>
			</VoiceSelector>
		</div>
	),
} satisfies Meta<typeof VoiceSelector>

export default meta

type Story = StoryObj

export const Default: Story = {}
