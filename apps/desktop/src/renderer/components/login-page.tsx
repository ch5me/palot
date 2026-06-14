import { Button, Spinner } from "@ch5me/ch5-ui-web";
import { useRouter } from "@tanstack/react-router"
import { AlertCircleIcon, ExternalLinkIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { DeviceCodeUi, ElfAuthStateDto } from "../../preload/api"
import { isElectron, openExternalUrl } from "../services/backend"

const FIREFLY_DESKTOP_CLIENT_ID = "firefly-desktop"

type SignInPhase = "idle" | "pending" | "error"

interface ErrorInfo {
	kind: "denied" | "expired" | "signin_failed" | "poll_failed"
	message: string
}

function errorMessage(err: unknown, fallback: string): string {
	if (err instanceof Error && err.message) return err.message
	if (typeof err === "string" && err.length > 0) return err
	return fallback
}

export function LoginPage() {
	const router = useRouter()
	const [phase, setPhase] = useState<SignInPhase>("idle")
	const [deviceCode, setDeviceCode] = useState<DeviceCodeUi | null>(null)
	const [error, setError] = useState<ErrorInfo | null>(null)
	const [polling, setPolling] = useState(false)
	const [authState, setAuthState] = useState<ElfAuthStateDto | null>(null)

	useEffect(() => {
		if (!isElectron) return
		let cancelled = false

		window.elf.auth.getState().then((state) => {
			if (!cancelled) {
				setAuthState(state)
			}
		})

		const unsubscribe = window.elf.auth.onChange((state) => {
			setAuthState(state)
		})

		return () => {
			cancelled = true
			unsubscribe()
		}
	}, [])

	useEffect(() => {
		if (authState?.hasToken) {
			router.navigate({ to: "/" })
		}
	}, [authState?.hasToken, router])

	async function handleSignIn() {
		if (!isElectron) {
			setError({
				kind: "signin_failed",
				message: "Firefly sign-in is only available in Electron right now.",
			})
			setPhase("error")
			return
		}
		setError(null)
		try {
			const code = await window.elf.auth.signIn(FIREFLY_DESKTOP_CLIENT_ID)
			setDeviceCode(code)
			setPhase("pending")
			await pollForToken()
		} catch (err) {
			setError({
				kind: "signin_failed",
				message: errorMessage(err, "Could not start sign-in. Please try again."),
			})
			setPhase("error")
			setDeviceCode(null)
		}
	}

	async function pollForToken() {
		if (!isElectron) return
		setPolling(true)
		try {
			const state = await window.elf.auth.poll()
			setAuthState(state)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			if (msg === "sign_in_denied") {
				setError({ kind: "denied", message: "Access denied. Please try again." })
				setPhase("error")
			} else if (msg === "sign_in_expired") {
				setError({ kind: "expired", message: "Code expired. Please try again." })
				setPhase("error")
			} else {
				setError({
					kind: "poll_failed",
					message: errorMessage(err, "Sign-in was interrupted. Please try again."),
				})
				setPhase("error")
			}
		} finally {
			setPolling(false)
		}
	}

	async function handleCancel() {
		if (isElectron) {
			await window.elf.auth.cancelSignIn()
		}
		setDeviceCode(null)
		setPhase("idle")
		setError(null)
	}

	async function handleOpenUrl() {
		if (deviceCode?.verificationUriComplete) {
			await openExternalUrl(deviceCode.verificationUriComplete)
		}
	}

	function handleRetry() {
		setError(null)
		setDeviceCode(null)
		setPhase("idle")
	}

	if (phase === "pending" && deviceCode) {
		return (
			<div className="flex h-full items-center justify-center p-6">
				<div className="w-full max-w-md space-y-6">
					<div className="flex justify-center">
						<div className="flex size-14 items-center justify-center rounded-full border border-border bg-muted/50">
							<Spinner className="size-7" />
						</div>
					</div>

					<div className="text-center">
						<h1 className="text-lg font-semibold text-foreground">Verify your identity</h1>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							Complete sign-in in your browser, then return here.
						</p>
					</div>

					<div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
						<p className="text-sm font-medium text-muted-foreground">Your verification code</p>
						<p className="mt-1 font-mono text-2xl font-bold tracking-widest text-foreground">
							{deviceCode.userCode}
						</p>
					</div>

					<div className="flex flex-col items-center justify-center gap-3">
						<Button variant="outline" size="sm" onClick={handleOpenUrl}>
							<ExternalLinkIcon />
							Open verification URL
						</Button>
						<Button variant="ghost" size="sm" onClick={handleCancel}>
							Cancel
						</Button>
					</div>

					{polling && (
						<p className="text-center text-xs text-muted-foreground">Waiting for approval...</p>
					)}
				</div>
			</div>
		)
	}

	if (phase === "error" && error) {
		return (
			<div className="flex h-full items-center justify-center p-6">
				<div className="w-full max-w-md space-y-6">
					<div className="flex justify-center">
						<div className="flex size-14 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">
							<AlertCircleIcon className="size-7 text-destructive" />
						</div>
					</div>

					<div className="text-center">
						<h1 className="text-lg font-semibold text-foreground">Sign-in failed</h1>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error.message}</p>
					</div>

					<div className="flex items-center justify-center">
						<Button variant="outline" size="sm" onClick={handleRetry}>
							Try again
						</Button>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full items-center justify-center p-6">
			<div className="w-full max-w-md space-y-6">
				<div className="text-center">
					<h1 className="text-lg font-semibold text-foreground">Sign in to Firefly</h1>
					<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
						Connect your Firefly account to unlock cloud features.
					</p>
				</div>

				<div className="flex items-center justify-center">
					<Button size="lg" onClick={handleSignIn}>
						Sign in with Firefly
					</Button>
				</div>
			</div>
		</div>
	)
}
