/**
 * CH5PM Dashboard — plugin panel adapter.
 *
 * Thin wrapper that satisfies the V2 `PluginPanelProps { agent }` contract
 * while delegating all rendering to `Ch5PmDashboardPanel` (which lives in
 * the renderer's `ch5pm-dashboard/` dir and has no dependency on `agent`).
 * The original file is NOT moved so its co-located tests (client, actions,
 * contract, panel.test.tsx) keep their relative imports intact.
 *
 * V1 registry row and `ch5pmSurfaceEnabledAtom` are deleted; enable/disable
 * now flows through the host plugin lifecycle (firefly.built-in.surface.ch5pm).
 */

import { Ch5PmDashboardPanel } from "@/ch5pm-dashboard/panel"
import type { PluginPanelProps } from "@/firefly-plugin-surfaces"

export default function Ch5pmPanel(_props: PluginPanelProps) {
	return <Ch5PmDashboardPanel />
}
