/**
 * Firefly Plugin Marketplace — Browse/Install UI (Phase 1, §11)
 *
 * Minimal but real marketplace browse surface:
 *   - Search Open VSX for theme extensions
 *   - Install a theme (→ IPC → install orchestrator)
 *   - List installed extensions with apply/uninstall controls
 *
 * Modeled on v2-plugins-panel.tsx: same styling, same patterns,
 * same tanstack-query hooks. No new design patterns introduced.
 *
 * Architecture:
 *   - Search results come from Open VSX via main process IPC (gallery-search).
 *   - Install/uninstall/apply-theme are IPC mutations.
 *   - Installed list is fetched via list-installed IPC.
 *   - "Apply" only records the applied theme id (Phase 1 stub).
 *     Full CSS-var injection is out of scope for Phase 1.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	DownloadIcon,
	Loader2Icon,
	PackageIcon,
	SearchIcon,
	ShoppingBagIcon,
	TrashIcon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@ch5me/ch5-ui-web"

// ---------------------------------------------------------------------------
// Bridge helpers (Electron only)
// ---------------------------------------------------------------------------

function getMarketplaceBridge() {
	const w = window as unknown as {
		elf?: {
			marketplace?: typeof window.elf.marketplace
		}
	}
	const bridge = w.elf?.marketplace
	if (!bridge) throw new Error("elf.marketplace bridge not available")
	return bridge
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useGallerySearch(query: string, enabled: boolean) {
	return useQuery({
		queryKey: ["marketplace", "gallery-search", query],
		queryFn: () =>
			getMarketplaceBridge().gallerySearch({
				query: query || undefined,
				category: "Themes",
				size: 20,
			}),
		enabled,
		staleTime: 60_000,
	})
}

function useInstalledExtensions() {
	return useQuery({
		queryKey: ["marketplace", "installed"],
		queryFn: () => getMarketplaceBridge().listInstalled(),
		staleTime: 10_000,
	})
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
	return (
		<div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
			{children}
		</div>
	)
}

interface GalleryEntryProps {
	namespace: string
	name: string
	displayName: string | null
	description: string | null
	version: string
	downloadCount: number | null
	onInstall: () => void
	installing: boolean
	installed: boolean
}

function GalleryEntry({
	displayName,
	name,
	namespace,
	description,
	version,
	downloadCount,
	onInstall,
	installing,
	installed,
}: GalleryEntryProps) {
	return (
		<li className="rounded-md border border-border bg-card px-3 py-2">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 space-y-0.5">
					<div className="flex items-center gap-1.5 flex-wrap">
						<span className="font-medium text-xs text-foreground truncate">
							{displayName ?? name}
						</span>
						<span className="text-[10px] text-muted-foreground">{version}</span>
						{downloadCount !== null ? (
							<span className="text-[10px] text-muted-foreground">
								↓ {downloadCount.toLocaleString()}
							</span>
						) : null}
					</div>
					<div className="font-mono text-[10px] text-muted-foreground truncate">
						{namespace}.{name}
					</div>
					{description ? (
						<div className="text-[10px] text-muted-foreground line-clamp-2">{description}</div>
					) : null}
				</div>
				<Button
					onClick={onInstall}
					disabled={installing || installed}
					variant="outline"
					size="sm"
					type="button"
					className="shrink-0"
					title={installed ? "Already installed" : "Install this theme"}
				>
					{installing ? (
						<Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
					) : installed ? (
						<CheckCircleIcon className="size-3.5 text-emerald-600" aria-hidden="true" />
					) : (
						<DownloadIcon className="size-3.5" aria-hidden="true" />
					)}
					{installed ? "Installed" : "Install"}
				</Button>
			</div>
		</li>
	)
}

interface InstalledEntryProps {
	packageId: string
	installationId: string
	displayName: string | null
	externalId: string
	version: string
	themes: { id: string; label: string; kind: string }[]
	appliedThemeId: string | null
	onUninstall: () => void
	onApplyTheme: (themeId: string) => void
	busy: boolean
}

function InstalledEntry({
	displayName,
	externalId,
	version,
	themes,
	appliedThemeId,
	onUninstall,
	onApplyTheme,
	busy,
}: InstalledEntryProps) {
	return (
		<li className="rounded-md border border-border bg-card px-3 py-2 space-y-1.5">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 space-y-0.5">
					<div className="flex items-center gap-1.5 flex-wrap">
						<span className="font-medium text-xs text-foreground truncate">
							{displayName ?? externalId}
						</span>
						<span className="text-[10px] text-muted-foreground">{version}</span>
					</div>
					<div className="font-mono text-[10px] text-muted-foreground truncate">{externalId}</div>
				</div>
				<Button
					onClick={onUninstall}
					disabled={busy}
					variant="outline"
					size="sm"
					type="button"
					className="shrink-0"
					title="Uninstall"
				>
					{busy ? (
						<Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
					) : (
						<TrashIcon className="size-3.5" aria-hidden="true" />
					)}
					Remove
				</Button>
			</div>
			{themes.length > 0 ? (
				<div className="flex flex-wrap gap-1">
					{themes.map((theme) => (
						<button
							key={theme.id}
							type="button"
							onClick={() => onApplyTheme(theme.id)}
							disabled={busy}
							className={`rounded px-2 py-0.5 text-[10px] border transition-colors ${
								appliedThemeId === theme.id
									? "bg-primary/15 border-primary/50 text-primary font-medium"
									: "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
							}`}
							title={`Apply ${theme.label}`}
						>
							{theme.label}
							{appliedThemeId === theme.id ? " ✓" : ""}
						</button>
					))}
				</div>
			) : null}
		</li>
	)
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface MarketplacePanelProps {
	className?: string
}

export function MarketplacePanel({ className }: MarketplacePanelProps) {
	const [searchInput, setSearchInput] = useState("")
	const [activeQuery, setActiveQuery] = useState("")
	const [activeTab, setActiveTab] = useState<"browse" | "installed">("browse")
	const inputRef = useRef<HTMLInputElement>(null)
	const queryClient = useQueryClient()

	// Trigger search on Enter or debounce
	useEffect(() => {
		if (!searchInput.trim()) {
			setActiveQuery("")
			return
		}
		const t = setTimeout(() => setActiveQuery(searchInput.trim()), 400)
		return () => clearTimeout(t)
	}, [searchInput])

	const gallery = useGallerySearch(activeQuery, activeTab === "browse")
	const installed = useInstalledExtensions()

	// Track installed externalIds for "already installed" badge
	const installedExternalIds = new Set(
		(installed.data?.extensions ?? []).map((e) => e.externalId),
	)

	const installMutation = useMutation({
		mutationFn: (input: { namespace: string; name: string; version: string }) =>
			getMarketplaceBridge().install({
				kind: "open-vsx",
				namespace: input.namespace,
				name: input.name,
				version: input.version,
			}),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["marketplace", "installed"] })
		},
	})

	const uninstallMutation = useMutation({
		mutationFn: (installationId: string) =>
			getMarketplaceBridge().uninstall(installationId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["marketplace", "installed"] })
		},
	})

	const applyThemeMutation = useMutation({
		mutationFn: ({ installationId, themeId }: { installationId: string; themeId: string }) =>
			getMarketplaceBridge().applyTheme(installationId, themeId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["marketplace", "installed"] })
		},
	})

	const installedCount = installed.data?.extensions.length ?? 0

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			{/* Header */}
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center gap-2">
					<ShoppingBagIcon className="size-4 text-foreground" aria-hidden="true" />
					<h3 className="text-sm font-medium text-foreground">Marketplace</h3>
				</div>
				<p className="mt-0.5 text-xs text-muted-foreground">
					Browse and install VS Code themes from Open VSX
				</p>
				{/* Tab bar */}
				<div className="mt-2 flex gap-1">
					{(["browse", "installed"] as const).map((tab) => (
						<button
							key={tab}
							type="button"
							onClick={() => setActiveTab(tab)}
							className={`rounded px-2 py-0.5 text-[11px] capitalize transition-colors ${
								activeTab === tab
									? "bg-primary/10 text-primary font-medium"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							{tab}
							{tab === "installed" && installedCount > 0 ? ` (${installedCount})` : ""}
						</button>
					))}
				</div>
			</div>

			{/* Body */}
			<div className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-3">
				{activeTab === "browse" ? (
					<>
						{/* Search box */}
						<div className="relative mb-3">
							<SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
							<input
								ref={inputRef}
								type="search"
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								placeholder="Search themes on Open VSX…"
								className="w-full rounded-md border border-border bg-input pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
							/>
						</div>

						{/* Results */}
						{gallery.isLoading ? (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
								Searching…
							</div>
						) : gallery.isError ? (
							<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
								<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
								<div>
									Gallery search failed.
									<br />
									<span className="text-[10px] text-muted-foreground">
										{String(gallery.error ?? "")}
									</span>
								</div>
							</div>
						) : gallery.data ? (
							<>
								<SectionHeader>
									{gallery.data.totalSize.toLocaleString()} results
									{activeQuery ? ` for "${activeQuery}"` : " · popular themes"}
								</SectionHeader>
								{gallery.data.extensions.length === 0 ? (
									<div className="rounded-md border border-dashed border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
										No themes found. Try a different search term.
									</div>
								) : (
									<ul className="space-y-2">
										{gallery.data.extensions.map((ext) => {
											const extId = `${ext.namespace}.${ext.name}`
											const isInstalled = installedExternalIds.has(extId)
											const isInstalling =
												installMutation.isPending &&
												installMutation.variables?.namespace === ext.namespace &&
												installMutation.variables?.name === ext.name
											return (
												<GalleryEntry
													key={extId}
													namespace={ext.namespace}
													name={ext.name}
													displayName={ext.displayName}
													description={ext.description}
													version={ext.version}
													downloadCount={ext.downloadCount}
													installed={isInstalled}
													installing={isInstalling}
													onInstall={() =>
														installMutation.mutate({
															namespace: ext.namespace,
															name: ext.name,
															version: ext.version,
														})
													}
												/>
											)
										})}
									</ul>
								)}
								{installMutation.isError ? (
									<div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
										<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
										Install failed: {String(installMutation.error ?? "")}
									</div>
								) : null}
							</>
						) : (
							<div className="text-xs text-muted-foreground">
								Type to search for themes on Open VSX.
							</div>
						)}
					</>
				) : (
					/* Installed tab */
					<>
						{installed.isLoading ? (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
								Loading installed extensions…
							</div>
						) : installed.isError ? (
							<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
								<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
								Failed to load installed extensions.
							</div>
						) : installedCount === 0 ? (
							<div className="rounded-md border border-dashed border-border bg-muted/10 px-3 py-3 text-center text-xs text-muted-foreground">
								<PackageIcon className="mx-auto mb-1 size-5 opacity-40" aria-hidden="true" />
								No themes installed yet. Browse the gallery to install one.
							</div>
						) : (
							<>
								<SectionHeader>{installedCount} installed</SectionHeader>
								<ul className="space-y-2">
									{(installed.data?.extensions ?? []).map((ext) => {
										const isUninstalling =
											uninstallMutation.isPending &&
											uninstallMutation.variables === ext.installationId
										const isApplying =
											applyThemeMutation.isPending &&
											applyThemeMutation.variables?.installationId === ext.installationId
										return (
											<InstalledEntry
												key={ext.installationId}
												packageId={ext.packageId}
												installationId={ext.installationId}
												displayName={ext.displayName}
												externalId={ext.externalId}
												version={ext.version}
												themes={ext.themes}
												appliedThemeId={ext.appliedThemeId}
												onUninstall={() => uninstallMutation.mutate(ext.installationId)}
												onApplyTheme={(themeId) =>
													applyThemeMutation.mutate({
														installationId: ext.installationId,
														themeId,
													})
												}
												busy={isUninstalling || isApplying}
											/>
										)
									})}
								</ul>
							</>
						)}
					</>
				)}
			</div>
		</div>
	)
}
