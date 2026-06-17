import { describe, expect, it } from "bun:test"
import { isRedirect } from "@tanstack/react-router"
import type { ElfAuthStateDto } from "../preload/api"
import { requireAuthenticated, type AuthStateReader } from "./auth-guard"

function authedState(): ElfAuthStateDto {
	return {
		hasToken: true,
		elfUserId: "user-123",
		expiresAt: Math.floor(Date.now() / 1000) + 3600,
		issuer: "https://auth.elf.dance",
		audience: "https://api.elf.dance",
	}
}

function reader(value: ElfAuthStateDto | null): AuthStateReader {
	return async () => value
}

describe("requireAuthenticated (CH5COMPAC4C-300)", () => {
	it("redirects to /login when there is no auth state at all", async () => {
		try {
			await requireAuthenticated(reader(null))
			throw new Error("expected a redirect to be thrown")
		} catch (err) {
			expect(isRedirect(err)).toBe(true)
			expect((err as { options?: { to?: string } }).options?.to).toBe("/login")
		}
	})

	it("redirects to /login when the token is absent (hasToken=false)", async () => {
		const noToken: ElfAuthStateDto = {
			hasToken: false,
			elfUserId: null,
			expiresAt: null,
			issuer: null,
			audience: null,
		}
		try {
			await requireAuthenticated(reader(noToken))
			throw new Error("expected a redirect to be thrown")
		} catch (err) {
			expect(isRedirect(err)).toBe(true)
			expect((err as { options?: { to?: string } }).options?.to).toBe("/login")
		}
	})

	it("allows the load when the user holds a token", async () => {
		// Resolves without throwing -> the protected route is permitted to load.
		await expect(requireAuthenticated(reader(authedState()))).resolves.toBeUndefined()
	})

	it("is a no-op when there is no preload bridge (browser-mode staging window)", async () => {
		// A null reader models the absence of window.elf; the guard must not
		// enforce auth and must not throw, matching AGENTS.md browser-mode policy.
		await expect(requireAuthenticated(null)).resolves.toBeUndefined()
	})
})
