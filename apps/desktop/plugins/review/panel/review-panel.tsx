/**
 * Review panel entry point for the V2 plugin catalog.
 *
 * Wraps the legacy `ReviewPanel` component (which takes `sessionId` +
 * `directory`) in the `{ agent: Agent }` props shape expected by the
 * host-reconciler render mode.
 */

import type { Agent } from "@/lib/types"
import { ReviewPanel as ReviewPanelImpl } from "../../../src/renderer/components/review/review-panel"

interface ReviewPanelPluginProps {
	agent: Agent
}

function ReviewPluginPanel({ agent }: ReviewPanelPluginProps) {
	return <ReviewPanelImpl sessionId={agent.sessionId} directory={agent.directory} />
}

export default ReviewPluginPanel
