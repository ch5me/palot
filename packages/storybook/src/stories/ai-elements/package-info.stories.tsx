import {
	PackageInfo,
	PackageInfoChangeType,
	PackageInfoContent,
	PackageInfoDependencies,
	PackageInfoDependency,
	PackageInfoDescription,
	PackageInfoHeader,
	PackageInfoName,
	PackageInfoVersion,
} from "@ch5me/elf-ui/components/ai-elements/package-info"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Data/PackageInfo",
	component: PackageInfo,
	tags: ["autodocs"],
	render: () => (
		<div className="w-[520px] p-8">
			<PackageInfo
				changeType="minor"
				currentVersion="0.6.0"
				name="@ch5me/elf-ui"
				newVersion="0.7.0"
			>
				<PackageInfoHeader>
					<PackageInfoName />
					<PackageInfoChangeType />
				</PackageInfoHeader>
				<PackageInfoVersion />
				<PackageInfoDescription>
					Shared component package with updated Storybook coverage.
				</PackageInfoDescription>
				<PackageInfoContent>
					<PackageInfoDependencies>
						<PackageInfoDependency name="@base-ui/react" version="latest" />
						<PackageInfoDependency name="lucide-react" version="^0.561.0" />
					</PackageInfoDependencies>
				</PackageInfoContent>
			</PackageInfo>
		</div>
	),
} satisfies Meta<typeof PackageInfo>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		name: "@ch5me/elf-ui",
	},
}
