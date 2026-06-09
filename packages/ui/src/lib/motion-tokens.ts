/**
 * CH5 semantic motion tokens, expressed in framer (`motion/react`) shapes.
 *
 * Provenance: mirrors `ch5-packages/packages/motion/motion/src/tokens.ts`
 * (`@ch5me/motion`). Springs are shape-identical; durations are converted
 * ms -> seconds; CSS easing strings are converted to framer easing values.
 *
 * Components must import these constants instead of inlining transition
 * numbers, so the CH5 semantic motion language (enter/exit/press/emphasis +
 * overlay/layout/indicator/feedback/hover/panel/reveal/inertia/ambient/chart)
 * survives the engine difference. If `@ch5me/motion` later ships a
 * framer-compatible web surface, swap this mirror for an import of its
 * tokens — consuming components should not need to change.
 */
import type { Easing, Transition } from "motion/react"

type CubicBezier = [number, number, number, number]

const expressiveBezier: CubicBezier = [0.22, 1, 0.36, 1]
const iconiqSoftBezier: CubicBezier = [0.18, 1, 0.32, 1]
const iconiqSoftAltBezier: CubicBezier = [0.16, 1, 0.3, 1]

export const springs = {
	gentle: { type: "spring", stiffness: 120, damping: 18, mass: 1 },
	snappy: { type: "spring", stiffness: 320, damping: 22, mass: 1 },
	bouncy: { type: "spring", stiffness: 320, damping: 14, mass: 1 },
	stiff: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
	lazy: { type: "spring", stiffness: 80, damping: 20, mass: 1.2 },
	iconiqPress: { type: "spring", stiffness: 640, damping: 38, mass: 0.85 },
	iconiqHover: { type: "spring", stiffness: 340, damping: 28, mass: 0.8 },
	iconiqOverlay: { type: "spring", stiffness: 300, damping: 25, mass: 0.8 },
	iconiqOverlayExit: { type: "spring", stiffness: 400, damping: 30, mass: 1 },
	iconiqPanel: { type: "spring", stiffness: 240, damping: 22, mass: 0.78 },
	iconiqReveal: { type: "spring", stiffness: 146, damping: 23, mass: 0.98 },
	iconiqLayout: { type: "spring", stiffness: 420, damping: 34, mass: 0.9 },
	iconiqIndicator: { type: "spring", stiffness: 360, damping: 24, mass: 1 },
	iconiqInertia: { type: "spring", stiffness: 58, damping: 16, mass: 1.35 },
} as const satisfies Record<string, Transition>

/** Durations in seconds (framer convention). Source tokens are ms. */
export const durations = {
	instant: 0,
	fast: 0.15,
	base: 0.25,
	expressive: 0.35,
	slow: 0.4,
	showcase: 0.42,
	ambient: 1,
} as const

export const easings = {
	standard: "easeInOut",
	decelerate: "easeOut",
	accelerate: "easeIn",
	linear: "linear",
	expressive: expressiveBezier,
	iconiqSoft: iconiqSoftBezier,
	iconiqSoftAlt: iconiqSoftAltBezier,
} as const satisfies Record<string, Easing>

/**
 * Semantic preset -> framer transition. Pick by surface ROLE
 * (what is animating), not by numeric closeness.
 */
export const semanticTransitions = {
	/** Generic element enter. */
	enter: springs.gentle,
	/** Generic element exit (AnimatePresence exit). */
	exit: { duration: durations.fast, ease: easings.accelerate },
	/** Press intent / quick UI response. */
	press: springs.iconiqPress,
	/** Emphasis, playful pop. */
	emphasis: springs.bouncy,
	/** Modal/menu/sheet/popover enter. */
	overlayEnter: springs.iconiqOverlay,
	/** Modal/menu/sheet/popover exit. */
	overlayExit: springs.iconiqOverlayExit,
	/** Layout/width/position shifts (framer `layout` prop). */
	layout: springs.iconiqLayout,
	/** Tab indicator / toggle / active-state marker. */
	indicator: springs.iconiqIndicator,
	/** Button/control feedback. */
	feedback: springs.iconiqPress,
	/** Hover (whileHover). */
	hover: springs.iconiqHover,
	/** Panel slide/collapse. */
	panel: springs.iconiqPanel,
	/** Content/section reveal, in-view entrance. */
	reveal: springs.iconiqReveal,
	/** Drag release / inertial drift. */
	inertia: springs.iconiqInertia,
	/** Ambient pulse/glow loops. */
	ambient: { duration: durations.ambient, ease: easings.linear },
	/** Chart/dashboard entrance. */
	chart: springs.bouncy,
} as const satisfies Record<string, Transition>

/**
 * Reduced-motion policy (matches `@ch5me/motion`): reduced = INSTANT —
 * duration 0, snap to final state — never "slower animation".
 * Pair with `useReducedMotion()` from `motion/react`.
 */
export const reducedMotionTransition = { duration: 0 } as const satisfies Transition

export type SemanticTransitionToken = keyof typeof semanticTransitions
export type SpringToken = keyof typeof springs
