import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@ch5me/elf-ui/components/navigation-menu"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Navigation/NavigationMenu",
	component: NavigationMenu,
	tags: ["autodocs"],
	render: () => (
		<div className="min-h-[320px] w-[620px] p-10">
			<NavigationMenu defaultValue="sessions">
				<NavigationMenuList>
					<NavigationMenuItem value="sessions">
						<NavigationMenuTrigger>Sessions</NavigationMenuTrigger>
						<NavigationMenuContent>
							<div className="grid w-[420px] grid-cols-2 gap-2 p-2">
								<NavigationMenuLink href="#active" active>
									<div>
										<div className="text-sm font-medium">Active sessions</div>
										<div className="text-xs text-muted-foreground">
											Live agents with browser lanes.
										</div>
									</div>
								</NavigationMenuLink>
								<NavigationMenuLink href="#history">
									<div>
										<div className="text-sm font-medium">History</div>
										<div className="text-xs text-muted-foreground">
											Completed runs and proof folders.
										</div>
									</div>
								</NavigationMenuLink>
							</div>
						</NavigationMenuContent>
					</NavigationMenuItem>
					<NavigationMenuItem value="proof">
						<NavigationMenuTrigger>Proof</NavigationMenuTrigger>
						<NavigationMenuContent>
							<div className="w-[260px] p-2">
								<NavigationMenuLink href="#coverage">Coverage tracker</NavigationMenuLink>
								<NavigationMenuLink href="#screenshots">Screenshots</NavigationMenuLink>
							</div>
						</NavigationMenuContent>
					</NavigationMenuItem>
				</NavigationMenuList>
			</NavigationMenu>
		</div>
	),
} satisfies Meta<typeof NavigationMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
