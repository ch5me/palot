import {
	JSXPreview,
	JSXPreviewContent,
	JSXPreviewError,
} from "@ch5me/elf-ui/components/ai-elements/jsx-preview"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactNode } from "react"

const DemoCard = ({ title = "Preview", children }: { title?: string; children?: ReactNode }) => (
	<div className="rounded-lg border bg-card p-4 shadow-sm">
		<div className="font-medium text-card-foreground">{title}</div>
		<div className="mt-2 text-muted-foreground text-sm">{children}</div>
	</div>
)

const meta = {
	title: "AI Elements/Preview/JSXPreview",
	component: JSXPreview,
	render: () => (
		<div className="w-[560px] p-6">
			<JSXPreview
				components={{ DemoCard }}
				jsx={`<DemoCard title="Run evidence"><span>3 screenshots captured, CH5 coverage mapped.</span></DemoCard>`}
			>
				<JSXPreviewContent />
				<JSXPreviewError />
			</JSXPreview>
		</div>
	),
} satisfies Meta<typeof JSXPreview>

export default meta

type Story = StoryObj

export const Default: Story = {}
