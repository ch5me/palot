import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import { buildGenUiCatalog } from "../genui/registry"
import type { ModelRef } from "../hooks/use-opencode-data"
import { sessionGenUiArtifactListFamily } from "./genui-artifacts"
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

const PLAN_MODE_DAG_NUDGE =
	"\n\n[Plan mode] Also render the plan as an inline dag-sparkline via a ```genui fence " +
	"(component: \"dag-sparkline\"). Use 3-8 nodes; skip it if the task is trivial."

/** Injects the GenUI catalog once per session so the agent can render inline components; stripped from the displayed bubble. */
export function buildPlanModeText(args: {
	enabled: boolean
	primed: boolean
	userText: string
}): string {
	const blocks: string[] = []
	if (!args.primed) blocks.push(buildGenUiCatalog())
	if (args.enabled && !args.primed) blocks.push(PLAN_MODE_DAG_NUDGE)
	if (blocks.length === 0) return args.userText
	return `${args.userText}\n\n${blocks.join("\n")}`
}

export function primeSessionGenUi(sessionId: string, userText: string): string {
	const primed = appStore.get(planModePrimedFamily(sessionId))
	const enabled = appStore.get(planModeFamily(sessionId))
	const baseText = buildPlanModeText({ enabled, primed, userText })
	const artifactContext = buildArtifactPromptContext(sessionId)
	const finalText = artifactContext ? `${baseText}\n\n${artifactContext}` : baseText
	if (!primed) appStore.set(primePlanModeAtom, sessionId)
	return finalText
}

function buildArtifactPromptContext(sessionId: string): string {
	const artifacts = appStore.get(sessionGenUiArtifactListFamily(sessionId))
	if (!artifacts || artifacts.length === 0) {
		return ""
	}

	const lines = artifacts.slice(0, 8).map((artifact) => {
		const pin = artifact.pin.pinned && artifact.pin.placement ? ` pinned:${artifact.pin.placement}` : ""
		return `- ${artifact.id} | component:${artifact.component}${pin} | title:${artifact.title}`
	})

	return [
		"[Artifact Context] Previously rendered session artifacts:",
		...lines,
		'When the user refers to an existing artifact, prefer its stable `artifact_...` id. For edits, describe prop patches against the existing artifact before fully regenerating.',
	].join("\n")
}

const GENUI_CONTEXT_RE = /\n*\[Inline UI][\s\S]*$/

/** Strips the injected GenUI context so the user's chat bubble shows only what they typed. */
export function stripGenUiContext(text: string): string {
	return text.replace(GENUI_CONTEXT_RE, "").trimEnd()
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
