/**
 * UI containment tier tests. No DOM harness exists in this repo, so
 * the boundary is exercised through React's error-boundary contract
 * surface directly (getDerivedStateFromError / componentDidCatch /
 * render) plus the crash-report wiring. The live containment path is
 * additionally covered by the main-side quarantine counter tests in
 * `main/firefly-plugin/lifecycle-state.test.ts`.
 */

import { describe, expect, test } from "bun:test"
import { isValidElement, type ReactElement, type ReactNode } from "react"

import {
	PluginPanelBoundary,
	type PluginPanelCrashReport,
} from "./firefly-plugin-surfaces"

function boundaryProps(reports: PluginPanelCrashReport[]) {
	return {
		pluginId: "firefly.built-in.surface.notes",
		projectedId: "firefly.built-in.surface.notes.notes",
		title: "Notes",
		reportCrash: (report: PluginPanelCrashReport) => reports.push(report),
		children: "panel-content" as ReactNode,
	}
}

function collectText(node: ReactNode, out: string[] = []): string[] {
	if (typeof node === "string") {
		out.push(node)
		return out
	}
	if (Array.isArray(node)) {
		for (const child of node) collectText(child, out)
		return out
	}
	if (isValidElement(node)) {
		const props = node.props as { children?: ReactNode }
		collectText(props.children ?? null, out)
	}
	return out
}

describe("PluginPanelBoundary", () => {
	test("derives crashed state from a thrown error", () => {
		const state = PluginPanelBoundary.getDerivedStateFromError(new Error("kaboom"))
		expect(state.crashed).toBe(true)
		expect(state.message).toBe("kaboom")
	})

	test("componentDidCatch reports the crash with plugin identity", () => {
		const reports: PluginPanelCrashReport[] = []
		const boundary = new PluginPanelBoundary(boundaryProps(reports))
		boundary.componentDidCatch(new Error("render exploded"), { componentStack: "" })
		expect(reports).toHaveLength(1)
		expect(reports[0].pluginId).toBe("firefly.built-in.surface.notes")
		expect(reports[0].projectedId).toBe("firefly.built-in.surface.notes.notes")
		expect(reports[0].message).toBe("render exploded")
	})

	test("renders children when not crashed, typed fallback when crashed", () => {
		const reports: PluginPanelCrashReport[] = []
		const boundary = new PluginPanelBoundary(boundaryProps(reports))

		expect(boundary.render()).toBe("panel-content")

		boundary.state = { crashed: true, message: "render exploded" }
		const fallback = boundary.render() as ReactElement
		expect(isValidElement(fallback)).toBe(true)
		const text = collectText(fallback).join(" ").replace(/\s+/gu, " ")
		expect(text).toContain("Notes crashed")
		expect(text).toContain("The rest of")
		expect(text).toContain("render exploded")
	})

	test("retry resets the boundary so the surface can remount", () => {
		const reports: PluginPanelCrashReport[] = []
		const boundary = new PluginPanelBoundary(boundaryProps(reports))
		let nextState: unknown = null
		boundary.setState = ((update: unknown) => {
			nextState = update
		}) as typeof boundary.setState
		boundary.state = { crashed: true, message: "boom" }
		const fallback = boundary.render() as ReactElement
		// Find the retry button's onClick through the element tree.
		const findButton = (node: ReactNode): (() => void) | null => {
			if (!isValidElement(node)) return null
			const props = node.props as { onClick?: () => void; children?: ReactNode }
			if (typeof props.onClick === "function") return props.onClick
			const children = Array.isArray(props.children) ? props.children : [props.children]
			for (const child of children) {
				const found = findButton(child ?? null)
				if (found) return found
			}
			return null
		}
		const onClick = findButton(fallback)
		expect(onClick).not.toBeNull()
		onClick?.()
		expect(nextState).toEqual({ crashed: false, message: null })
	})
})
