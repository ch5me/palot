import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ch5me/elf-ui/components/tabs"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { useAtom, useSetAtom } from "jotai"
import { XIcon } from "lucide-react"
import { useCallback, useEffect, useMemo } from "react"
import {
	sidePanelActiveTabAtom,
	sidePanelOpenAtom,
	setSidePanelActiveTabAtom,
	type SidePanelTabId,
} from "../../atoms/ui"
import type { Agent } from "../../lib/types"
import type { SidePanelTabDef } from "./side-panel-tabs"

interface SessionSidePanelProps {
	agent: Agent
	tabs: SidePanelTabDef[]
	className?: string
}

export function SessionSidePanel({ agent: _agent, tabs, className }: SessionSidePanelProps) {
	const [activeTab] = useAtom(sidePanelActiveTabAtom)
	const setActiveTab = useSetAtom(setSidePanelActiveTabAtom)
	const [, setOpen] = useAtom(sidePanelOpenAtom)

	const availableTabs = useMemo(() => tabs.filter((t) => t.availability.available), [tabs])
	const showTabStrip = availableTabs.length > 1
	const currentTab = availableTabs.find((t) => t.id === activeTab) ?? availableTabs[0]

	const handleClose = useCallback(() => setOpen(false), [setOpen])

	useEffect(() => {
		if (availableTabs.length > 0 && currentTab && currentTab.id !== activeTab) {
			setActiveTab(currentTab.id)
		}
	}, [activeTab, availableTabs, currentTab, setActiveTab])

	if (!currentTab) return null

	return (
		<div className={cn("flex h-full min-h-0 flex-col", className)}>
			{showTabStrip ? (
				<Tabs
					orientation="vertical"
					value={currentTab.id}
					onValueChange={(value) => setActiveTab(value as SidePanelTabId)}
					className="flex h-full min-h-0"
				>
					<div className="flex h-full min-h-0 w-full">
						<div className="min-w-0 flex-1 overflow-hidden">
							{availableTabs.map((tab) => (
								<TabsContent key={tab.id} value={tab.id} className="h-full overflow-hidden">
									{tab.render()}
								</TabsContent>
							))}
						</div>

						<div className="ml-auto flex h-full w-10 shrink-0 flex-col items-center border-l border-border">
							<TabsList variant="line" className="h-auto w-full flex-col gap-0.5 px-0 py-2">
								{availableTabs.map((tab) => (
									<TabsTrigger
										key={tab.id}
										value={tab.id}
										className="w-full px-0 group-data-vertical/tabs:justify-center"
										title={tab.label}
									>
										{tab.icon}
									</TabsTrigger>
								))}
							</TabsList>
							<button
								type="button"
								onClick={handleClose}
								className="mt-auto mb-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							>
								<XIcon className="size-3.5" />
							</button>
						</div>
					</div>
				</Tabs>
			) : (
				<div className="flex h-full min-h-0 flex-col">
					<div className="flex items-center justify-end border-b border-border px-2 py-1">
						<button
							type="button"
							onClick={handleClose}
							className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							<XIcon className="size-3.5" />
						</button>
					</div>
					<div className="min-h-0 flex-1 overflow-hidden">{currentTab.render()}</div>
				</div>
			)}
		</div>
	)
}
