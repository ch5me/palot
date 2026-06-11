import { app } from "electron"
import { createLogger } from "../../logger"
import type { ElfAuthState } from "./token-store"
import { getOrCreateTokenStore } from "./token-store"

const log = createLogger("auth/editor-handoff")

declare global {
	// eslint-disable-next-line no-var
	var __elfEditorCallback: ((url: string) => Promise<ElfAuthState>) | undefined
}

declare global {
	// eslint-disable-next-line no-var
	var __elfAuthStore: ReturnType<typeof import("./token-store").createElfTokenStore> | undefined
}

function normalizeAuthBaseUrl(value: string): string {
	const trimmed = value.trim()
	if (!trimmed) {
		throw new Error("FIREFLY_AUTH_HOST is set but empty")
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed.replace(/\/+$/, "")
	}
	return `https://${trimmed.replace(/\/+$/, "")}`
}

// Contract: auth entry lives on app host, not a separate auth subdomain.
// See docs/company/service-topology-env-contract.md (ch5-company repo).
// Staging override: FIREFLY_AUTH_HOST=https://staging.app.elf.dance
function resolveEditorHandoffBaseUrl(): string {
	const configured = process.env.FIREFLY_AUTH_HOST ?? process.env.VITE_FIREFLY_AUTH_HOST ?? "https://app.elf.dance"
	return normalizeAuthBaseUrl(configured)
}

export function parseCallbackUrl(raw: string): { token: string } | null {
	try {
		const url = new URL(raw)
		if (url.protocol !== "firefly-client:") return null
		if (!url.hostname && !url.pathname.includes("auth/callback")) return null
		const token = url.searchParams.get("token")
		if (!token) return null
		return { token }
	} catch {
		return null
	}
}

export async function completeSignInFromCallback(raw: string): Promise<ElfAuthState> {
	const parsed = parseCallbackUrl(raw)
	if (!parsed) {
		throw new Error("Invalid firefly-client:// callback URL")
	}

	const authBaseUrl = resolveEditorHandoffBaseUrl()
	const res = await fetch(`${authBaseUrl}/api/device-auth/tokens`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ grant_type: "editor_handoff", token: parsed.token }),
	})

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: res.statusText }))
		throw new Error(`Editor handoff exchange failed: ${res.status} ${JSON.stringify(err)}`)
	}

	const result = (await res.json()) as {
		accessToken: string
		refreshToken: string | null
		expiresIn: number
		elfUserId: string
		issuer: string
		audience: string
	}

	const state: ElfAuthState = {
		accessToken: result.accessToken,
		refreshToken: result.refreshToken ?? null,
		expiresAt: Math.floor(Date.now() / 1000) + result.expiresIn,
		elfUserId: result.elfUserId,
		issuer: result.issuer,
		audience: result.audience,
	}

	await getOrCreateTokenStore().setState(state)
	return state
}

export function registerDeepLink(): void {
	app.setAsDefaultProtocolClient("firefly-client")
	log.info("Registered as firefly-client:// protocol client")

	app.on("open-url", (_event, url) => {
		if (globalThis.__elfEditorCallback) {
			globalThis.__elfEditorCallback(url).catch((err) =>
				log.error("Deep-link handler threw", err),
			)
		} else {
			log.warn("Received deep-link but no handler registered", { url })
		}
	})
}

export function setEditorCallbackHandler(fn: (url: string) => Promise<ElfAuthState>): void {
	globalThis.__elfEditorCallback = fn
}
