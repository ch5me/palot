import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"

import type { ProjectedSidePanel } from "../shared/firefly-plugin/renderer-projection"
import type {
	WorkspaceHostPolicy,
	WorkspaceMultiplicityPolicy,
} from "../shared/workspace-contract"

export type HostRenderMode = ProjectedSidePanel["renderMode"]

export type WorkspaceRenderableLogicalKind = "firefly-surface" | "session-widget"

export interface ResolvedReactRuntime<Props extends object> {
	Component: ComponentType<Props>
	props: Props
}

export interface ReactHostComponentEntrypoint<Context> {
	kind: "react-host-component"
	renderMode: "host-reconciler"
	resolve: (ctx: Context) => ResolvedReactRuntime<object>
}

export interface PluginCatalogEntrypoint {
	kind: "plugin-catalog-entrypoint"
	renderMode: HostRenderMode
	pluginId: string
	projectedId: string
}

export type HostRuntimeEntrypoint<Context> =
	| ReactHostComponentEntrypoint<Context>
	| PluginCatalogEntrypoint

export interface DescriptorPresentationAdapters<Context, Availability> {
	getTitle: (ctx: Context) => string
	getIcon: (ctx: Context) => LucideIcon
	getAvailability: (ctx: Context) => Availability
}

export interface DescriptorHostPolicy<ZoneId extends string> {
	logicalKind: WorkspaceRenderableLogicalKind
	defaultZoneId: ZoneId
	hostPolicy: WorkspaceHostPolicy
	multiplicityPolicy: WorkspaceMultiplicityPolicy
}

export interface WorkspaceHostDescriptor<Id extends string, ZoneId extends string, Context, Availability> {
	id: Id
	hostPolicy: DescriptorHostPolicy<ZoneId>
	presentation: DescriptorPresentationAdapters<Context, Availability>
	runtime: HostRuntimeEntrypoint<Context>
}

export interface NormalizedWorkspaceDescriptor<
	Id extends string,
	ZoneId extends string,
	Availability,
	Runtime,
	Target,
> {
	id: Id
	title: string
	icon: LucideIcon
	availability: Availability
	hostPolicy: DescriptorHostPolicy<ZoneId>
	runtime: Runtime
	target: Target
	commandIds: readonly string[]
	persistenceKey: string
	telemetryNamespace: string
}
