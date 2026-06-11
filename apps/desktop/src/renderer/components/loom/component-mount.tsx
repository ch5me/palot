import { Progress } from "@ch5me/elf-ui/components/progress"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { useAtomValue } from "jotai"
import { memo, type ComponentType } from "react"
import type { ProjectedComponent } from "../../../shared/firefly-plugin"
import type { GenUiEntry } from "../../genui/registry"
import { parseGenUiProps, resolveGenUiEntry } from "../../genui/registry"
import { loomAcmeComponentsAtom, loomV2ComponentsAtom } from "../../atoms/feature-flags"

interface LoomComponentMountProps {
	componentId: string
	props: Record<string, unknown>
	projectedComponent?: ProjectedComponent | null
}

function LoyaltyProgressBar({
	label,
	value,
	max,
	tier,
	helpText,
}: {
	label: string
	value: number
	max?: number
	tier?: "bronze" | "silver" | "gold"
	helpText?: string
}) {
	const safeMax = max && max > 0 ? max : 100
	const percent = Math.max(0, Math.min(100, (value / safeMax) * 100))
	const toneClass =
		tier === "gold"
			? "from-amber-100 via-amber-50 to-white border-amber-300/70"
			: tier === "bronze"
				? "from-orange-100 via-orange-50 to-white border-orange-300/70"
				: "from-sky-100 via-sky-50 to-white border-sky-300/70"
	return (
		<section className={cn("my-2 w-full max-w-[420px] rounded-2xl border bg-gradient-to-br p-4 shadow-sm", toneClass)}>
			<div className="space-y-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Acme</p>
						<h3 className="text-base font-semibold text-foreground">{label}</h3>
					</div>
					<p className="rounded-full border border-foreground/10 bg-background/70 px-2 py-1 text-xs font-medium text-foreground">
						{Math.round(percent)}%
					</p>
				</div>
				<Progress value={percent} className="h-3" />
				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<span>
						{value} / {safeMax}
					</span>
					<span className="capitalize">{tier ?? "silver"} tier</span>
				</div>
				{helpText ? <p className="text-sm text-muted-foreground">{helpText}</p> : null}
			</div>
		</section>
	)
}

function getBuiltInEntry(componentId: string): GenUiEntry | undefined {
	return resolveGenUiEntry(componentId)
}

function getProjectedComponentEntry(componentId: string): ComponentType<Record<string, unknown>> | null {
	if (componentId !== "acme.loyalty_progress_bar") return null
	return LoyaltyProgressBar as ComponentType<Record<string, unknown>>
}

function LoomComponentMountImpl({ componentId, props, projectedComponent }: LoomComponentMountProps) {
	const v2ComponentsEnabled = useAtomValue(loomV2ComponentsAtom)
	const acmeComponentsEnabled = useAtomValue(loomAcmeComponentsAtom)

	if (!v2ComponentsEnabled) {
		return null
	}

	const builtInEntry = getBuiltInEntry(componentId)
	if (builtInEntry) {
		const parsed = parseGenUiProps(builtInEntry, props)
		if (!parsed.ok) {
			return <ComponentMountError message={`${builtInEntry.name}: ${parsed.error}`} />
		}
		const Component = builtInEntry.Component as ComponentType<Record<string, unknown>>
		return <Component {...parsed.props} />
	}

	if (!projectedComponent) {
		return <ComponentMountError message={`Unknown Loom component: ${componentId}`} />
	}
	if (!projectedComponent.availability.available) {
		return (
			<ComponentMountError
				message={projectedComponent.availability.reason?.message ?? `Component unavailable: ${componentId}`}
			/>
		)
	}
	if (componentId === "acme.loyalty_progress_bar" && !acmeComponentsEnabled) {
		return null
	}
	const Component = getProjectedComponentEntry(componentId)
	if (!Component) {
		return <ComponentMountError message={`No host renderer for ${componentId}`} />
	}
	return <Component {...props} />
}

function ComponentMountError({ message }: { message: string }) {
	return (
		<div className="my-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
			{message}
		</div>
	)
}

export const LoomComponentMount = memo(LoomComponentMountImpl)
