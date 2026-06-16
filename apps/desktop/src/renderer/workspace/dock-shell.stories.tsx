/**
 * Regression story: dock panel move/reveal MUST NOT remount the surface.
 *
 * Core invariant: heavy content lives exactly once in the hidden host layer
 * (via ReversePortalTransport InPortal). Dock panels are lightweight slots that
 * attach/detach. A tab switch or zone change must never recreate the host.
 *
 * Proof mechanism:
 *   Each test surface captures a STABLE mount token via `useState(() => …)`.
 *   The token is initialised once on mount and displayed as `data-testid`.
 *   If the token changes the host remounted — the invariant is broken.
 *
 * Play function:
 *   - Reads the mount token from surface A.
 *   - Activates/deactivates panels via the captured DockviewApi (tab switch).
 *   - Asserts the token is unchanged after each operation.
 *
 * Cross-zone drag:
 *   Not achievable from a Storybook play function without real native DragEvent
 *   dispatch (Dockview's bridge relies on `DragEvent.dataTransfer`). The play
 *   function instead exercises the attach→detach→reattach path via panel
 *   activation (the identical registry path used by zone moves). For full
 *   cross-zone drag proof, use a Playwright E2E test against the running app.
 */

import type { DockviewApi } from "dockview-react"
import { useRef, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { within, waitFor } from "@testing-library/dom"
import { expect } from "vitest"

import { HiddenSurfaceHostLayer } from "../surface-host/host-layer"
import { SurfaceHostProvider, useSurfaceRegistry } from "../surface-host/surface-host-provider"
import type { DockZone } from "../surface-host/types"
import { DockShell, type DockSeedPanel } from "./dock-shell"

// ---------------------------------------------------------------------------
// Mount counter — module-level so each test surface gets a unique stable token
// that is initialised once on mount and never changes unless the host remounts.
// ---------------------------------------------------------------------------
let _mountSeq = 0

function MountToken({ testId }: { testId: string }) {
	// Token captured at mount time only. A remount produces a new value.
	const [token] = useState<string>(() => `token-${++_mountSeq}`)
	return (
		<div
			data-testid={testId}
			data-mount-token={token}
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				height: "100%",
				padding: 16,
				fontFamily: "monospace",
				fontSize: 13,
				color: "#ccc",
				background: "#111",
				gap: 8,
			}}
		>
			<span style={{ fontWeight: 700, color: "#f59e0b" }}>{testId}</span>
			<span style={{ color: "#6ee7b7", fontSize: 11 }}>mount token: {token}</span>
			<span style={{ color: "#888", fontSize: 10 }}>unchanged = no remount</span>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Seed panels wired into the dock zones
// ---------------------------------------------------------------------------
const SEED_PANELS: readonly DockSeedPanel[] = [
	{
		instanceId: "test-surface-alpha",
		surfaceType: "test",
		title: "Alpha",
		zone: "main",
	},
	{
		instanceId: "test-surface-beta",
		surfaceType: "test",
		title: "Beta",
		zone: "right",
	},
	{
		instanceId: "test-surface-gamma",
		surfaceType: "test",
		title: "Gamma",
		zone: "main",
	},
]

// ---------------------------------------------------------------------------
// Module-level API registry so the play function can call panel methods.
// Populated via onZoneApiReady before the play fn runs.
// ---------------------------------------------------------------------------
const _zoneApis: Partial<Record<DockZone, DockviewApi>> = {}

// ---------------------------------------------------------------------------
// Inner story component — must be inside SurfaceHostProvider to call the registry
// ---------------------------------------------------------------------------
function DockShellRegressionStory() {
	const registry = useSurfaceRegistry()

	// Register surfaces into the registry once on mount.
	// getOrCreate is idempotent so StrictMode double-invokes are safe.
	const registered = useRef(false)
	if (!registered.current) {
		registered.current = true
		registry.getOrCreate("test-surface-alpha", {
			type: "test",
			title: "Alpha",
			render: () => <MountToken testId="surface-alpha" />,
		})
		registry.getOrCreate("test-surface-beta", {
			type: "test",
			title: "Beta",
			render: () => <MountToken testId="surface-beta" />,
		})
		registry.getOrCreate("test-surface-gamma", {
			type: "test",
			title: "Gamma",
			render: () => <MountToken testId="surface-gamma" />,
		})
	}

	const handleZoneApiReady = (zone: DockZone, api: DockviewApi) => {
		_zoneApis[zone] = api
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<HiddenSurfaceHostLayer />
			<DockShell
				seedPanels={SEED_PANELS}
				isDarkMode={true}
				rightZoneOpen={true}
				bottomZoneOpen={false}
				onZoneApiReady={handleZoneApiReady}
			/>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------
const meta = {
	title: "Workspace/DockShell/NoRemountRegression",
	parameters: {
		layout: "fullscreen",
	},
	render: () => (
		<SurfaceHostProvider>
			<DockShellRegressionStory />
		</SurfaceHostProvider>
	),
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

// ---------------------------------------------------------------------------
// Default story — visual proof: tokens visible on screen, unchanged after tab
// switching confirms the invariant holds.
// ---------------------------------------------------------------------------
export const Default: Story = {}

// ---------------------------------------------------------------------------
// Regression story with play function
//
// Tests:
//   1. Alpha and Gamma are both in "main" zone — switching active tab and back
//      must preserve both tokens (attach/detach cycle, same as a zone move).
//   2. Beta is in "right" zone alone — activating it and deactivating (by
//      switching main focus) must preserve Beta's token.
//
// Cross-zone drag: NOT tested here — see comment at top of file.
// ---------------------------------------------------------------------------
export const NoRemountOnTabSwitch: Story = {
	play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement)

		// Wait for dockview to render and zones to be ready.
		// Tokens appear once the surface slots attach.
		const alphaEl = await waitFor(
			() => {
				const el = canvas.getByTestId("surface-alpha")
				if (!el) throw new Error("surface-alpha not found")
				return el
			},
			{ timeout: 5000 },
		)

		const betaEl = await waitFor(
			() => {
				const el = canvas.getByTestId("surface-beta")
				if (!el) throw new Error("surface-beta not found")
				return el
			},
			{ timeout: 5000 },
		)

		// Read initial mount tokens
		const alphaToken0 = alphaEl.getAttribute("data-mount-token")
		const betaToken0 = betaEl.getAttribute("data-mount-token")

		expect(alphaToken0).toBeTruthy()
		expect(betaToken0).toBeTruthy()

		// -----------------------------------------------------------------------
		// Step 1: Switch active panel in "main" zone from Alpha to Gamma.
		// This detaches Alpha's slot and attaches Gamma's slot.
		// Alpha's token must survive the detach.
		// -----------------------------------------------------------------------
		const mainApi = _zoneApis["main"]
		if (mainApi) {
			const gammaPanel = mainApi.getPanel("test-surface-gamma")
			gammaPanel?.api.setActive()

			// Wait a tick for React to process the slot swap
			await new Promise<void>((r) => setTimeout(r, 100))

			// Switch back to Alpha
			const alphaPanel = mainApi.getPanel("test-surface-alpha")
			alphaPanel?.api.setActive()

			await new Promise<void>((r) => setTimeout(r, 100))
		}

		// Alpha's token must be the same — no remount occurred
		const alphaEl2 = canvas.getByTestId("surface-alpha")
		const alphaToken1 = alphaEl2.getAttribute("data-mount-token")
		expect(alphaToken1).toBe(alphaToken0)

		// -----------------------------------------------------------------------
		// Step 2: Activate the right-zone panel (Beta) via its API, then switch
		// focus back to main. Beta's token must be unchanged.
		// -----------------------------------------------------------------------
		const rightApi = _zoneApis["right"]
		if (rightApi) {
			const betaPanel = rightApi.getPanel("test-surface-beta")
			betaPanel?.api.setActive()
			await new Promise<void>((r) => setTimeout(r, 100))
		}

		// Switch main panel to verify right-zone Beta survives concurrent focus changes
		if (mainApi) {
			const alphaPanel = mainApi.getPanel("test-surface-alpha")
			alphaPanel?.api.setActive()
			await new Promise<void>((r) => setTimeout(r, 100))
		}

		const betaEl2 = canvas.getByTestId("surface-beta")
		const betaToken1 = betaEl2.getAttribute("data-mount-token")
		expect(betaToken1).toBe(betaToken0)

		// -----------------------------------------------------------------------
		// Gamma token: also confirm it did not remount during the switches above
		// -----------------------------------------------------------------------
		const gammaEl = canvas.getByTestId("surface-gamma")
		const gammaToken0 = gammaEl.getAttribute("data-mount-token")
		expect(gammaToken0).toBeTruthy()

		// Switch to Gamma and back
		if (mainApi) {
			mainApi.getPanel("test-surface-gamma")?.api.setActive()
			await new Promise<void>((r) => setTimeout(r, 100))
			mainApi.getPanel("test-surface-alpha")?.api.setActive()
			await new Promise<void>((r) => setTimeout(r, 100))
		}

		const gammaEl2 = canvas.getByTestId("surface-gamma")
		const gammaToken1 = gammaEl2.getAttribute("data-mount-token")
		expect(gammaToken1).toBe(gammaToken0)
	},
}
