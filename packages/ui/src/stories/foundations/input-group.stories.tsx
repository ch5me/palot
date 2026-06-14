import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
	InputGroupTextarea,
} from "@ch5me/elf-ui/components/input-group"
import { Kbd } from "@ch5me/elf-ui/components/kbd"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { LinkIcon, SearchIcon, SendIcon } from "lucide-react"

const meta = {
	title: "Foundations/Forms/InputGroup",
	component: InputGroup,
	render: () => (
		<div className="flex w-[460px] flex-col gap-4">
			<InputGroup>
				<InputGroupAddon>
					<SearchIcon aria-hidden="true" />
				</InputGroupAddon>
				<InputGroupInput defaultValue="Storybook coverage" />
				<InputGroupAddon align="inline-end">
					<Kbd>⌘K</Kbd>
				</InputGroupAddon>
			</InputGroup>
			<InputGroup>
				<InputGroupAddon align="block-start">
					<InputGroupText>
						<LinkIcon aria-hidden="true" />
						Prompt context
					</InputGroupText>
				</InputGroupAddon>
				<InputGroupTextarea defaultValue="Create stories for local components only." rows={3} />
				<InputGroupAddon align="block-end" className="justify-end border-t">
					<InputGroupButton>
						<SendIcon aria-hidden="true" />
						Send
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</div>
	),
} satisfies Meta<typeof InputGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
