/**
 * Oracle Roster — V2 plugin panel (firefly.built-in.surface.oracle)
 *
 * Thin adapter: delegates to the implementation in
 * `src/renderer/components/side-panel/oracle-panel.tsx`.
 * The V1 registry row is deleted; this is the sole render path.
 */

import { OraclePanel as OraclePanelImpl } from "../../../src/renderer/components/side-panel/oracle-panel"
import type { PluginPanelProps } from "../../../src/renderer/firefly-plugin-surfaces"

export default function OraclePanel({ agent }: PluginPanelProps) {
	return <OraclePanelImpl agent={agent} />
}
