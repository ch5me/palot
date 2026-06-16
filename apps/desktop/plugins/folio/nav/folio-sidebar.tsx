/**
 * Folio nav-sidebar body — the left-rail content for the Folio workspace.
 *
 * Rendered in-process by the host (host-reconciler mode) when the Folio
 * tab is active, inside the shared plugin error boundary. App-global, so
 * it takes no `agent`. The "pages" listed here are Folio's own surfaces;
 * each will project as a workspace-scoped side-panel page (Slice 2) so
 * selecting one opens it on the right while the Folio rail stays active.
 */

import {
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@ch5me/ch5-ui-web"
import { BookMarkedIcon, FolderOpenIcon, LayoutGridIcon, LibraryIcon } from "lucide-react"

interface FolioPage {
	readonly id: string
	readonly label: string
	readonly icon: typeof LibraryIcon
}

const FOLIO_PAGES: readonly FolioPage[] = [
	{ id: "library", label: "Library", icon: LibraryIcon },
	{ id: "documents", label: "Documents", icon: FolderOpenIcon },
	{ id: "collections", label: "Collections", icon: LayoutGridIcon },
	{ id: "bookmarks", label: "Bookmarks", icon: BookMarkedIcon },
]

export default function FolioSidebar() {
	return (
		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupLabel className="flex items-center gap-1.5">
					<LibraryIcon className="size-3.5 shrink-0 text-muted-foreground" />
					Folio
				</SidebarGroupLabel>
				<SidebarGroupContent>
					<p className="px-2 pb-2 text-xs text-muted-foreground/70">
						Your Folio workspace. Pages open as side panels on the right.
					</p>
					<SidebarMenu>
						{FOLIO_PAGES.map((page) => {
							const Icon = page.icon
							return (
								<SidebarMenuItem key={page.id}>
									<SidebarMenuButton tooltip={page.label} className="text-muted-foreground">
										<Icon className="size-4" />
										<span>{page.label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							)
						})}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>
	)
}
