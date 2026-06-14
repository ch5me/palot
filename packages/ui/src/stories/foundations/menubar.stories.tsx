import {
	Menubar,
	MenubarCheckboxItem,
	MenubarContent,
	MenubarGroup,
	MenubarItem,
	MenubarLabel,
	MenubarMenu,
	MenubarSeparator,
	MenubarShortcut,
	MenubarTrigger,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Navigation/Menubar",
	component: Menubar,
	render: () => (
		<div className="min-h-[280px] w-[520px] p-10">
			<Menubar>
				<MenubarMenu defaultOpen modal={false}>
					<MenubarTrigger>Session</MenubarTrigger>
					<MenubarContent className="w-56">
						<MenubarGroup>
							<MenubarLabel>Session</MenubarLabel>
							<MenubarItem>
								New branch
								<MenubarShortcut>N</MenubarShortcut>
							</MenubarItem>
							<MenubarItem>
								Open transcript
								<MenubarShortcut>T</MenubarShortcut>
							</MenubarItem>
							<MenubarCheckboxItem checked>Keep browser lane</MenubarCheckboxItem>
						</MenubarGroup>
						<MenubarSeparator />
						<MenubarItem variant="destructive">Archive session</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
				<MenubarMenu>
					<MenubarTrigger>View</MenubarTrigger>
					<MenubarContent>
						<MenubarItem>Focus side panel</MenubarItem>
						<MenubarItem>Toggle logs</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>
		</div>
	),
} satisfies Meta<typeof Menubar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
