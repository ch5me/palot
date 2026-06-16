/**
 * Firefly Plugin System V2 — Index barrel
 *
 * The manifest schema is the canonical source of truth; the descriptor is
 * the validated, normalized form projections read from. This barrel
 * re-exports the public surface so host code can import everything from
 * one path.
 */

export * from "./manifest"
export * from "./json-manifest"
export * from "./descriptor"
export * from "./capabilities"
export * from "./tool-projection"
export {
	commandPlacementSurfaceSchema,
	type CommandPlacementSurface,
} from "./family-contracts"
export * from "./hot-reload"
export * from "./runtime-supervision"
export * from "./palot-bridge-manifest"
// memory-surface-manifest removed — memory surface is a full plugin at plugins/memory/; shim deleted 2026-06-16.
export * from "./api-versioning"
export * from "./bridge-projection"
export * from "./component-zod"
export {
	projectSidePanelsFromCatalog,
	projectSessionWidgetsFromCatalog,
	projectCommandsFromCatalog,
	projectThemesFromCatalog,
	projectComponentsFromCatalog,
	projectRendererFamiliesFromCatalog,
	defaultCapabilityState,
	getProjectedCommandId,
	getProjectedWidgetId,
	getProjectedPanelId,
	getProjectedThemeId,
	getProjectedComponentId,
	RENDERER_PROJECTION_FAMILIES,
	type RendererProjectionFamily,
	type RendererContributionState,
	type RendererAvailabilityReasonCode,
	type RendererAvailabilityReason,
	type RendererAvailability,
	type RendererCapabilityGate,
	type RendererProjectionResult,
	type CapabilityStateShape,
	type ProjectionCollision,
	type ProjectedComponent,
} from "./renderer-projection"
export * from "./theme-pipeline"
export * from "./storage-scopes"
export {
	COMMAND_PLACEMENT_SURFACES,
	projectCommand,
	projectAllCommands,
	projectCommandsBySurface,
	projectCommandsByCategory,
	evaluateCommandWhen,
	RESERVED_COMMAND_PREFIXES,
	commandWhenContextSchema,
	commandPlacementSurfaceSchema as commandPlacementSurfaceSchemaFromProjection,
	type CommandPlacementSurface as CommandPlacementSurfaceFromProjection,
	type CommandWhenContext,
	type CommandCollision,
	type ProjectedCommand as ProjectedCommandFromProjection,
} from "./command-projection"
export * from "./first-party-migration"
export * from "./bridge-migration"
export * from "./acme-notebook-exemplar"
export * from "./vscode-import"
export * from "./operator-surface"
