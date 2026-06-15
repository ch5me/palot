import { Button, Card, CardContent, CardHeader, CardTitle } from "@ch5me/ch5-ui-web"
import { SplitPane } from "@ch5me/workspace"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
	FileTextIcon,
	Layers3Icon,
	LayoutPanelTopIcon,
	type LucideIcon,
	MessageSquareIcon,
	PanelRightIcon,
	SearchIcon,
	SparklesIcon,
	WorkflowIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { createHtmlPortalNode, InPortal, OutPortal } from "react-reverse-portal"

type DocumentTabId = "studio" | "pdf-review"
type UtilityTabId = "memory" | "browser"

const meta = {
	title: "AI Elements/Shell/Palot Three Pane",
	parameters: {
		layout: "fullscreen",
	},
	render: () => <PalotThreePaneShellStory />,
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

function PalotThreePaneShellStory() {
	const [documentTab, setDocumentTab] = useState<DocumentTabId>("studio")
	const [utilityTab, setUtilityTab] = useState<UtilityTabId>("memory")
	const [documentPanelOpen, setDocumentPanelOpen] = useState(true)
	const [utilityPanelOpen, setUtilityPanelOpen] = useState(true)
	const portalNodes = useMemo(
		() => ({
			studio: createHtmlPortalNode(),
			"pdf-review": createHtmlPortalNode(),
		}),
		[],
	)

	return (
		<div className="h-screen bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--ff-accent-primary)_16%,transparent),transparent_36%),linear-gradient(180deg,color-mix(in_srgb,var(--background)_86%,black_14%),var(--background))] p-4 text-foreground sm:p-6">
			<InPortal node={portalNodes.studio}>
				<StudioDocumentSurface />
			</InPortal>
			<InPortal node={portalNodes["pdf-review"]}>
				<PdfReviewDocumentSurface />
			</InPortal>
			<div className="h-full overflow-hidden rounded-[28px] border border-border/70 bg-background/95 shadow-[0_30px_120px_-48px_rgba(0,0,0,0.85)] backdrop-blur">
				<SplitPane
					side="left"
					defaultPanelWidth={248}
					minPanelWidth={220}
					maxPanelWidth={340}
					handleAriaLabel="Resize session sidebar"
					panel={<SessionSidebar documentTab={documentTab} utilityTab={utilityTab} />}
				>
					<div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
						<ShellToolbar
							documentTab={documentTab}
							documentPanelOpen={documentPanelOpen}
							onDocumentPanelOpenChange={setDocumentPanelOpen}
							onDocumentTabChange={setDocumentTab}
							onUtilityPanelOpenChange={setUtilityPanelOpen}
							onUtilityTabChange={setUtilityTab}
							utilityPanelOpen={utilityPanelOpen}
							utilityTab={utilityTab}
						/>
						<div className="min-h-0 flex-1 p-3 sm:p-4">
							<SplitPane
								side="right"
								open={utilityPanelOpen}
								onOpenChange={setUtilityPanelOpen}
								defaultPanelWidth={344}
								minPanelWidth={280}
								maxPanelWidth={480}
								handleAriaLabel="Resize utility pane"
								panel={<UtilityPane utilityTab={utilityTab} onTabChange={setUtilityTab} />}
							>
								<SplitPane
									side="right"
									open={documentPanelOpen}
									onOpenChange={setDocumentPanelOpen}
									defaultPanelWidth={520}
									minPanelWidth={360}
									maxPanelWidth={860}
									handleAriaLabel="Resize document pane"
									panel={
										<DocumentPane
											documentTab={documentTab}
											onTabChange={setDocumentTab}
											portalNode={portalNodes[documentTab]}
										/>
									}
								>
									<ChatPane />
								</SplitPane>
							</SplitPane>
						</div>
					</div>
				</SplitPane>
			</div>
		</div>
	)
}

function ShellToolbar({
	documentTab,
	documentPanelOpen,
	onDocumentPanelOpenChange,
	onDocumentTabChange,
	onUtilityPanelOpenChange,
	onUtilityTabChange,
	utilityPanelOpen,
	utilityTab,
}: {
	documentTab: DocumentTabId
	documentPanelOpen: boolean
	onDocumentPanelOpenChange: (open: boolean) => void
	onDocumentTabChange: (tab: DocumentTabId) => void
	onUtilityPanelOpenChange: (open: boolean) => void
	onUtilityTabChange: (tab: UtilityTabId) => void
	utilityPanelOpen: boolean
	utilityTab: UtilityTabId
}) {
	return (
		<header className="border-b border-border/80 bg-muted/20 px-4 py-3 sm:px-5">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="min-w-0">
					<div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
						<LayoutPanelTopIcon className="size-3.5" aria-hidden="true" />
						<span>Palot shell proof</span>
					</div>
					<h1 className="mt-1 font-semibold text-lg text-foreground sm:text-xl">
						Left nav, chat, document lane, utility lane
					</h1>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<StatusPill label={documentPanelOpen ? `Doc · ${documentTab}` : "Doc closed"} />
					<StatusPill label={utilityPanelOpen ? `Utility · ${utilityTab}` : "Utility closed"} />
					<Button
						size="sm"
						type="button"
						variant={documentTab === "studio" ? "default" : "secondary"}
						onClick={() => {
							onDocumentTabChange("studio")
							onDocumentPanelOpenChange(true)
						}}
					>
						Studio
					</Button>
					<Button
						size="sm"
						type="button"
						variant={documentTab === "pdf-review" ? "default" : "secondary"}
						onClick={() => {
							onDocumentTabChange("pdf-review")
							onDocumentPanelOpenChange(true)
						}}
					>
						PDF review
					</Button>
					<Button
						size="sm"
						type="button"
						variant={utilityTab === "memory" ? "secondary" : "ghost"}
						onClick={() => {
							onUtilityTabChange("memory")
							onUtilityPanelOpenChange(true)
						}}
					>
						Memory
					</Button>
					<Button
						size="sm"
						type="button"
						variant={utilityTab === "browser" ? "secondary" : "ghost"}
						onClick={() => {
							onUtilityTabChange("browser")
							onUtilityPanelOpenChange(true)
						}}
					>
						Browser
					</Button>
				</div>
			</div>
		</header>
	)
}

function SessionSidebar({
	documentTab,
	utilityTab,
}: {
	documentTab: DocumentTabId
	utilityTab: UtilityTabId
}) {
	return (
		<aside className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
			<div className="border-b border-sidebar-border/70 px-4 py-4">
				<div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-sidebar-foreground/65">
					<Layers3Icon className="size-3.5" aria-hidden="true" />
					<span>Session map</span>
				</div>
				<div className="mt-2 font-semibold text-lg">CLOUD000-174</div>
				<p className="mt-1 text-sidebar-foreground/70 text-sm">
					Storybook proof for nested Palot right docks.
				</p>
			</div>
			<div className="min-h-0 flex-1 space-y-5 overflow-auto px-3 py-4">
				<SidebarSection
					title="Shell lanes"
					items={[
						{ icon: MessageSquareIcon, label: "Chat lane active" },
						{ icon: FileTextIcon, label: `Document lane · ${documentTab}` },
						{ icon: PanelRightIcon, label: `Utility lane · ${utilityTab}` },
					]}
				/>
				<SidebarSection
					title="Pinned surfaces"
					items={[
						{ icon: SparklesIcon, label: "Studio brief" },
						{ icon: SearchIcon, label: "PDF review notes" },
						{ icon: WorkflowIcon, label: "Browser inspector" },
					]}
				/>
			</div>
		</aside>
	)
}

function SidebarSection({
	title,
	items,
}: {
	title: string
	items: Array<{ icon: LucideIcon; label: string }>
}) {
	return (
		<section>
			<div className="px-1 text-[11px] font-medium uppercase tracking-[0.22em] text-sidebar-foreground/55">
				{title}
			</div>
			<div className="mt-2 space-y-1">
				{items.map((item) => {
					const Icon = item.icon
					return (
						<div
							key={item.label}
							className="flex items-center gap-2 rounded-xl border border-sidebar-border/55 bg-sidebar-accent/30 px-3 py-2 text-sm"
						>
							<Icon className="size-4 text-sidebar-foreground/70" aria-hidden="true" />
							<span className="truncate">{item.label}</span>
						</div>
					)
				})}
			</div>
		</section>
	)
}

function ChatPane() {
	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
			<div className="border-b border-border/70 px-4 py-3">
				<div className="flex items-center gap-2 text-sm font-medium">
					<MessageSquareIcon className="size-4 text-muted-foreground" aria-hidden="true" />
					<span>Center chat lane</span>
				</div>
				<p className="mt-1 text-muted-foreground text-xs">
					Main run stays readable while document and utility panes coexist.
				</p>
			</div>
			<div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
				<ChatBubble
					speaker="user"
					text="Show me the Palot shell with nested right docks, not a generic workspace sample."
				/>
				<ChatBubble
					speaker="assistant"
					text="Document lane is separate from the utility lane. Switching between Studio and PDF Review keeps the outer utility work visible."
				/>
				<ChatBubble
					speaker="assistant"
					text="Story uses reverse portals so document surfaces keep their own mounted content while the active tab swaps inside the inner pane."
				/>
			</div>
			<div className="border-t border-border/70 px-4 py-3">
				<div className="rounded-2xl border border-dashed border-border/80 bg-muted/25 px-4 py-3 text-muted-foreground text-sm">
					Prompt input placeholder · later runtime proof can drive the same layout contract.
				</div>
			</div>
		</div>
	)
}

function ChatBubble({ speaker, text }: { speaker: "user" | "assistant"; text: string }) {
	const isAssistant = speaker === "assistant"
	return (
		<div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
			<div
				className={
					isAssistant
						? "max-w-[78%] rounded-[20px] rounded-tl-md border border-border/70 bg-muted/35 px-4 py-3 text-sm"
						: "max-w-[78%] rounded-[20px] rounded-tr-md bg-foreground px-4 py-3 text-background text-sm"
				}
			>
				{text}
			</div>
		</div>
	)
}

function DocumentPane({
	documentTab,
	onTabChange,
	portalNode,
}: {
	documentTab: DocumentTabId
	onTabChange: (tab: DocumentTabId) => void
	portalNode: ReturnType<typeof createHtmlPortalNode>
}) {
	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
			<div className="border-b border-border/70 px-4 py-3">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<div className="flex items-center gap-2 text-sm font-medium text-foreground">
							<FileTextIcon className="size-4 text-muted-foreground" aria-hidden="true" />
							<span>Inner document lane</span>
						</div>
						<p className="mt-1 text-muted-foreground text-xs">
							Active surface swaps between Studio and PDF Review without touching utility state.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							type="button"
							variant={documentTab === "studio" ? "default" : "secondary"}
							onClick={() => onTabChange("studio")}
						>
							Studio
						</Button>
						<Button
							size="sm"
							type="button"
							variant={documentTab === "pdf-review" ? "default" : "secondary"}
							onClick={() => onTabChange("pdf-review")}
						>
							PDF Review
						</Button>
					</div>
				</div>
			</div>
			<div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/10">
				<OutPortal node={portalNode} />
			</div>
		</div>
	)
}

function StudioDocumentSurface() {
	return (
		<div className="flex h-full min-h-0 flex-col overflow-auto bg-[linear-gradient(180deg,color-mix(in_srgb,var(--ff-accent-primary)_9%,transparent),transparent_28%),var(--background)] p-4 sm:p-5">
			<div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
				<Card className="border-border/70 bg-card/95">
					<CardHeader>
						<CardTitle className="text-base">Studio brief</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm text-muted-foreground">
						<p>Document lane hosts long-form work: outline, draft, and edit controls.</p>
						<div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
							<p className="font-medium text-foreground">Palette rollout recap</p>
							<p className="mt-2">- explicit doc-lane contract</p>
							<p>- surface lane metadata</p>
							<p>- Storybook shell parity proof</p>
						</div>
					</CardContent>
				</Card>
				<Card className="border-border/70 bg-card/95">
					<CardHeader>
						<CardTitle className="text-base">Linked artifacts</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm text-muted-foreground">
						<p>Outline.md</p>
						<p>Proof-matrix.md</p>
						<p>Runtime-bridge-notes.md</p>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

function PdfReviewDocumentSurface() {
	return (
		<div className="flex h-full min-h-0 flex-col overflow-auto bg-[linear-gradient(180deg,color-mix(in_srgb,var(--ff-accent-secondary)_10%,transparent),transparent_28%),var(--background)] p-4 sm:p-5">
			<div className="grid min-h-full gap-4 xl:grid-cols-[0.72fr_1fr]">
				<Card className="border-border/70 bg-card/95">
					<CardHeader>
						<CardTitle className="text-base">Review controls</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm text-muted-foreground">
						<p>Static placeholder stands in for the real iframe/pdf runtime.</p>
						<div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
							<p className="font-medium text-foreground">Reviewer notes</p>
							<p className="mt-2">Page 3 alignment</p>
							<p>Margin system matches shell tokens</p>
							<p>Switch back to Studio keeps utility lane open</p>
						</div>
					</CardContent>
				</Card>
				<div className="rounded-[24px] border border-border/70 bg-[#efe7db] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
					<div className="mx-auto flex h-full min-h-[520px] max-w-[440px] flex-col rounded-[18px] border border-[#d5c7b5] bg-[#fbf7f1] p-6 shadow-[0_24px_60px_-36px_rgba(80,52,28,0.55)]">
						<div className="text-[11px] uppercase tracking-[0.3em] text-[#7a6c5c]">PDF review</div>
						<h2 className="mt-3 font-semibold text-[#2a241d] text-xl">Launch checklist</h2>
						<div className="mt-6 space-y-3 text-[#4e4438] text-sm leading-6">
							<p>1. Bridge open routes `pdf-review` into the document lane.</p>
							<p>2. Utility browser lane remains visible for source comparison.</p>
							<p>3. Restore path closes doc lane when surface unavailable.</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

function UtilityPane({
	onTabChange,
	utilityTab,
}: {
	onTabChange: (tab: UtilityTabId) => void
	utilityTab: UtilityTabId
}) {
	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col bg-card">
			<div className="border-b border-border/70 px-4 py-3">
				<div className="flex items-center gap-2 text-sm font-medium text-foreground">
					<PanelRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
					<span>Outer utility lane</span>
				</div>
				<p className="mt-1 text-muted-foreground text-xs">
					Independent from the document tab. This stays open while Studio/PDF switch.
				</p>
				<div className="mt-3 flex items-center gap-2">
					<Button
						size="sm"
						type="button"
						variant={utilityTab === "memory" ? "default" : "secondary"}
						onClick={() => onTabChange("memory")}
					>
						Memory
					</Button>
					<Button
						size="sm"
						type="button"
						variant={utilityTab === "browser" ? "default" : "secondary"}
						onClick={() => onTabChange("browser")}
					>
						Browser
					</Button>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto p-4">
				{utilityTab === "memory" ? <MemoryUtilitySurface /> : <BrowserUtilitySurface />}
			</div>
		</div>
	)
}

function MemoryUtilitySurface() {
	return (
		<div className="space-y-3">
			<UtilityCard
				title="Pinned memory"
				body="Task 6 should prove runtime bridge opens the same shell contract, not a fake preview route."
			/>
			<UtilityCard
				title="Restoration note"
				body="Document lane remembers its own tab. Utility lane keeps browser/memory separately."
			/>
			<UtilityCard
				title="Tracker"
				body="Storybook proof done before browser/Electron evidence pass."
			/>
		</div>
	)
}

function BrowserUtilitySurface() {
	return (
		<div className="space-y-3">
			<UtilityCard
				title="Browser compare"
				body="Use utility lane for source page, spec notes, or live artifact while doc lane holds Studio or PDF Review."
			/>
			<div className="rounded-[22px] border border-border/70 bg-muted/25 p-4">
				<div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
					Live lane sketch
				</div>
				<div className="mt-3 rounded-2xl border border-border/70 bg-background p-4">
					<div className="h-3 w-28 rounded-full bg-muted" />
					<div className="mt-4 h-32 rounded-xl border border-dashed border-border/70 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--ff-accent-primary)_10%,transparent),transparent_55%)]" />
				</div>
			</div>
		</div>
	)
}

function UtilityCard({ title, body }: { title: string; body: string }) {
	return (
		<section className="rounded-[22px] border border-border/70 bg-muted/25 p-4">
			<div className="font-medium text-foreground text-sm">{title}</div>
			<p className="mt-2 text-muted-foreground text-sm leading-6">{body}</p>
		</section>
	)
}

function StatusPill({ label }: { label: string }) {
	return (
		<div className="rounded-full border border-border/70 bg-background px-3 py-1 text-muted-foreground text-xs">
			{label}
		</div>
	)
}
