import { Badge, Button } from "@ch5me/ch5-ui-web"
import { SplitPane } from "@ch5me/workspace"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
	FileTextIcon,
	Layers3Icon,
	MessageSquareIcon,
	PanelRightIcon,
	SparklesIcon,
	WorkflowIcon,
} from "lucide-react"
import { type ReactNode, useMemo, useRef, useState } from "react"
import {
	createHtmlPortalNode,
	type HtmlPortalNode,
	InPortal,
	OutPortal,
} from "react-reverse-portal"

const meta = {
	title: "AI Elements/Proof/Palot 3-Pane Shell",
	parameters: {
		layout: "fullscreen",
	},
	render: () => <PalotThreePaneShellStory />,
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

type DocumentTabId = "studio" | "pdf-review"
type UtilityTabId = "review" | "browser"

const SIDEBAR_WIDTH = 264
const UTILITY_WIDTH = 392
const DOCUMENT_WIDTH = 520

const DOC_TABS: Array<{ id: DocumentTabId; title: string; note: string }> = [
	{
		id: "studio",
		title: "Studio",
		note: "Artifact workspace reparented into document lane via reverse portal.",
	},
	{
		id: "pdf-review",
		title: "PDF Review",
		note: "Proof surface uses local content, not iframe, so state persistence stays observable.",
	},
]

const UTILITY_TABS: Array<{ id: UtilityTabId; title: string; note: string }> = [
	{
		id: "review",
		title: "Review",
		note: "Utility lane stays separate from document lane state.",
	},
	{
		id: "browser",
		title: "Browser",
		note: "Second utility surface proves coexistence with active document pane.",
	},
]

function PalotThreePaneShellStory() {
	const [utilityOpen, setUtilityOpen] = useState(true)
	const [documentOpen, setDocumentOpen] = useState(true)
	const [activeDocumentTab, setActiveDocumentTab] = useState<DocumentTabId>("studio")
	const [activeUtilityTab, setActiveUtilityTab] = useState<UtilityTabId>("review")
	const [studioVisits, setStudioVisits] = useState(1)
	const [pdfVisits, setPdfVisits] = useState(1)

	const portalNodesRef = useRef<Record<DocumentTabId, HtmlPortalNode> | null>(null)
	if (!portalNodesRef.current) {
		portalNodesRef.current = {
			studio: createHtmlPortalNode(),
			"pdf-review": createHtmlPortalNode(),
		}
	}

	const activeDoc = DOC_TABS.find((tab) => tab.id === activeDocumentTab) ?? DOC_TABS[0]
	const activeUtility = UTILITY_TABS.find((tab) => tab.id === activeUtilityTab) ?? UTILITY_TABS[0]
	const activePortalNode = portalNodesRef.current[activeDocumentTab]
	const docSummary = useMemo(
		() => `${studioVisits} studio mount actions / ${pdfVisits} pdf mount actions`,
		[studioVisits, pdfVisits],
	)

	return (
		<div className="h-screen min-h-[720px] bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_30%),linear-gradient(180deg,_rgba(15,15,15,0.98),_rgba(24,24,24,1))] p-6 text-foreground">
			{DOC_TABS.map((tab) => (
				<InPortal key={tab.id} node={portalNodesRef.current![tab.id]}>
					{tab.id === "studio" ? (
						<StudioDocumentCard
							visits={studioVisits}
							onAddCheckpoint={() => setStudioVisits((value) => value + 1)}
						/>
					) : (
						<PdfReviewDocumentCard
							visits={pdfVisits}
							onAddAnnotation={() => setPdfVisits((value) => value + 1)}
						/>
					)}
				</InPortal>
			))}

			<div className="flex h-full min-h-0 min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-background/92 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
				<SplitPane
					side="left"
					defaultPanelWidth={SIDEBAR_WIDTH}
					minPanelWidth={220}
					maxPanelWidth={340}
					handleAriaLabel="Resize Palot sidebar"
					panel={
						<ShellSidebar
							activeDocumentTab={activeDocumentTab}
							activeUtilityTab={activeUtilityTab}
						/>
					}
				>
					<SplitPane
						side="right"
						open={utilityOpen}
						onOpenChange={setUtilityOpen}
						defaultPanelWidth={UTILITY_WIDTH}
						minPanelWidth={300}
						maxPanelWidth={760}
						handleAriaLabel="Resize Palot utility lane"
						panel={
							<UtilityPaneShell
								activeUtilityTab={activeUtilityTab}
								onSelectTab={setActiveUtilityTab}
								note={activeUtility.note}
							/>
						}
					>
						<SplitPane
							side="right"
							open={documentOpen}
							onOpenChange={setDocumentOpen}
							defaultPanelWidth={DOCUMENT_WIDTH}
							minPanelWidth={360}
							maxPanelWidth={920}
							handleAriaLabel="Resize Palot document lane"
							panel={
								documentOpen && activePortalNode ? (
									<DocumentPaneShell
										activeDocumentTab={activeDocumentTab}
										note={activeDoc.note}
										onSelectTab={setActiveDocumentTab}
										portalNode={activePortalNode}
										summary={docSummary}
									/>
								) : (
									<ClosedPanePlaceholder
										title="Document lane closed"
										description="Open Studio or PDF Review to mirror Palot doc surface routing."
									/>
								)
							}
						>
							<ChatShell
								activeDocumentTab={activeDocumentTab}
								activeUtilityTab={activeUtilityTab}
								documentOpen={documentOpen}
								onToggleDocument={() => setDocumentOpen((open) => !open)}
								onToggleUtility={() => setUtilityOpen((open) => !open)}
							/>
						</SplitPane>
					</SplitPane>
				</SplitPane>
			</div>
		</div>
	)
}

function ShellSidebar({
	activeDocumentTab,
	activeUtilityTab,
}: {
	activeDocumentTab: DocumentTabId
	activeUtilityTab: UtilityTabId
}) {
	return (
		<div className="flex h-full min-h-0 flex-col bg-[#121212] text-white">
			<div className="border-b border-white/10 px-5 py-4">
				<p className="text-[11px] uppercase tracking-[0.24em] text-amber-300/80">Palette</p>
				<h2 className="mt-2 font-semibold text-lg">Left sidebar</h2>
				<p className="mt-1 text-sm text-white/60">Session rail + workspace context.</p>
			</div>
			<div className="space-y-5 px-4 py-4 text-sm">
				<SidebarCluster
					title="Sessions"
					items={["palette-3pane-finish", "runtime-proof-follow-up", "storybook-proof-capture"]}
				/>
				<SidebarCluster
					title="Lane state"
					items={[
						`Document: ${activeDocumentTab}`,
						`Utility: ${activeUtilityTab}`,
						"Chat: active center lane",
					]}
				/>
			</div>
			<div className="mt-auto border-t border-white/10 px-4 py-4 text-xs text-white/55">
				Real app wraps this shell with app chrome. Story keeps sidebar explicit for proof.
			</div>
		</div>
	)
}

function SidebarCluster({ title, items }: { title: string; items: string[] }) {
	return (
		<div>
			<p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/40">{title}</p>
			<div className="space-y-2">
				{items.map((item) => (
					<div
						key={item}
						className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2 text-white/78"
					>
						{item}
					</div>
				))}
			</div>
		</div>
	)
}

function ChatShell({
	activeDocumentTab,
	activeUtilityTab,
	documentOpen,
	onToggleDocument,
	onToggleUtility,
}: {
	activeDocumentTab: DocumentTabId
	activeUtilityTab: UtilityTabId
	documentOpen: boolean
	onToggleDocument: () => void
	onToggleUtility: () => void
}) {
	return (
		<div className="flex h-full min-h-0 flex-col bg-[#171717] text-white">
			<div className="border-b border-white/8 px-5 py-4">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-[11px] uppercase tracking-[0.24em] text-amber-300/70">Center lane</p>
						<h2 className="mt-1 font-semibold text-lg">Chat session</h2>
					</div>
					<div className="flex gap-2">
						<Button size="sm" variant="outline" onClick={onToggleDocument}>
							{documentOpen ? "Hide doc lane" : "Show doc lane"}
						</Button>
						<Button size="sm" variant="outline" onClick={onToggleUtility}>
							Toggle utility lane
						</Button>
					</div>
				</div>
				<div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
					<Badge variant="secondary">doc: {activeDocumentTab}</Badge>
					<Badge variant="secondary">utility: {activeUtilityTab}</Badge>
					<Badge variant="secondary">nested right split</Badge>
				</div>
			</div>
			<div className="grid min-h-0 flex-1 gap-3 overflow-auto px-5 py-5">
				<ChatBubble
					from="user"
					text="Open Studio in document lane. Keep Review utility pane visible."
				/>
				<ChatBubble
					from="assistant"
					text="Done. Document lane and utility lane route independently. Switch document tabs to inspect reparented content state."
				/>
				<ChatBubble
					from="assistant"
					text="Story avoids iframe proof trap. Real Studio may still reload iframe-backed content if host runtime remounts it."
				/>
			</div>
		</div>
	)
}

function ChatBubble({ from, text }: { from: "user" | "assistant"; text: string }) {
	const isUser = from === "user"
	return (
		<div
			className={`max-w-[720px] rounded-[22px] border px-4 py-3 text-sm leading-6 ${isUser ? "ml-auto border-amber-400/35 bg-amber-300/12 text-amber-50" : "border-white/10 bg-white/5 text-white/78"}`}
		>
			<p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-white/45">{from}</p>
			<p>{text}</p>
		</div>
	)
}

function DocumentPaneShell({
	activeDocumentTab,
	note,
	onSelectTab,
	portalNode,
	summary,
}: {
	activeDocumentTab: DocumentTabId
	note: string
	onSelectTab: (tab: DocumentTabId) => void
	portalNode: HtmlPortalNode
	summary: string
}) {
	return (
		<div className="flex h-full min-h-0 flex-col bg-[#111111] text-white">
			<div className="border-b border-white/8 px-4 py-4">
				<div className="flex items-center gap-2 text-sm font-medium">
					<FileTextIcon className="size-4 text-amber-300/70" aria-hidden="true" />
					<span>Document lane</span>
				</div>
				<div className="mt-3 flex flex-wrap gap-2">
					{DOC_TABS.map((tab) => (
						<Button
							key={tab.id}
							size="sm"
							variant={tab.id === activeDocumentTab ? "default" : "outline"}
							onClick={() => onSelectTab(tab.id)}
						>
							{tab.title}
						</Button>
					))}
				</div>
				<p className="mt-3 text-xs leading-5 text-white/55">{note}</p>
				<p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-amber-300/65">{summary}</p>
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">
				<OutPortal node={portalNode} />
			</div>
		</div>
	)
}

function UtilityPaneShell({
	activeUtilityTab,
	onSelectTab,
	note,
}: {
	activeUtilityTab: UtilityTabId
	onSelectTab: (tab: UtilityTabId) => void
	note: string
}) {
	return (
		<div className="flex h-full min-h-0 flex-col bg-[#141414] text-white">
			<div className="border-b border-white/8 px-4 py-4">
				<div className="flex items-center gap-2 text-sm font-medium">
					<PanelRightIcon className="size-4 text-sky-300/70" aria-hidden="true" />
					<span>Utility lane</span>
				</div>
				<div className="mt-3 flex flex-wrap gap-2">
					{UTILITY_TABS.map((tab) => (
						<Button
							key={tab.id}
							size="sm"
							variant={tab.id === activeUtilityTab ? "default" : "outline"}
							onClick={() => onSelectTab(tab.id)}
						>
							{tab.title}
						</Button>
					))}
				</div>
				<p className="mt-3 text-xs leading-5 text-white/55">{note}</p>
			</div>
			<div className="grid min-h-0 flex-1 gap-3 overflow-auto p-4">
				{activeUtilityTab === "review" ? <ReviewUtilityCard /> : <BrowserUtilityCard />}
			</div>
		</div>
	)
}

function StudioDocumentCard({
	visits,
	onAddCheckpoint,
}: {
	visits: number
	onAddCheckpoint: () => void
}) {
	return (
		<div className="flex h-full min-h-0 flex-col bg-[#0e0e0e] text-white">
			<div className="border-b border-white/8 px-5 py-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300/70">Studio</p>
						<h3 className="mt-1 font-semibold text-lg">Artifact canvas survives tab switch</h3>
					</div>
					<Badge variant="secondary">checkpoints: {visits}</Badge>
				</div>
			</div>
			<div className="grid min-h-0 flex-1 gap-4 overflow-auto p-5">
				<div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4">
					<div className="flex items-center gap-2 text-sm font-medium">
						<SparklesIcon className="size-4 text-emerald-300" aria-hidden="true" />
						<span>Persistent story-local surface</span>
					</div>
					<p className="mt-2 text-sm leading-6 text-white/72">
						Use button below, switch to PDF Review, then switch back. Counter stays because portal
						content moves, not remounts.
					</p>
				</div>
				<div className="grid gap-3 md:grid-cols-2">
					<MiniPanel
						title="Layers"
						icon={<Layers3Icon className="size-4 text-emerald-300" aria-hidden="true" />}
					>
						Draft shell
						<br />
						Dock parity
						<br />
						Portal proof
					</MiniPanel>
					<MiniPanel
						title="Runs"
						icon={<WorkflowIcon className="size-4 text-emerald-300" aria-hidden="true" />}
					>
						Artifact pass 04
						<br />
						Chrome capture queued
						<br />
						Note sync pending
					</MiniPanel>
				</div>
				<div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
					<div>
						<p className="font-medium text-sm">Checkpoint proof</p>
						<p className="text-xs text-white/55">State lives inside reparented subtree.</p>
					</div>
					<Button size="sm" onClick={onAddCheckpoint}>
						Add checkpoint
					</Button>
				</div>
			</div>
		</div>
	)
}

function PdfReviewDocumentCard({
	visits,
	onAddAnnotation,
}: {
	visits: number
	onAddAnnotation: () => void
}) {
	return (
		<div className="flex h-full min-h-0 flex-col bg-[#101010] text-white">
			<div className="border-b border-white/8 px-5 py-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="text-[11px] uppercase tracking-[0.24em] text-rose-300/70">PDF Review</p>
						<h3 className="mt-1 font-semibold text-lg">Document review lane</h3>
					</div>
					<Badge variant="secondary">annotations: {visits}</Badge>
				</div>
			</div>
			<div className="grid min-h-0 flex-1 gap-4 overflow-auto p-5">
				<div className="rounded-[24px] border border-rose-300/20 bg-rose-300/10 p-4">
					<p className="font-medium text-sm">Iframe caveat called out in-story</p>
					<p className="mt-2 text-sm leading-6 text-white/72">
						Real Studio or PDF runtime may embed iframe-backed content. Story uses local markup so
						tab switching proves lane routing without fake iframe persistence claims.
					</p>
				</div>
				<div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
					<div className="flex items-center gap-2 text-sm font-medium">
						<FileTextIcon className="size-4 text-rose-300" aria-hidden="true" />
						<span>Review packet</span>
					</div>
					<div className="mt-4 space-y-3 text-sm text-white/72">
						<div className="rounded-2xl bg-black/20 px-3 py-2">
							Page 4: split semantics screenshot
						</div>
						<div className="rounded-2xl bg-black/20 px-3 py-2">Page 7: restore behavior note</div>
						<div className="rounded-2xl bg-black/20 px-3 py-2">
							Page 9: runtime bridge follow-up
						</div>
					</div>
				</div>
				<div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
					<div>
						<p className="font-medium text-sm">Annotation proof</p>
						<p className="text-xs text-white/55">
							Local counter shows subtree persistence after reparent.
						</p>
					</div>
					<Button size="sm" onClick={onAddAnnotation}>
						Add annotation
					</Button>
				</div>
			</div>
		</div>
	)
}

function ReviewUtilityCard() {
	return (
		<div className="space-y-3">
			<UtilityCard
				title="Review queue"
				icon={<MessageSquareIcon className="size-4 text-sky-300" aria-hidden="true" />}
				description="Utility panel keeps operational tools visible while doc lane holds long-form content."
			/>
			<div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-white/70">
				Ready checks
				<br />- Browser proof capture
				<br />- Story source lint/type
				<br />- Task 6 manual follow-up
			</div>
		</div>
	)
}

function BrowserUtilityCard() {
	return (
		<div className="space-y-3">
			<UtilityCard
				title="Browser tools"
				icon={<PanelRightIcon className="size-4 text-sky-300" aria-hidden="true" />}
				description="Secondary utility tab proves utility lane can change without touching active document subtree."
			/>
			<div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-white/70">
				Current URL
				<br />
				http://localhost:20883/storybook/palot-proof
				<br />
				Status: mock safe surface
			</div>
		</div>
	)
}

function UtilityCard({
	title,
	icon,
	description,
}: {
	title: string
	icon: ReactNode
	description: string
}) {
	return (
		<div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
			<div className="flex items-center gap-2 text-sm font-medium">
				{icon}
				<span>{title}</span>
			</div>
			<p className="mt-2 text-sm leading-6 text-white/70">{description}</p>
		</div>
	)
}

function MiniPanel({
	title,
	icon,
	children,
}: {
	title: string
	icon: ReactNode
	children: ReactNode
}) {
	return (
		<div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
			<div className="flex items-center gap-2 text-sm font-medium">
				{icon}
				<span>{title}</span>
			</div>
			<div className="mt-3 text-sm leading-6 text-white/70">{children}</div>
		</div>
	)
}

function ClosedPanePlaceholder({ title, description }: { title: string; description: string }) {
	return (
		<div className="flex h-full items-center justify-center bg-[#111111] px-8 text-center text-sm text-white/55">
			<div>
				<p className="font-medium text-white">{title}</p>
				<p className="mt-2 max-w-xs leading-6">{description}</p>
			</div>
		</div>
	)
}
