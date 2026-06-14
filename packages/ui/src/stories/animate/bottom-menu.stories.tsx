import { BottomMenu, BottomMenuOptionGroup, BottomMenuRow } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Code2Icon, SearchIcon, SettingsIcon, SlidersHorizontalIcon, ZapIcon } from "lucide-react"

const meta = {
	title: "Animate/Layouts/BottomMenu",
	component: BottomMenu,
	render: () => (
		<div className="flex h-[360px] w-[520px] items-end justify-center p-10">
			<BottomMenu
				defaultValue="tools"
				items={[
					{
						id: "search",
						label: "Search",
						icon: SearchIcon,
						content: (
							<div className="min-w-64 p-2">
								<BottomMenuRow icon={SearchIcon}>Find component coverage</BottomMenuRow>
								<BottomMenuRow icon={Code2Icon}>Open source file</BottomMenuRow>
							</div>
						),
					},
					{
						id: "tools",
						label: "Tools",
						icon: ZapIcon,
						content: (
							<div className="min-w-72 space-y-3 p-3">
								<BottomMenuOptionGroup
									defaultValue="render"
									options={[
										{ value: "render", label: "Render", icon: ZapIcon },
										{ value: "scan", label: "Scan", icon: SearchIcon },
										{ value: "config", label: "Config", icon: SlidersHorizontalIcon },
									]}
								/>
								<BottomMenuRow icon={SettingsIcon}>Open Storybook settings</BottomMenuRow>
							</div>
						),
					},
					{ id: "settings", label: "Settings", icon: SettingsIcon },
				]}
			/>
		</div>
	),
} satisfies Meta<typeof BottomMenu>

export default meta

type Story = StoryObj

export const Default: Story = {}
