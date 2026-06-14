import {
	Combobox,
	ComboboxContent,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxSeparator,
} from "@ch5me/elf-ui/components/combobox"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/Combobox",
	component: Combobox,
	tags: ["autodocs"],
	render: () => (
		<div className="min-h-[320px] w-[460px] p-10">
			<Combobox defaultOpen defaultValue="opencode">
				<ComboboxInput placeholder="Choose runtime..." showClear />
				<ComboboxContent>
					<ComboboxList>
						<ComboboxGroup>
							<ComboboxLabel>Runtimes</ComboboxLabel>
							<ComboboxItem value="opencode">OpenCode</ComboboxItem>
							<ComboboxItem value="claude-code">Claude Code</ComboboxItem>
							<ComboboxItem value="codex">Codex</ComboboxItem>
						</ComboboxGroup>
						<ComboboxSeparator />
						<ComboboxGroup>
							<ComboboxLabel>Automation</ComboboxLabel>
							<ComboboxItem value="browser-lane">Browser lane</ComboboxItem>
						</ComboboxGroup>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</div>
	),
} satisfies Meta<typeof Combobox>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
