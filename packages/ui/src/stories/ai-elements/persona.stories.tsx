import { Persona } from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Voice/Persona",
	component: Persona,
	render: () => (
		<div className="w-[360px] rounded-lg border bg-card p-6">
			<div className="flex items-center gap-4">
				<Persona className="size-24" state="listening" variant="obsidian" />
				<div>
					<div className="font-medium text-card-foreground">Obsidian</div>
					<div className="text-muted-foreground text-sm">Listening state</div>
				</div>
			</div>
		</div>
	),
} satisfies Meta<typeof Persona>

export default meta

type Story = StoryObj

export const Default: Story = {}
