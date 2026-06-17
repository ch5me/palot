import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@ch5me/ch5-ui-web";
import { useSetAtom } from "jotai"
import { PanelLeftIcon, PlusIcon } from "lucide-react"
import { useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { leftPanelOpenAtom } from "../atoms/ui"
import { ElfWordmark } from "./elf-wordmark"

// Height of the app bar / sidebar chrome row / content toolbar, in pixels.
export const APP_BAR_HEIGHT = 46
const isMac =
	typeof window !== "undefined" && "elf" in window && window.elf.platform === "darwin"
const isElectronEnv = typeof window !== "undefined" && "elf" in window
/** Left inset that clears the macOS traffic-light window controls on Electron. */
export const WINDOW_CONTROLS_LEFT = isMac && isElectronEnv ? 93 : 8

/**
 * Detect whether we're running inside Electron (preload injects `window.elf`).
 */
export function isElectron(): boolean {
	return typeof window !== "undefined" && "elf" in window
}

export function GlobalAppChrome() {
	const navigate = useNavigate()
	const setLeftPanelOpen = useSetAtom(leftPanelOpenAtom)

	const handleToggleSidebar = useCallback(() => {
		setLeftPanelOpen((prev) => !prev)
	}, [setLeftPanelOpen])

	return (
		<div
			className="mr-3 flex shrink-0 items-center gap-1.5"
			style={{
				marginLeft: WINDOW_CONTROLS_LEFT,
				// @ts-expect-error -- vendor-prefixed CSS property
				WebkitAppRegion: "no-drag",
			}}
		>
			<ElfWordmark className="mr-2 h-[16.5px] w-auto shrink-0 text-[16.5px] text-muted-foreground/80" />
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							variant="ghost"
							size="icon"
							className="size-7 shrink-0"
							onClick={handleToggleSidebar}
						/>
					}
				>
					<PanelLeftIcon className="size-3.5" />
				</TooltipTrigger>
				<TooltipContent>Toggle sidebar (&#8984;B)</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							variant="ghost"
							size="icon"
							className="size-7 shrink-0"
							onClick={() => navigate({ to: "/" })}
						/>
					}
				>
					<PlusIcon className="size-3.5" />
				</TooltipTrigger>
				<TooltipContent>New session (&#8984;N)</TooltipContent>
			</Tooltip>
		</div>
	)
}

