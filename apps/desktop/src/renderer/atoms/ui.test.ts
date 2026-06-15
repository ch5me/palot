import { describe, expect, test } from "bun:test"
import { createStore } from "jotai"
import type { PalotOpenSidePanelPayload } from "../../preload/api"
import {
	documentPanelActiveTabAtom,
	documentPanelOpenAtom,
	openSidePanelTabAtom,
	paneRoutingStateAtom,
	setAvailableDocumentPanelTabsAtom,
	setAvailableSidePanelTabsAtom,
	sidePanelActiveTabAtom,
	sidePanelOpenAtom,
} from "./ui"

function routePalotOpenSidePanelPayload(
	store: ReturnType<typeof createStore>,
	payload: PalotOpenSidePanelPayload,
) {
	store.set(openSidePanelTabAtom, payload.tab)
}

describe("ui pane routing contract", () => {
	test("doc tab opens doc lane without opening utility lane", () => {
		const store = createStore()

		store.set(openSidePanelTabAtom, "studio")

		expect(store.get(documentPanelOpenAtom)).toBe(true)
		expect(store.get(documentPanelActiveTabAtom)).toBe("studio")
		expect(store.get(sidePanelOpenAtom)).toBe(false)
		expect(store.get(paneRoutingStateAtom).documentPanel?.tab).toBe("studio")
		expect(store.get(paneRoutingStateAtom).sidePanel).toBeNull()
	})

	test("utility tab opens utility lane without disturbing doc lane state", () => {
		const store = createStore()

		store.set(openSidePanelTabAtom, "pdf-review")
		store.set(openSidePanelTabAtom, "review")

		expect(store.get(documentPanelOpenAtom)).toBe(true)
		expect(store.get(documentPanelActiveTabAtom)).toBe("pdf-review")
		expect(store.get(sidePanelOpenAtom)).toBe(true)
		expect(store.get(sidePanelActiveTabAtom)).toBe("review")
	})

	test("doc lane falls back to first available doc tab when restored tab disappears", () => {
		const store = createStore()

		store.set(openSidePanelTabAtom, "pdf-review")
		store.set(setAvailableDocumentPanelTabsAtom, ["studio"])

		expect(store.get(documentPanelOpenAtom)).toBe(true)
		expect(store.get(documentPanelActiveTabAtom)).toBe("studio")
	})

	test("doc lane closes when no doc surfaces remain", () => {
		const store = createStore()

		store.set(openSidePanelTabAtom, "studio")
		store.set(setAvailableDocumentPanelTabsAtom, [])

		expect(store.get(documentPanelOpenAtom)).toBe(false)
		expect(store.get(paneRoutingStateAtom).documentPanel).toBeNull()
	})

	test("utility lane availability ignores doc tabs", () => {
		const store = createStore()

		store.set(setAvailableSidePanelTabsAtom, ["review"])
		expect(store.get(sidePanelActiveTabAtom)).toBe("review")

		store.set(setAvailableSidePanelTabsAtom, [])
		expect(store.get(sidePanelOpenAtom)).toBe(false)
		expect(store.get(sidePanelActiveTabAtom)).toBe("review")
	})

	test("Palot open-side-panel payload routes usable tab id into renderer atoms", () => {
		const store = createStore()

		routePalotOpenSidePanelPayload(store, { tab: "pdf-review" })
		routePalotOpenSidePanelPayload(store, { tab: "review" })

		expect(store.get(documentPanelOpenAtom)).toBe(true)
		expect(store.get(documentPanelActiveTabAtom)).toBe("pdf-review")
		expect(store.get(sidePanelOpenAtom)).toBe(true)
		expect(store.get(sidePanelActiveTabAtom)).toBe("review")
	})
})
