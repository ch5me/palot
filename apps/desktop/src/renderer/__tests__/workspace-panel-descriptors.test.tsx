import { describe, expect, mock, test } from "bun:test"

mock.module("../lib/monaco", () => ({
	initMonaco: () => ({}),
	languageForPath: () => "plaintext",
}))

import { PANEL_CONTRACT } from "../../shared/firefly-plugin/family-contracts"
import type { ProjectedSidePanel } from "../../shared/firefly-plugin/renderer-projection"
import type { Agent } from "../lib/types"

const { catalogPanelToTabDescriptor, resolveCatalogSurfaceDescriptor } = await import(
	"../firefly-plugin-surface-merge"
)
const {
	FIREFLY_SURFACE_REGISTRY_BY_ID,
	resolveFireflySurfaceDescriptor,
} = await import("../firefly-surface-registry")
const { resolveSessionWidgetDescriptor, SESSION_WIDGET_REGISTRY } = await import(
	"../session-widget-registry"
)

interface FireflySurfaceContext {
	agent: Agent
	diffStats: {
		additions: number
		deletions: number
		fileCount: number
	}
	flags: Record<string, boolean>
	chatTurnCount?: number
}

const now = 1_717_171_717_000

const agent: Agent = {
	id: "agent-1",
	name: "Agent 1",
	status: "running",
	isAttached: true,
	presenceSource: "attach",
	visibilityReason: "visible",
	driftFlags: [],
	environment: "local",
	project: "palot",
	projectSlug: "palot",
	sessionId: "ses_123",
	directory: "/tmp/project",
	projectDirectory: "/tmp/project",
	branch: "main",
	duration: "1m",
	activities: [],
	permissions: [],
	questions: [],
	createdAt: now,
	lastActiveAt: now,
	lastContentActivityAt: now,
	childSessionIds: [],
}

const fireflyCtx: FireflySurfaceContext = {
	agent,
	diffStats: {
		additions: 3,
		deletions: 1,
		fileCount: 1,
	},
	flags: {
		review: true,
		browserPanelEnabled: true,
		pulse: true,
		artifacts: true,
		memory: true,
		files: true,
		terminal: true,
		editor: true,
		plugins: true,
		bridges: true,
		crm: true,
		studio: true,
		voice: true,
		oracle: true,
		claude: true,
		ch5pm: true,
		pdfReview: true,
	},
	chatTurnCount: 2,
}

function projectedPanel(): ProjectedSidePanel {
	return {
		family: "panels",
		pluginId: "firefly.built-in.surface.notes",
		contributionId: "notes",
		projectedId: "firefly.built-in.surface.notes.notes",
		title: "Notes",
		icon: "book-text",
		formFactor: "side-panel-tab",
		hostSlot: "side-panel",
		hostTarget: { kind: "side-panel", slot: "side-panel" },
		defaultOn: true,
		commandIds: ["open-notes"],
		persistenceKey: "side-panel.notes",
		telemetryNamespace: "firefly.surface.notes",
		renderMode: "host-reconciler",
		declarativeSchemaRef: null,
		iframeSandbox: null,
		capabilityGates: [],
		availability: { available: true, state: "ready", reason: null },
		contract: PANEL_CONTRACT,
	}
}

describe("workspace descriptor normalization", () => {
	test("built-in surface resolves normalized host metadata", () => {
		const descriptor = resolveFireflySurfaceDescriptor(
			FIREFLY_SURFACE_REGISTRY_BY_ID.review,
			fireflyCtx,
		)
		expect(descriptor.id).toBe("review")
		expect(descriptor.hostPolicy).toEqual({
			logicalKind: "firefly-surface",
			defaultZoneId: "side-panel",
			hostPolicy: "stable",
			multiplicityPolicy: "singleton",
		})
		expect(descriptor.runtime.kind).toBe("react-host-component")
		expect(descriptor.target).toEqual({
			kind: "logical-panel",
			logicalPanelId: "review",
			preferredZoneId: "side-panel",
			action: "reveal-preferred-zone",
			focusAuthorityOwner: "workspace",
			legacySidePanelTabId: "review",
		})
	})

	test("catalog surface resolves normalized host metadata", () => {
		const tabDescriptor = catalogPanelToTabDescriptor(projectedPanel())
		if (!tabDescriptor) throw new Error("expected catalog descriptor")
		const descriptor = resolveCatalogSurfaceDescriptor(
			tabDescriptor,
			() => FIREFLY_SURFACE_REGISTRY_BY_ID.review.descriptor.presentation.getIcon(fireflyCtx),
		)
		expect(descriptor.id).toBe("notes")
		expect(descriptor.hostPolicy).toEqual({
			logicalKind: "firefly-surface",
			defaultZoneId: "side-panel",
			hostPolicy: "stable",
			multiplicityPolicy: "singleton",
		})
		expect(descriptor.runtime.kind).toBe("plugin-catalog-entrypoint")
	})

	test("session widget resolves descriptor-backed host metadata", () => {
		const descriptor = resolveSessionWidgetDescriptor(
			SESSION_WIDGET_REGISTRY["session-task-list"],
			{ agent },
		)
		expect(descriptor.hostPolicy).toEqual({
			logicalKind: "session-widget",
			defaultZoneId: "above-chat",
			hostPolicy: "stable",
			multiplicityPolicy: "singleton",
		})
		expect(descriptor.runtime.kind).toBe("react-host-component")
	})
})
