import {
	Sandbox,
	SandboxContent,
	SandboxHeader,
	SandboxTabContent,
	SandboxTabs,
	SandboxTabsBar,
	SandboxTabsList,
	SandboxTabsTrigger,
} from "@ch5me/elf-ui/components/ai-elements/sandbox"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Tooling/Sandbox",
	component: Sandbox,
	tags: ["autodocs"],
	render: () => (
		<div className="w-[720px] p-8">
			<Sandbox defaultOpen>
				<SandboxHeader state="output-available" title="Storybook render sandbox" />
				<SandboxContent>
					<SandboxTabs defaultValue="preview">
						<SandboxTabsBar>
							<SandboxTabsList>
								<SandboxTabsTrigger value="preview">Preview</SandboxTabsTrigger>
								<SandboxTabsTrigger value="logs">Logs</SandboxTabsTrigger>
							</SandboxTabsList>
						</SandboxTabsBar>
						<SandboxTabContent className="p-4" value="preview">
							<div className="rounded-md border bg-muted/30 p-4">
								New story targets rendered cleanly in desktop and mobile viewports.
							</div>
						</SandboxTabContent>
						<SandboxTabContent className="p-4 font-mono text-xs" value="logs">
							0 console warnings
							<br />0 runtime errors
						</SandboxTabContent>
					</SandboxTabs>
				</SandboxContent>
			</Sandbox>
		</div>
	),
} satisfies Meta<typeof Sandbox>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultOpen: true,
	},
}
