import {
	Source,
	Sources,
	SourcesContent,
	SourcesTrigger,
} from "@ch5me/elf-ui/components/ai-elements/sources"
import type { Meta, StoryObj } from "@storybook/react-vite"

const openByDefault = { defaultOpen: true }

const meta = {
	title: "AI Elements/Citations/Sources",
	component: Sources,
	tags: ["autodocs"],
	render: () => (
		<div className="w-[520px] p-8">
			<Sources {...openByDefault}>
				<SourcesTrigger count={3} />
				<SourcesContent>
					<Source href="https://storybook.js.org" title="Storybook docs" />
					<Source href="https://base-ui.com" title="Base UI primitives" />
					<Source href="https://ch5.dev" title="CH5 coverage report" />
				</SourcesContent>
			</Sources>
		</div>
	),
} satisfies Meta<typeof Sources>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
