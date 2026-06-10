import { getOrCreateTokenStore } from "./token-store"
import {
	requestDeviceCode,
	pollForApproval,
	ExpiredTokenError,
	AccessDeniedError,
} from "./device-auth-client"

export interface ElfAuthStateDto {
	hasToken: boolean
	elfUserId: string | null
	expiresAt: number | null
	issuer: string | null
	audience: string | null
}

export interface DeviceCodeUi {
	userCode: string
	verificationUriComplete: string
	expiresIn: number
}

let pendingDeviceCode: string | null = null
let abortController: AbortController | null = null

function toDto(state: import("./token-store").ElfAuthState | null): ElfAuthStateDto {
	if (!state) {
		return { hasToken: false, elfUserId: null, expiresAt: null, issuer: null, audience: null }
	}
	return {
		hasToken: true,
		elfUserId: state.elfUserId,
		expiresAt: state.expiresAt,
		issuer: state.issuer,
		audience: state.audience,
	}
}

export async function getAuthState(): Promise<ElfAuthStateDto> {
	const state = await getOrCreateTokenStore().getState()
	return toDto(state)
}

export async function startSignIn(clientId?: string): Promise<DeviceCodeUi> {
	const resolvedClientId = clientId?.trim()
	if (!resolvedClientId) {
		throw new Error(
			"Firefly auth client id is required. Pass one explicitly from the calling surface before starting sign-in.",
		)
	}
	const result = await requestDeviceCode({ clientId: resolvedClientId })
	pendingDeviceCode = result.deviceCode
	abortController = new AbortController()
	return {
		userCode: result.userCode,
		verificationUriComplete: result.verificationUriComplete,
		expiresIn: result.expiresIn,
	}
}

export async function pollSignIn(): Promise<ElfAuthStateDto | null> {
	if (!pendingDeviceCode || !abortController) {
		throw new Error("No pending sign-in — call startSignIn first")
	}

	try {
		const result = await pollForApproval({
			deviceCode: pendingDeviceCode,
			expiresAtSec: 600,
			signal: abortController.signal,
		})

		await getOrCreateTokenStore().setState({
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
			expiresAt: Math.floor(Date.now() / 1000) + result.expiresIn,
			elfUserId: result.elfUserId,
			issuer: result.issuer,
			audience: result.audience,
		})

		pendingDeviceCode = null
		abortController = null

		const state = await getOrCreateTokenStore().getState()
		return toDto(state)
	} catch (err) {
		if (err instanceof ExpiredTokenError) {
			pendingDeviceCode = null
			abortController = null
			throw new Error("sign_in_expired")
		}
		if (err instanceof AccessDeniedError) {
			pendingDeviceCode = null
			abortController = null
			throw new Error("sign_in_denied")
		}
		throw err
	}
}

export async function cancelSignIn(): Promise<void> {
	if (abortController) {
		abortController.abort()
		abortController = null
	}
	pendingDeviceCode = null
}

export async function signOut(): Promise<void> {
	await getOrCreateTokenStore().clearToken()
}
