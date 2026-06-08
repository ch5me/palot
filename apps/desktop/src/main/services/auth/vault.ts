import { safeStorage } from "electron"
import { createLogger } from "../../logger"

const log = createLogger("auth/vault")

export type SafeStorageBackend = "basic_text" | "os_keyring" | "unknown"

export function classifyBackend(): SafeStorageBackend {
	// safeStorage.getSelectedStorageBackend() returns a platform-specific string.
	// "basic_text" is the only value that guarantees plaintext storage.
	// All other values (libsecret, kwallet variants, etc.) indicate OS keyring is in use.
	const raw = safeStorage.getSelectedStorageBackend()
	if (raw === "basic_text") return "basic_text"
	return "os_keyring"
}

export function assertProductionSafe(): void {
	const backend = classifyBackend()
	const isProd = process.env.NODE_ENV === "production"

	if (backend === "basic_text") {
		if (isProd) {
			throw new Error(
				"safeStorage backend is 'basic_text' — refusing to boot in production. " +
					"Install libsecret (Debian/Ubuntu: libsecret-1-dev, Fedora: libsecret-devel) " +
					"or configure a keyring to enable encrypted token storage.",
			)
		}
		log.warn("safeStorage backend is 'basic_text'. Auth tokens stored in plaintext — dev only.")
	}
}

export async function encrypt(plaintext: string): Promise<Buffer> {
	assertProductionSafe()

	// Async methods (Electron 31+) are not in the TS types but exist at runtime.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const asyncSafe = safeStorage as typeof safeStorage & {
		encryptStringAsync?: (s: string) => Promise<Buffer>
	}
	if (asyncSafe.encryptStringAsync) {
		return asyncSafe.encryptStringAsync(plaintext)
	}

	if (!safeStorage.isEncryptionAvailable()) {
		return Buffer.from(plaintext, "utf-8")
	}
	return safeStorage.encryptString(plaintext)
}

export async function decrypt(ciphertext: Buffer): Promise<string> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const asyncSafe = safeStorage as typeof safeStorage & {
		decryptStringAsync?: (b: Buffer) => Promise<string>
	}
	if (asyncSafe.decryptStringAsync) {
		return asyncSafe.decryptStringAsync(ciphertext)
	}

	if (!safeStorage.isEncryptionAvailable()) {
		return ciphertext.toString("utf-8")
	}
	return safeStorage.decryptString(ciphertext)
}
