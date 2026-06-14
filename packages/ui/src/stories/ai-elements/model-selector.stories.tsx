import {
	ModelSelector,
	ModelSelectorContent,
	ModelSelectorGroup,
	ModelSelectorInput,
	ModelSelectorItem,
	ModelSelectorList,
	ModelSelectorLogo,
	ModelSelectorLogoGroup,
	ModelSelectorName,
	ModelSelectorSeparator,
	ModelSelectorShortcut,
	ModelSelectorTrigger,
} from "@ch5me/agent-ui-web"
import { Button } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Selection/ModelSelector",
	component: ModelSelector,
	render: () => (
		<div className="w-[560px] p-8">
			<ModelSelector open>
				<ModelSelectorTrigger render={<Button variant="outline" />}>
					Choose model
				</ModelSelectorTrigger>
				<ModelSelectorContent title="Select coding model">
					<ModelSelectorInput placeholder="Search models..." />
					<ModelSelectorList>
						<ModelSelectorGroup heading="Fast coding">
							<ModelSelectorItem value="gpt-5-codex">
								<ModelSelectorLogoGroup>
									<ModelSelectorLogo provider="openai" />
								</ModelSelectorLogoGroup>
								<ModelSelectorName>GPT-5 Codex</ModelSelectorName>
								<ModelSelectorShortcut>262k</ModelSelectorShortcut>
							</ModelSelectorItem>
							<ModelSelectorItem value="claude-sonnet-4.5">
								<ModelSelectorLogoGroup>
									<ModelSelectorLogo provider="anthropic" />
								</ModelSelectorLogoGroup>
								<ModelSelectorName>Claude Sonnet 4.5</ModelSelectorName>
								<ModelSelectorShortcut>200k</ModelSelectorShortcut>
							</ModelSelectorItem>
						</ModelSelectorGroup>
						<ModelSelectorSeparator />
						<ModelSelectorGroup heading="Fallback">
							<ModelSelectorItem value="openrouter-auto">
								<ModelSelectorLogoGroup>
									<ModelSelectorLogo provider="openrouter" />
								</ModelSelectorLogoGroup>
								<ModelSelectorName>OpenRouter Auto</ModelSelectorName>
								<ModelSelectorShortcut>broker</ModelSelectorShortcut>
							</ModelSelectorItem>
						</ModelSelectorGroup>
					</ModelSelectorList>
				</ModelSelectorContent>
			</ModelSelector>
		</div>
	),
} satisfies Meta<typeof ModelSelector>

export default meta

type Story = StoryObj

export const Default: Story = {}
