import { Badge, Button } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
	CheckCircle2Icon,
	DownloadIcon,
	GlobeIcon,
	HardDriveIcon,
	LaptopIcon,
	PackageCheckIcon,
	RadarIcon,
	RouteIcon,
	ServerIcon,
	ShieldCheckIcon,
	TerminalIcon,
	TriangleAlertIcon,
} from "lucide-react"
import type { ComponentType, ReactNode } from "react"

const meta = {
	title: "AI Elements/Launch/OpenCode Setup Flow",
	parameters: {
		layout: "fullscreen",
	},
	render: () => <OpenCodeSetupFlowStory />,
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const AlphaDecisionBoard: Story = {}

const CURRENT_STEPS = [
	{
		label: "Welcome",
		detail: "Explains Elf as the desktop control plane.",
		status: "done",
	},
	{
		label: "Environment Check",
		detail: "Today: looks for host `opencode`, checks version, offers curl install.",
		status: "risk",
	},
	{
		label: "Provider Setup",
		detail: "Detects existing Claude Code, Cursor, and OpenCode config for migration.",
		status: "done",
	},
	{
		label: "Complete",
		detail: "Finishes onboarding and lets migration run as an optional detour.",
		status: "done",
	},
]

const TARGET_STEPS = [
	{
		label: "Runtime Choice",
		detail: "Prefer bundled portable OpenCode, but surface host and remote choices.",
		status: "new",
	},
	{
		label: "Local Scan",
		detail: "Probe common ports, lockfile, PATH binary, and mDNS peers.",
		status: "new",
	},
	{
		label: "Connect or Start",
		detail: "Attach to selected server or boot bundled runtime in app-owned state.",
		status: "new",
	},
	{
		label: "Provider Setup",
		detail: "Then configure auth and migrate settings once runtime is known.",
		status: "same",
	},
]

const SERVER_OPTIONS = [
	{
		name: "Bundled runtime",
		type: "managed-bundled",
		url: "127.0.0.1:14096",
		detail: "Shipped in the DMG as portable-opencode; default for alpha.",
		icon: PackageCheckIcon,
		state: "Recommended",
	},
	{
		name: "Existing OpenCode",
		type: "local-existing",
		url: "127.0.0.1:4096",
		detail: "Same-user listener found; attach without stealing lifecycle.",
		icon: TerminalIcon,
		state: "Detected",
	},
	{
		name: "Network peer",
		type: "remote-mdns",
		url: "studio-mac.local:14096",
		detail: "Discovered over mDNS and saved as a remote server.",
		icon: RadarIcon,
		state: "Optional",
	},
	{
		name: "Manual remote",
		type: "remote-url",
		url: "https://opencode.example.com",
		detail: "Advanced URL, auth, and later SSH tunnel path.",
		icon: GlobeIcon,
		state: "Advanced",
	},
]

const PACKAGING_ROWS = [
	["macOS alpha", "Native portable-opencode sidecar in Electron extraResources", "Ready primitive"],
	["Linux", "Same native bundle shape; AppImage/deb/rpm package it", "Mostly same"],
	["Windows", "Prefer native when possible; container runtime is fallback", "Needs design"],
	[
		"Container",
		"GHCR portable-opencode image already has CI smoke path",
		"Useful for remote/Windows",
	],
]

function OpenCodeSetupFlowStory() {
	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_12%_10%,rgba(14,165,233,0.18),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(245,158,11,0.16),transparent_30%),linear-gradient(145deg,#07111f,#101827_46%,#18130b)] p-8 text-foreground">
			<div className="mx-auto flex max-w-7xl flex-col gap-7">
				<header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur-xl md:flex-row md:items-end md:justify-between">
					<div className="max-w-3xl">
						<Badge variant="secondary" className="mb-4 w-fit bg-sky-400/15 text-sky-100">
							Alpha launch setup
						</Badge>
						<h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
							One DMG. One runtime decision. No terminal prerequisite.
						</h1>
						<p className="mt-4 text-base leading-7 text-slate-300">
							Current onboarding still asks users to install host OpenCode. The alpha path should
							ship portable OpenCode inside Elf, detect existing servers, and let the app choose
							which local or remote runtime it owns.
						</p>
					</div>
					<div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
						<Metric label="Current default" value="host opencode" tone="warn" />
						<Metric label="Alpha default" value="bundled sidecar" tone="good" />
						<Metric label="Server model" value="single active, many saved" tone="info" />
					</div>
				</header>

				<div className="grid gap-7 lg:grid-cols-[1fr_1.1fr]">
					<FlowCard title="What exists today" icon={LaptopIcon}>
						<StepList steps={CURRENT_STEPS} />
					</FlowCard>
					<FlowCard title="What alpha should show first" icon={RouteIcon} accent>
						<StepList steps={TARGET_STEPS} />
					</FlowCard>
				</div>

				<FlowCard title="Runtime picker state" icon={ServerIcon} accent>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						{SERVER_OPTIONS.map((option) => (
							<ServerOptionCard key={option.type} option={option} />
						))}
					</div>
				</FlowCard>

				<div className="grid gap-7 xl:grid-cols-[1.1fr_0.9fr]">
					<FlowCard title="Packaging status" icon={DownloadIcon}>
						<div className="overflow-hidden rounded-2xl border border-white/10">
							{PACKAGING_ROWS.map(([platform, plan, status], index) => (
								<div
									key={platform}
									className="grid gap-3 border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300 md:grid-cols-[140px_1fr_140px]"
									style={{ borderTopWidth: index === 0 ? 0 : 1 }}
								>
									<span className="font-medium text-white">{platform}</span>
									<span>{plan}</span>
									<span className="text-sky-200">{status}</span>
								</div>
							))}
						</div>
					</FlowCard>

					<FlowCard title="Data model gap" icon={HardDriveIcon}>
						<div className="space-y-4 text-sm text-slate-300">
							<p>
								Today `LocalServerConfig` only stores hostname, port, password, and mDNS. It cannot
								say whether local means bundled, host-installed, container, or attach-only.
							</p>
							<div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
								<p className="flex items-center gap-2 font-medium text-amber-100">
									<TriangleAlertIcon aria-hidden="true" className="size-4" />
									Add runtime source fields before changing onboarding
								</p>
								<p className="mt-2 text-amber-100/75">
									`runtimeKind`, `binaryPath`, `runtimeRoot`, `containerImage`, `ownership`,
									`health`, and `lastSeen` are the missing alpha concepts.
								</p>
							</div>
						</div>
					</FlowCard>
				</div>
			</div>
		</div>
	)
}

function FlowCard({
	title,
	icon: Icon,
	accent = false,
	children,
}: {
	title: string
	icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
	accent?: boolean
	children: ReactNode
}) {
	return (
		<section
			className={`rounded-[1.75rem] border p-6 shadow-2xl backdrop-blur-xl ${
				accent ? "border-sky-300/20 bg-sky-200/[0.08]" : "border-white/10 bg-white/[0.055]"
			}`}
		>
			<div className="mb-5 flex items-center gap-3">
				<div className="flex size-10 items-center justify-center rounded-2xl bg-white/10 text-sky-100">
					<Icon aria-hidden className="size-5" />
				</div>
				<h2 className="text-lg font-semibold text-white">{title}</h2>
			</div>
			{children}
		</section>
	)
}

function StepList({ steps }: { steps: Array<{ label: string; detail: string; status: string }> }) {
	return (
		<div className="space-y-3">
			{steps.map((step) => (
				<div
					key={step.label}
					className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
				>
					<StatusIcon status={step.status} />
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<p className="font-medium text-white">{step.label}</p>
							<Badge
								variant="secondary"
								className="bg-white/10 text-[10px] uppercase text-slate-200"
							>
								{step.status}
							</Badge>
						</div>
						<p className="mt-1 text-sm leading-6 text-slate-300">{step.detail}</p>
					</div>
				</div>
			))}
		</div>
	)
}

function ServerOptionCard({
	option,
}: {
	option: {
		name: string
		type: string
		url: string
		detail: string
		icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
		state: string
	}
}) {
	const Icon = option.icon
	return (
		<div className="flex min-h-[220px] flex-col justify-between rounded-3xl border border-white/10 bg-black/25 p-5">
			<div>
				<div className="mb-4 flex items-center justify-between gap-3">
					<div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-sky-100">
						<Icon aria-hidden className="size-5" />
					</div>
					<Badge variant="secondary" className="bg-slate-100/10 text-slate-100">
						{option.state}
					</Badge>
				</div>
				<p className="text-base font-semibold text-white">{option.name}</p>
				<p className="mt-1 font-mono text-xs text-sky-200">{option.url}</p>
				<p className="mt-3 text-sm leading-6 text-slate-300">{option.detail}</p>
			</div>
			<Button className="mt-5 w-full justify-center" variant="outline">
				Select {option.name}
			</Button>
		</div>
	)
}

function StatusIcon({ status }: { status: string }) {
	if (status === "done" || status === "same") {
		return (
			<CheckCircle2Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-300" />
		)
	}
	if (status === "risk") {
		return (
			<TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-300" />
		)
	}
	return <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-300" />
}

function Metric({
	label,
	value,
	tone,
}: {
	label: string
	value: string
	tone: "good" | "warn" | "info"
}) {
	const toneClass = {
		good: "text-emerald-200",
		warn: "text-amber-200",
		info: "text-sky-200",
	}[tone]
	return (
		<div className="grid grid-cols-[110px_1fr] gap-3">
			<span className="text-slate-400">{label}</span>
			<span className={toneClass}>{value}</span>
		</div>
	)
}
