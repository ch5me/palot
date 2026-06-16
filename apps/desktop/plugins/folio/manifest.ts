/**
 * Folio — first-party Firefly plugin (the FIRST nav-sidebar workspace).
 *
 * Where surface plugins (notes, browser, …) contribute right-side panels,
 * Folio contributes a left-rail *workspace*: its own nav-sidebar body via
 * `contributes.navSidebars`. It is the proving ground for the V2
 * `navSidebars` contribution family — the rail is now catalog-driven, so
 * Folio's tab, icon, and body all project from THIS manifest exactly the
 * way panels project from theirs. Built-ins keep TS manifests (the
 * manifest is code); third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * Folio's own "pages" are separate panel registrations scoped to this
 * workspace (see `contributes.panels` + the `workspace` field); they show
 * as side-panel tabs only while the Folio rail is active.
 */

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const folioPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.folio",
	displayName: "Folio",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Folio workspace: a dedicated left-rail nav sidebar with its own pages, kept separate from the default Palot sessions workspace.",
	license: "MIT",
	manifestRevision: 1,
	engines: {},
	trust: "built-in",
	lifecycle: {
		autoEnable: true,
		keepAliveAcrossSessions: false,
		quarantineOnCrashCount: 3,
	},
	// Folio is autoEnable; `onStartup` keeps the rail tab present immediately,
	// and `onNavSidebarOpen` activates it on selection (mirrors `onPanelOpen`).
	activationEvents: [{ kind: "onStartup" }, { kind: "onNavSidebarOpen", navSidebarId: "folio" }],
	contributes: {
		panels: [
			{
				id: "folio-library",
				title: "Library",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				workspace: "firefly.folio.folio",
				icon: "library",
				defaultOn: true,
				commandIds: [],
				availability: { requires: ["host:panel.register"] },
				render: { mode: "host-reconciler" },
			},
			{
				id: "folio-collections",
				title: "Collections",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				workspace: "firefly.folio.folio",
				icon: "boxes",
				defaultOn: true,
				commandIds: [],
				availability: { requires: ["host:panel.register"] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [
			{
				id: "folio",
				title: "Folio",
				icon: "library",
				order: 10,
				defaultOn: true,
				commandIds: [],
				persistenceKey: "nav-sidebar.folio",
				telemetryNamespace: "firefly.nav.folio",
				availability: { requires: ["host:nav-sidebar.register"] },
				render: { mode: "host-reconciler" },
			},
		],
		widgets: [],
		commands: [],
		themes: [],
		components: [],
		tools: [],
		snippets: [],
		languages: [],
		grammars: [],
		iconThemes: [],
	},
	capabilities: ["host:nav-sidebar.register", "host:panel.register"],
	tags: ["nav-sidebar", "workspace", "folio", "first-party"],
}

export const FOLIO_PLUGIN_ID = folioPluginManifest.id
export const FOLIO_NAV_SIDEBAR_PROJECTED_ID = `${folioPluginManifest.id}.folio`
