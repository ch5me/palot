import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ch5me/elf-ui/components/tabs"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { BotIcon, FolderIcon, GlobeIcon } from "lucide-react"

const meta = {
	title: "Foundations/Navigation/Tabs",
	component: Tabs,
	args: {
		defaultValue: "chat",
	},
	render: (args) => (
		<Tabs {...args} className="w-[420px]">
			<TabsList>
				<TabsTrigger value="chat">
					<BotIcon aria-hidden="true" />
					Chat
				</TabsTrigger>
				<TabsTrigger value="browser">
					<GlobeIcon aria-hidden="true" />
					Browser
				</TabsTrigger>
				<TabsTrigger value="files">
					<FolderIcon aria-hidden="true" />
					Files
				</TabsTrigger>
			</TabsList>
			<TabsContent value="chat" className="rounded-lg border bg-card p-4 text-card-foreground">
				Chat transcript and tool calls stay active.
			</TabsContent>
			<TabsContent value="browser" className="rounded-lg border bg-card p-4 text-card-foreground">
				Browser lane preview opens here.
			</TabsContent>
			<TabsContent value="files" className="rounded-lg border bg-card p-4 text-card-foreground">
				Changed files and review notes appear here.
			</TabsContent>
		</Tabs>
	),
} satisfies Meta<typeof Tabs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Line: Story = {
	render: () => (
		<Tabs defaultValue="chat" className="w-[420px]">
			<TabsList variant="line">
				<TabsTrigger value="chat">Chat</TabsTrigger>
				<TabsTrigger value="browser">Browser</TabsTrigger>
				<TabsTrigger value="files">Files</TabsTrigger>
			</TabsList>
			<TabsContent value="chat" className="pt-4 text-sm text-muted-foreground">
				Line variant for compact workspace surfaces.
			</TabsContent>
		</Tabs>
	),
}
