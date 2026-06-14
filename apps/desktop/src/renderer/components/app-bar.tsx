import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@ch5me/ch5-ui-web";
import { useSetAtom } from "jotai"
import { PanelLeftIcon, PlusIcon } from "lucide-react"
import { useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { leftPanelOpenAtom } from "../atoms/ui"
import { ElfWordmark } from "./elf-wordmark"
import { useAppBarContent } from "./app-bar-context"

// Height of the app bar in pixels — used as CSS variable
export const APP_BAR_HEIGHT = 46
const isMac =
	typeof window !== "undefined" && "elf" in window && window.elf.platform === "darwin"
const isElectronEnv = typeof window !== "undefined" && "elf" in window
const WINDOW_CONTROLS_LEFT = isMac && isElectronEnv ? 93 : 8

/**
 * Detect whether we're running inside Electron (preload injects `window.elf`).
 */
function isElectron(): boolean {
	return typeof window !== "undefined" && "elf" in window
}

function GlobalAppChrome() {
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

export function AppBar() {
	const pageContent = useAppBarContent()

	return (
		<div
			data-slot="app-bar"
			className="relative z-30 flex shrink-0 items-center border-b border-border/50 pl-4 pr-3 transition-[padding-left] duration-250 ease-in-out group-data-[state=collapsed]/sidebar-wrapper:pl-[var(--window-controls-inset)]"
			style={{
				height: APP_BAR_HEIGHT,
				// Make entire bar draggable on Electron (title bar replacement)
				// @ts-expect-error -- vendor-prefixed CSS property
				WebkitAppRegion: isElectron() ? "drag" : undefined,
			}}
		>
			<GlobalAppChrome />
			<div className="relative flex h-full min-w-0 flex-1 items-center">{pageContent}</div>
		</div>
	)
}
