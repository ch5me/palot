import { Button } from "@ch5me/elf-ui/components/button"
import { AppShellChrome } from "@ch5me/elf-ui/components/nav-sidebar-shell"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ch5me/elf-ui/components/tooltip"
import type { CSSProperties } from "react"
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
	return <ElfWordmark className="mr-2 h-[16.5px] w-auto shrink-0 text-[16.5px] text-muted-foreground/80" />
}

export function AppBar() {
	const navigate = useNavigate()
	const pageContent = useAppBarContent()
	const setLeftPanelOpen = useSetAtom(leftPanelOpenAtom)

	const handleToggleSidebar = useCallback(() => {
		setLeftPanelOpen((prev) => !prev)
	}, [setLeftPanelOpen])

	const dragStyle = { WebkitAppRegion: "drag" } as CSSProperties
	const noDragStyle = { WebkitAppRegion: "no-drag" } as CSSProperties

	return (
		<div
			data-slot="app-bar"
			className="transition-[padding-left] duration-250 ease-in-out group-data-[state=collapsed]/sidebar-wrapper:pl-[var(--window-controls-inset)]"
			style={{
				// Make entire bar draggable on Electron (title bar replacement)
				WebkitAppRegion: isElectron() ? "drag" : undefined,
			} as CSSProperties}
		>
			<AppShellChrome
				title={<div className="relative flex h-full min-w-0 flex-1 items-center">{pageContent}</div>}
				windowControlsInset={WINDOW_CONTROLS_LEFT}
				leftAdornment={<div style={noDragStyle}><GlobalAppChrome /></div>}
				toggleSidebarAction={{
					control: (
						<div style={noDragStyle}>
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
						</div>
					),
				}}
				newSessionAction={{
					control: (
						<div style={noDragStyle}>
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
					),
				}}
				rightContent={<div style={dragStyle} />}
			/>
		</div>
	)
}
