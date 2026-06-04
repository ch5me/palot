import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import type { ModelRef } from "../hooks/use-opencode-data"
import { appStore } from "./store"

// ============================================================
// Session Settings (Atomic per session)
// ============================================================

export interface SessionChatSettings {
	selectedModel: ModelRef | null
	selectedAgent: string | null
	selectedVariant: string | undefined
}

/**
 * Persisted chat settings per session.
 * Seeded from project preferences, but overrides are session-specific.
 */
export const sessionSettingsAtom = atomFamily((_sessionId: string) =>
	atom<SessionChatSettings>({
		selectedModel: null,
		selectedAgent: null,
		selectedVariant: undefined,
	}),
)

// ============================================================
// Plan Mode (per session)
// ============================================================

/**
 * Plan mode toggle. When ON, the FIRST user message in a session is
 * automatically paired with a DAG-build system block so the agent
 * emits a ```dag JSON fence that the chat renderer can display inline
 * as an interactive graph. The toggle stays on after the first send
 * so the user can see they're still in plan mode.
 */
export const planModeFamily = atomFamily((_sessionId: string) => atom<boolean>(false))

/**
 * Tracks whether the first-message DAG augmentation has already fired
 * for this session, so we only inject the prefix once.
 */
export const planModePrimedFamily = atomFamily((_sessionId: string) => atom<boolean>(false))

/** Toggle plan mode on/off for a session. */
export const setPlanModeAtom = atom(null, (_get, set, sessionId: string, enabled: boolean) => {
	set(planModeFamily(sessionId), enabled)
	if (!enabled) {
		// Clearing plan mode also clears the primed flag so re-enabling
		// re-arms the first-message injection.
		set(planModePrimedFamily(sessionId), false)
	}
})

/**
 * Mark plan mode as primed (i.e. the first-message DAG prefix has
 * already been injected). Called from `handleSend` after a successful
 * send under plan mode.
 */
export const primePlanModeAtom = atom(null, (_get, set, sessionId: string) => {
	set(planModePrimedFamily(sessionId), true)
})

/**
 * System-block prepended to the first user message when plan mode is
 * active. Tells the agent to emit a ```dag JSON fence describing the
 * plan so the renderer can display it inline.
 */
export const PLAN_MODE_DAG_PREFIX =
	"\n\n[Plan mode] Along with your answer, also include a single ```dag code fence with the plan as a DAG.\n" +
	"Shape: { \"nodes\": [{ \"id\": \"step1\", \"label\": \"Short label\" }], \"edges\": [{ \"source\": \"step1\", \"target\": \"step2\" }] }.\n" +
	"Use 3-8 nodes. Each node id is a short slug. Each edge source/target must reference an existing node id.\n" +
	"Skip the fence entirely if the task is trivial."

/**
 * Build the final text to send: if plan mode is on and the session
 * has not yet been primed, prepend the DAG-build instruction.
 */
export function buildPlanModeText(args: {
	enabled: boolean
	primed: boolean
	userText: string
}): string {
	if (!args.enabled || args.primed) return args.userText
	return `${args.userText}${PLAN_MODE_DAG_PREFIX}`
}

/**
 * Global timer for live-updating UI (durations, elapsed time).
 * Updates once per second.
 */
export const nowAtom = atom(Date.now())

if (typeof window !== "undefined") {
	setInterval(() => {
		appStore.set(nowAtom, Date.now())
	}, 1000)
}
