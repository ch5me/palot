import {
	Artifact,
	ArtifactAction,
	ArtifactActions,
	ArtifactClose,
	ArtifactContent,
	ArtifactDescription,
	ArtifactHeader,
	ArtifactTitle,
} from "@ch5me/elf-ui/components/ai-elements/artifact"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CopyIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react"

const meta = {
	title: "AI Elements/Artifact/Artifact",
	component: Artifact,
	tags: ["autodocs"],
	render: () => (
		<div className="w-[720px] p-8">
			<Artifact className="h-[420px]">
				<ArtifactHeader>
					<div className="min-w-0">
						<ArtifactTitle>storybook-service-order.md</ArtifactTitle>
						<ArtifactDescription>
							Coverage plan generated from CH5 local component gaps
						</ArtifactDescription>
					</div>
					<ArtifactActions>
						<ArtifactAction icon={CopyIcon} tooltip="Copy artifact" />
						<ArtifactAction icon={DownloadIcon} tooltip="Download markdown" />
						<ArtifactAction icon={ExternalLinkIcon} tooltip="Open in editor" />
						<ArtifactClose />
					</ArtifactActions>
				</ArtifactHeader>
				<ArtifactContent className="space-y-4 text-sm">
					<section className="rounded-md border bg-muted/30 p-4">
						<h3 className="font-medium">Batch 10</h3>
						<p className="mt-1 text-muted-foreground">
							Add stories for local AI chat surfaces, prove render coverage, then check tracker
							items.
						</p>
					</section>
					<pre className="overflow-auto rounded-md bg-zinc-950 p-4 text-zinc-50 text-xs">
						{`- inspect component API
- create focused Storybook story
- run render proof
- update CH5 coverage evidence`}
					</pre>
				</ArtifactContent>
			</Artifact>
		</div>
	),
} satisfies Meta<typeof Artifact>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
