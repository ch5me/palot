import { app } from "electron"
import fs from "node:fs"
import path from "node:path"
import { createLogger } from "../../logger"
import { encrypt, decrypt } from "./vault"

const log = createLogger("auth/token-store")

export interface ElfAuthState {
	accessToken: string
	refreshToken: string | null
	expiresAt: number
	elfUserId: string
	issuer: string
	audience: string
}

export interface ElfTokenStoreShape {
	getState(): Promise<ElfAuthState | null>
	setState(state: ElfAuthState): Promise<void>
	clearToken(): Promise<void>
	getAuthHeader(): Promise<string | null>
	onChange(cb: (state: ElfAuthState | null) => void): () => void
}

const AUTH_STATE_FILE = "auth-state.bin"

type ChangeListener = (state: ElfAuthState | null) => void

function statePath(): string {
	return path.join(app.getPath("userData"), AUTH_STATE_FILE)
}

function isExpired(state: ElfAuthState, nowSec = Math.floor(Date.now() / 1000)): boolean {
	return state.expiresAt <= nowSec
}

export function createElfTokenStore(): ElfTokenStoreShape {
	const listeners = new Set<ChangeListener>()
	let cached: ElfAuthState | null = null
	let initialized = false

	async function loadState(): Promise<ElfAuthState | null> {
		const p = statePath()
		if (!fs.existsSync(p)) return null

		try {
			const raw = fs.readFileSync(p)
			const decrypted = await decrypt(Buffer.from(raw))
			const state = JSON.parse(decrypted) as ElfAuthState
			if (isExpired(state)) {
				log.info("Dropping expired auth state from disk", { expiresAt: state.expiresAt })
				await persist(null)
				return null
			}
			return state
		} catch (err) {
			log.error("Failed to load auth state, treating as absent", err)
			return null
		}
	}

	async function persist(state: ElfAuthState | null): Promise<void> {
		const p = statePath()
		const dir = path.dirname(p)
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true })
		}

		if (state === null) {
			if (fs.existsSync(p)) {
				fs.unlinkSync(p)
			}
			return
		}

		const encrypted = await encrypt(JSON.stringify(state))
		const tmp = `${p}.tmp`
		fs.writeFileSync(tmp, encrypted)
		fs.renameSync(tmp, p)
	}

	return {
		async getState() {
			if (!initialized) {
				cached = await loadState()
				initialized = true
			}
			if (cached && isExpired(cached)) {
				log.info("Dropping expired cached auth state", { expiresAt: cached.expiresAt })
				cached = null
				await persist(null)
				for (const cb of listeners) {
					cb(null)
				}
			}
			return cached
		},

		async setState(state: ElfAuthState) {
			if (isExpired(state)) {
				log.warn("Refusing to cache expired auth state", { expiresAt: state.expiresAt })
				cached = null
				await persist(null)
				for (const cb of listeners) {
					cb(null)
				}
				return
			}
			cached = state
			await persist(state)
			for (const cb of listeners) {
				cb(state)
			}
		},

		async clearToken() {
			cached = null
			await persist(null)
			for (const cb of listeners) {
				cb(null)
			}
		},

		async getAuthHeader() {
			const state = await this.getState()
			if (!state) return null
			return `Bearer ${state.accessToken}`
		},

		onChange(cb: ChangeListener) {
			listeners.add(cb)
			return () => {
				listeners.delete(cb)
			}
		},
	}
}

declare global {
	// eslint-disable-next-line no-var
	var __elfAuthStore: ElfTokenStoreShape | undefined
}

let store: ElfTokenStoreShape | undefined

export function getOrCreateTokenStore(): ElfTokenStoreShape {
	if (!store) {
		store = globalThis.__elfAuthStore ?? createElfTokenStore()
		if (globalThis.__elfAuthStore === undefined) {
			globalThis.__elfAuthStore = store
		}
	}
	return store
}

export function resetTokenStoreForTests(): void {
	store = undefined
	globalThis.__elfAuthStore = undefined
}
