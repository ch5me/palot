import {
	Agent,
	AgentContent,
	AgentHeader,
	AgentInstructions,
	AgentOutput,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const outputSchema = `interface StorybookServiceOrder {
	component: string
	stories: string[]
	proofDir: string
	coverageMapped: boolean
}`

const meta = {
	title: "AI Elements/Workflow/Agent",
	component: Agent,
	render: () => (
		<div className="w-[680px] p-8">
			<Agent>
				<AgentHeader name="Storybook Coverage Agent" model="gpt-5-codex" />
				<AgentContent>
					<AgentInstructions>
						Inspect local component API, create focused stories, verify desktop and mobile render
						proof, then update CH5 coverage.
					</AgentInstructions>
					<AgentOutput schema={outputSchema} />
				</AgentContent>
			</Agent>
		</div>
	),
} satisfies Meta<typeof Agent>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
