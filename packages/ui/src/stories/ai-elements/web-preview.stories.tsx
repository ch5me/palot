import {
	WebPreview,
	WebPreviewBody,
	WebPreviewConsole,
	WebPreviewNavigation,
	WebPreviewNavigationButton,
	WebPreviewUrl,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArrowLeftIcon, ArrowRightIcon, ExternalLinkIcon, RefreshCcwIcon } from "lucide-react"

const previewDocument = `
<!doctype html>
<html>
	<body style="margin:0;font-family:ui-sans-serif,system-ui;background:#f7f7f4;color:#191815;">
		<main style="padding:32px;">
			<p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#666;">Preview</p>
			<h1 style="margin:0;font-size:28px;">Artifact ready</h1>
			<p style="max-width:420px;line-height:1.5;color:#555;">Generated page preview with console state and navigation controls.</p>
		</main>
	</body>
</html>`

const meta = {
	title: "AI Elements/Preview/WebPreview",
	component: WebPreview,
	render: () => (
		<div className="h-[460px] w-[720px] p-4">
			<WebPreview defaultUrl="https://preview.local/artifact">
				<WebPreviewNavigation>
					<WebPreviewNavigationButton tooltip="Back">
						<ArrowLeftIcon className="size-4" />
					</WebPreviewNavigationButton>
					<WebPreviewNavigationButton tooltip="Forward">
						<ArrowRightIcon className="size-4" />
					</WebPreviewNavigationButton>
					<WebPreviewNavigationButton tooltip="Reload">
						<RefreshCcwIcon className="size-4" />
					</WebPreviewNavigationButton>
					<WebPreviewUrl aria-label="Preview URL" />
					<WebPreviewNavigationButton tooltip="Open external">
						<ExternalLinkIcon className="size-4" />
					</WebPreviewNavigationButton>
				</WebPreviewNavigation>
				<WebPreviewBody srcDoc={previewDocument} />
				<WebPreviewConsole
					logs={[
						{
							level: "log",
							message: "Preview mounted",
							timestamp: new Date("2026-06-14T01:40:00Z"),
						},
						{
							level: "warn",
							message: "Using local artifact document",
							timestamp: new Date("2026-06-14T01:40:02Z"),
						},
					]}
				/>
			</WebPreview>
		</div>
	),
} satisfies Meta<typeof WebPreview>

export default meta

type Story = StoryObj

export const Default: Story = {}
