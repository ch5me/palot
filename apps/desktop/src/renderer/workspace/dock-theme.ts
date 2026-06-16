import { WS_TOKENS } from "@ch5me/workspace"
import { themeDark, themeLight } from "dockview-react"
import type { CSSProperties } from "react"

/**
 * Dockview theme token objects, vendored from the `@ch5me/workspace`
 * `SplitDockExample` story (the package exports no dock component — see the
 * migration plan §3 "COPY, do not import"). We layer a smooth tab animation on
 * top of Dockview's built-in dark/light base themes and adapt the visual tokens
 * to palot's `WS_TOKENS`.
 */
export const dockDarkTheme = {
	...themeDark,
	tabAnimation: "smooth" as const,
}

export const dockLightTheme = {
	...themeLight,
	tabAnimation: "smooth" as const,
}

/** Pick the Dockview theme object for the active color scheme. */
export function getDockTheme(isDarkMode: boolean) {
	return isDarkMode ? dockDarkTheme : dockLightTheme
}

/** Dockview theme CSS class for the active color scheme (wraps each zone frame). */
export function getDockThemeClass(isDarkMode: boolean): string {
	return isDarkMode ? "dockview-theme-dark" : "dockview-theme-light"
}

/**
 * Global CSS that maps Dockview's CSS custom properties onto palot's workspace
 * tokens so the dock chrome (tabs, separators, scrollbars) matches the rest of
 * the app. Injected once by `DockShell` via a `<style>` element. Mirrors the
 * story's `agentDetailDockviewCss`, scoped to the palot dock class.
 */
export const DOCK_THEME_CSS = `
	.palot-dock .dv-tabs-and-actions-container,
	.palot-dock .dv-tab {
		font-family: var(--ws-font-mono);
	}

	.palot-dock {
		height: 100%;
		width: 100%;
		--dv-background-color: var(--ws-panel);
		--dv-paneview-active-outline-color: var(--ws-accent);
		--dv-tabs-and-actions-container-background-color: var(--ws-panel);
		--dv-activegroup-visiblepanel-tab-background-color: var(--ws-panel-raised);
		--dv-activegroup-hiddenpanel-tab-background-color: var(--ws-panel);
		--dv-inactivegroup-visiblepanel-tab-background-color: var(--ws-panel-muted);
		--dv-inactivegroup-hiddenpanel-tab-background-color: var(--ws-panel);
		--dv-activegroup-visiblepanel-tab-color: var(--ws-text-primary);
		--dv-activegroup-hiddenpanel-tab-color: var(--ws-text-secondary);
		--dv-inactivegroup-visiblepanel-tab-color: var(--ws-text-primary);
		--dv-inactivegroup-hiddenpanel-tab-color: var(--ws-text-secondary);
		--dv-separator-border: var(--ws-border);
		--dv-tabs-container-scrollbar-color: var(--ws-text-muted);
	}
`

/** Frame wrapping a single Dockview zone instance (full-size, clipped). */
export const dockZoneFrameStyle: CSSProperties = {
	height: "100%",
	minHeight: 0,
	minWidth: 0,
	overflow: "hidden",
	position: "relative",
	width: "100%",
}

/** Empty-zone watermark placeholder style (drag target hint). */
export const dockEmptyPlaceholderStyle: CSSProperties = {
	alignItems: "center",
	background: WS_TOKENS.canvas,
	boxSizing: "border-box",
	color: WS_TOKENS.textSecondary,
	display: "flex",
	flexDirection: "column",
	fontFamily: WS_TOKENS.fontMono,
	fontSize: 11,
	height: "100%",
	justifyContent: "center",
	padding: 16,
}

export const dockEmptyTitleStyle: CSSProperties = {
	color: WS_TOKENS.textPrimary,
	fontWeight: 700,
	marginBottom: 10,
}

export const dockEmptyLineStyle: CSSProperties = {
	background: WS_TOKENS.borderStrong,
	borderRadius: 999,
	height: 8,
	width: 150,
}
