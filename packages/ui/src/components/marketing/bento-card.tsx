"use client"

import { useControllableState } from "@ch5me/elf-ui/hooks/use-controllable-state"
import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import type { Transition } from "motion/react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"
import type { ComponentProps, ReactNode } from "react"
import { useId } from "react"

/**
 * BentoCard — a marketing bento card framing a mock workspace preview: an
 * offset window stage peeks out of the card, and an animated sidebar-tab
 * "workspace" swaps preview panes with a soft blur crossfade.
 *
 * Ported from uselayouts "Bento Card", re-expressed in CH5 semantic motion
 * tokens and design-system tokens. The preview is fully slotted — pass any
 * content to `BentoCard`, and `BentoCardWorkspace` takes its tabs (icon,
 * label, badge, pane content) as typed props, so nothing marketing-specific
 * is baked in.
 *
 * ```tsx
 * <BentoCard eyebrow="Project dashboard" heading="Analytics and collaboration in one place.">
 *   <BentoCardPreview windowTitle="Workspace">
 *     <BentoCardWorkspace
 *       defaultValue="dashboard"
 *       tabs={[
 *         {
 *           value: "dashboard",
 *           label: "Dashboard",
 *           icon: <LayoutDashboardIcon />,
 *           header: "Overview",
 *           description: "Daily summary of activity.",
 *           content: <DashboardMock />,
 *         },
 *         {
 *           value: "threads",
 *           label: "Threads",
 *           icon: <MessageSquareIcon />,
 *           badge: "12",
 *           content: <ThreadsMock />,
 *         },
 *       ]}
 *     />
 *   </BentoCardPreview>
 * </BentoCard>
 * ```
 */

/**
 * Pane swap: source used `duration: 0.3, ease: [0.23, 1, 0.32, 1]` — mapped
 * to the `base` duration token + `iconiqSoft` easing token.
 */
const paneSwapTransition: Transition = {
	duration: durations.base,
	ease: easings.iconiqSoft,
}

interface BentoCardProps extends ComponentProps<"div"> {
	/** Small uppercase kicker above the heading. */
	eyebrow?: ReactNode
	/** Card heading describing the feature this bento showcases. */
	heading?: ReactNode
	/** Preview slot — typically a `BentoCardPreview`. */
	children?: ReactNode
}

function BentoCard({ className, eyebrow, heading, children, ...props }: BentoCardProps) {
	return (
		<div
			data-slot="card"
			className={cn(
				"group/bento-card relative w-full max-w-xl overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--ff-shadow-2xl)] transition-[translate,box-shadow] duration-(--duration-relaxed) ease-(--ease-out) hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:rounded-4xl",
				className,
			)}
			{...props}
		>
			{(eyebrow != null || heading != null) && (
				<div data-slot="bento-card-header" className="relative z-10 space-y-1.5 p-4 sm:p-6">
					{eyebrow != null && (
						<h2 data-slot="bento-card-eyebrow" className="text-xs text-muted-foreground uppercase">
							{eyebrow}
						</h2>
					)}
					{heading != null && (
						<p
							data-slot="bento-card-heading"
							className="max-w-md text-lg leading-snug font-medium text-foreground sm:text-2xl"
						>
							{heading}
						</p>
					)}
				</div>
			)}
			{children}
		</div>
	)
}

interface BentoCardPreviewProps extends ComponentProps<"div"> {
	/** Centered title in the mock window chrome bar. */
	windowTitle?: ReactNode
	/** Window body slot — typically a `BentoCardWorkspace`. */
	children?: ReactNode
}

/**
 * The window stage: a muted backdrop layer offset behind a mock app window
 * (traffic dots + title bar) that bleeds off the card's bottom-right edge.
 */
function BentoCardPreview({
	className,
	windowTitle = "Workspace",
	children,
	...props
}: BentoCardPreviewProps) {
	return (
		<div
			data-slot="bento-card-preview"
			className={cn("relative h-[260px] w-full overflow-hidden sm:h-[300px]", className)}
			{...props}
		>
			<div
				aria-hidden="true"
				data-slot="bento-card-preview-backdrop"
				className="absolute top-16 left-16 h-full w-full rounded-3xl border border-border/50 bg-muted opacity-80"
			/>

			<div
				data-slot="bento-card-preview-window"
				className="absolute top-8 left-24 flex h-full w-full flex-col overflow-hidden rounded-tl-3xl bg-background shadow-[var(--ff-shadow-xl)] ring-6 ring-border"
			>
				<div
					data-slot="bento-card-preview-chrome"
					className="relative flex items-center rounded-tl-3xl border-b border-border/70 px-5 py-4 backdrop-blur-(--blur-sm)"
				>
					<div aria-hidden="true" className="flex gap-1.5">
						<span className="size-2 rounded-full bg-muted-foreground/20" />
						<span className="size-2 rounded-full bg-muted-foreground/20" />
						<span className="size-2 rounded-full bg-muted-foreground/20" />
					</div>
					{windowTitle != null && (
						<span
							data-slot="bento-card-preview-window-title"
							className="absolute left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50 uppercase"
						>
							{windowTitle}
						</span>
					)}
				</div>

				<div className="flex flex-1 overflow-hidden">{children}</div>
			</div>
		</div>
	)
}

interface BentoCardWorkspaceTab {
	/** Stable identifier for this tab. */
	value: string
	/** Sidebar label. */
	label: ReactNode
	/** Leading sidebar icon (lucide-react icon element). */
	icon?: ReactNode
	/** Trailing count/badge in the sidebar row. */
	badge?: ReactNode
	/** Pane heading shown while this tab is active. */
	header?: ReactNode
	/** Supporting copy under the pane heading. */
	description?: ReactNode
	/** Pane content shown while this tab is active. */
	content?: ReactNode
}

interface BentoCardWorkspaceProps extends Omit<ComponentProps<"div">, "children"> {
	tabs: BentoCardWorkspaceTab[]
	/** Controlled active tab value. */
	value?: string
	/** Uncontrolled initial active tab value. Defaults to the first tab. */
	defaultValue?: string
	onValueChange?: (value: string) => void
	/** Extra classes for the sidebar (tablist) column. */
	listClassName?: string
	/** Extra classes for the content pane. */
	paneClassName?: string
}

/**
 * The mock workspace: a sidebar tab rail with a shared active-row surface +
 * accent rail (layoutId, `indicator` spring) driving a content pane that
 * crossfades panes with a vertical drift and soft blur.
 */
function BentoCardWorkspace({
	className,
	tabs,
	value: valueProp,
	defaultValue,
	onValueChange,
	listClassName,
	paneClassName,
	...props
}: BentoCardWorkspaceProps) {
	const reducedMotion = useReducedMotion()
	const baseId = useId()
	const [value, setValue] = useControllableState({
		prop: valueProp,
		defaultProp: defaultValue ?? tabs[0]?.value ?? "",
		onChange: onValueChange,
	})

	const activeTab = tabs.find((tab) => tab.value === value) ?? tabs[0]
	if (!activeTab) return null

	// Shared active-row surface + rail ride the semantic indicator spring.
	const indicatorTransition: Transition = reducedMotion
		? reducedMotionTransition
		: semanticTransitions.indicator

	const paneId = `${baseId}-pane`
	const tabId = (tabValue: string) => `${baseId}-tab-${tabValue}`

	return (
		<div
			data-slot="bento-card-workspace"
			className={cn("flex flex-1 overflow-hidden", className)}
			{...props}
		>
			<div
				role="tablist"
				aria-orientation="vertical"
				data-slot="bento-card-workspace-list"
				className={cn(
					"flex w-40 flex-col gap-1 border-r border-border/30 bg-muted/5 p-2 pt-6",
					listClassName,
				)}
			>
				<LayoutGroup>
					{tabs.map((tab) => {
						const isActive = tab.value === activeTab.value
						return (
							<button
								key={tab.value}
								type="button"
								role="tab"
								id={tabId(tab.value)}
								aria-selected={isActive}
								aria-controls={paneId}
								data-slot="bento-card-workspace-trigger"
								data-active={isActive ? "" : undefined}
								onClick={() => setValue(tab.value)}
								className="relative flex cursor-pointer items-center gap-1.5 rounded-xl p-2 text-xs outline-none transition-colors duration-(--duration-fast) ease-(--ease-out) focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none data-active:text-foreground [&:not([data-active])]:text-muted-foreground [&:not([data-active])]:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"
							>
								{tab.icon != null && (
									<span
										aria-hidden="true"
										data-slot="bento-card-workspace-trigger-icon"
										className="relative z-20 flex shrink-0 items-center justify-center"
									>
										{tab.icon}
									</span>
								)}
								<span className="relative z-20 truncate font-medium">{tab.label}</span>
								{tab.badge != null && (
									<span
										data-slot="bento-card-workspace-trigger-badge"
										className={cn(
											"relative z-20 ml-auto rounded-md border px-1 py-0.5 text-xs leading-none tabular-nums transition-colors duration-(--duration-fast) ease-(--ease-out) motion-reduce:transition-none",
											isActive
												? "border-primary/20 bg-primary/10 text-primary"
												: "border-transparent bg-muted text-muted-foreground",
										)}
									>
										{tab.badge}
									</span>
								)}

								{isActive && (
									<motion.span
										aria-hidden="true"
										layoutId={`${baseId}-active-rail`}
										data-slot="bento-card-workspace-trigger-rail"
										className="absolute left-0 z-30 h-4 w-0.5 rounded-full bg-primary"
										transition={indicatorTransition}
									/>
								)}
								{isActive && (
									<motion.span
										aria-hidden="true"
										layoutId={`${baseId}-active-surface`}
										data-slot="bento-card-workspace-trigger-surface"
										className="absolute inset-0 z-10 rounded-lg border border-border/40 bg-muted"
										transition={indicatorTransition}
									/>
								)}
							</button>
						)
					})}
				</LayoutGroup>
			</div>

			<div
				role="tabpanel"
				id={paneId}
				aria-labelledby={tabId(activeTab.value)}
				data-slot="bento-card-workspace-pane"
				className={cn(
					"relative flex flex-1 flex-col gap-4 overflow-hidden bg-background p-5 pt-6",
					paneClassName,
				)}
			>
				{(activeTab.header != null || activeTab.description != null) && (
					<header className="flex flex-col gap-0.5">
						{activeTab.header != null && (
							<h3
								data-slot="bento-card-workspace-pane-header"
								className="line-clamp-1 text-xs font-semibold tracking-tight text-foreground uppercase opacity-60"
							>
								{activeTab.header}
							</h3>
						)}
						{activeTab.description != null && (
							<p
								data-slot="bento-card-workspace-pane-description"
								className="line-clamp-1 text-xs leading-tight font-normal text-muted-foreground"
							>
								{activeTab.description}
							</p>
						)}
					</header>
				)}

				<AnimatePresence mode="popLayout" initial={false}>
					<motion.div
						key={activeTab.value}
						initial={reducedMotion ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						exit={reducedMotion ? undefined : { opacity: 0, y: -8, filter: "blur(4px)" }}
						transition={reducedMotion ? reducedMotionTransition : paneSwapTransition}
						data-slot="bento-card-workspace-pane-content"
						className="flex-1"
					>
						{activeTab.content}
					</motion.div>
				</AnimatePresence>

				<div
					aria-hidden="true"
					data-slot="bento-card-workspace-scrim"
					className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-10 bg-linear-to-t from-background to-transparent"
				/>
			</div>
		</div>
	)
}

export type {
	BentoCardPreviewProps,
	BentoCardProps,
	BentoCardWorkspaceProps,
	BentoCardWorkspaceTab,
}
export { BentoCard, BentoCardPreview, BentoCardWorkspace }
