import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Label, ScrollArea, Spinner } from "@ch5me/ch5-ui-web";
import {
	ChevronRightIcon,
	PlugIcon,
	RefreshCwIcon,
	SearchIcon,
	ServerIcon,
	ShieldCheckIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
	browseMcpCatalog,
	listMcpConnectionRecords,
	loginMcpConnection,
	registerMcpConnection,
	searchMcpCatalog,
	testMcpConnection,
} from "../../services/backend"
import { normalizeMcpConnectionStatus, type McpConnectionRecord } from "../../lib/mcp-connections"
import { SettingsSection } from "./settings-section"

const CONNECTED_CONNECTIONS: McpConnectionRecord[] = [
	{
		id: "conn-github",
		serverId: "github",
		source: "registry",
		transport: "remote-http",
		ownershipMode: "cloud-only",
		canonicalStore: "gateway",
		credentialMode: "cloud-disposable",
		installState: "installed",
		authState: "authenticated",
		runtimeState: "active",
		testState: "passing",
		status: "connected",
		provenance: { source: "registry", curated: true },
		restorePolicy: "reproject_and_reauth_if_needed",
		credentialArchitecture: null,
		lastTestAt: null,
		lastError: null,
		lastHealthyAt: null,
		registryEntry: null,
		curatedMetadata: {
			serverId: "github",
			rank: 1,
			category: "Engineering",
			whyRecommended: "Repository, issues, and pull-request workflows in one connection.",
			authComplexity: "oauth",
			requiresGateway: false,
			readToolHint: "Search issues and PR state quickly.",
			writeRisk: "mixed",
			manualOnly: false,
			tags: ["repos", "issues", "pull requests"],
			registryBacked: true,
			sourceLabel: "registry",
		},
		projectedOpenCode: null,
		metadata: {},
	},
]

const IMPORTED_CONNECTIONS: McpConnectionRecord[] = [
	{
		id: "conn-imported-cursor-github",
		serverId: "github-imported",
		source: "imported",
		transport: "remote-http",
		ownershipMode: "local-only",
		canonicalStore: "local",
		credentialMode: "local-desktop",
		installState: "installed",
		authState: "authenticated",
		runtimeState: "projected",
		testState: "untested",
		status: "configured",
		provenance: {
			source: "imported",
			importedFrom: "Cursor",
			curated: false,
			editMode: "copy_on_write",
		},
		restorePolicy: "reproject_on_boot",
		credentialArchitecture: null,
		lastTestAt: null,
		lastError: null,
		lastHealthyAt: null,
		registryEntry: null,
		curatedMetadata: null,
		projectedOpenCode: null,
		metadata: {},
	},
]

const RECOMMENDED_CONNECTIONS: McpConnectionRecord[] = [
	{
		id: "conn-notion",
		serverId: "notion",
		source: "curated",
		transport: "remote-http",
		ownershipMode: "local-only",
		canonicalStore: "local",
		credentialMode: "local-desktop",
		installState: "not_installed",
		authState: "unknown",
		runtimeState: "not_projected",
		testState: "untested",
		status: "configured",
		provenance: { source: "curated", curated: true, manualReason: "Direct registry proof pending" },
		restorePolicy: "none",
		credentialArchitecture: null,
		lastTestAt: null,
		lastError: null,
		lastHealthyAt: null,
		registryEntry: null,
		curatedMetadata: {
			serverId: "notion",
			rank: 2,
			category: "Knowledge",
			whyRecommended: "Great default for docs, wiki search, and project notes.",
			authComplexity: "oauth",
			requiresGateway: false,
			readToolHint: "Search workspace docs and project specs.",
			writeRisk: "mixed",
			manualOnly: true,
			tags: ["docs", "wiki", "notes"],
			registryBacked: false,
			sourceLabel: "curated/manual",
		},
		projectedOpenCode: null,
		metadata: {},
	},
	{
		id: "conn-postgres",
		serverId: "postgres",
		source: "curated",
		transport: "local-stdio",
		ownershipMode: "local-only",
		canonicalStore: "local",
		credentialMode: "local-desktop",
		installState: "not_installed",
		authState: "unknown",
		runtimeState: "not_projected",
		testState: "untested",
		status: "configured",
		provenance: { source: "curated", curated: true },
		restorePolicy: "none",
		credentialArchitecture: null,
		lastTestAt: null,
		lastError: null,
		lastHealthyAt: null,
		registryEntry: null,
		curatedMetadata: {
			serverId: "postgres",
			rank: 8,
			category: "Data",
			whyRecommended: "Fastest path to inspect production-safe data with explicit credentials.",
			authComplexity: "env_manual",
			requiresGateway: false,
			readToolHint: "Run safe read queries first.",
			writeRisk: "mixed",
			manualOnly: false,
			tags: ["sql", "database", "inspection"],
			registryBacked: true,
			sourceLabel: "registry",
		},
		projectedOpenCode: null,
		metadata: { missingEnv: true },
	},
]

export function ConnectionsSettings() {
	const [catalogOpen, setCatalogOpen] = useState(false)
	const [detailConnectionId, setDetailConnectionId] = useState<string | null>(null)
	const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
	const [justConnectedId, setJustConnectedId] = useState<string | null>(null)
	const [probeState, setProbeState] = useState<Record<string, { status: "idle" | "running" | "success" | "failure"; message?: string }>>({})

	const handleRegister = async (connection: McpConnectionRecord, target: string) => {
		await registerMcpConnection({
			name: connection.serverId,
			transport: connection.transport,
			target,
			ownershipMode: connection.ownershipMode,
			canonicalStore: connection.canonicalStore,
			restorePolicy: connection.restorePolicy,
			source: connection.source,
			metadata: connection.metadata,
		})
		if (connection.transport !== "local-stdio") {
			await loginMcpConnection(connection.serverId)
		}
		setJustConnectedId(connection.serverId)
	}

	const handleProbe = async (connection: McpConnectionRecord) => {
		setProbeState((current) => ({
			...current,
			[connection.id]: { status: "running", message: "Running safe MCPorter probe..." },
		}))
		try {
			const result = await testMcpConnection(connection.serverId)
			setProbeState((current) => ({
				...current,
				[connection.id]: {
					status: result.ok ? "success" : "failure",
					message: result.ok ? "Safe read probe succeeded." : result.output,
				},
			}))
		} catch (error) {
			const message = error instanceof Error ? error.message : "Probe failed"
			setProbeState((current) => ({
				...current,
				[connection.id]: { status: "failure", message },
			}))
		}
	}
	const [liveConnections, setLiveConnections] = useState<McpConnectionRecord[]>([])

	useEffect(() => {
		let cancelled = false
		async function loadRecords() {
			try {
				const records = await listMcpConnectionRecords()
				if (cancelled) return
				setLiveConnections(
					(records as Array<{
						name: string
						transport: string
						ownershipMode?: string
						authState?: string
						canonicalStore?: string
						restorePolicy?: string
						testState?: string
						status?: string
						runtimeState?: string
						credentialMode?: string
						projectedOpenCode?: McpConnectionRecord["projectedOpenCode"]
						metadata?: Record<string, unknown>
						lastTestAt?: string | null
						lastError?: string | null
						lastHealthyAt?: string | null
					}>).map((record, index) => ({
						id: `live-${record.name}-${index}`,
						serverId: record.name,
						source: ((record.metadata?.source as McpConnectionRecord["source"] | undefined) ?? "manual"),
						transport: (record.transport as McpConnectionRecord["transport"]) ?? "remote-http",
						ownershipMode: (record.ownershipMode as McpConnectionRecord["ownershipMode"]) ?? "local-only",
						canonicalStore: (record.canonicalStore as McpConnectionRecord["canonicalStore"]) ?? "local",
						credentialMode: (record.credentialMode as McpConnectionRecord["credentialMode"]) ?? "local-desktop",
						installState: "installed",
						authState: (record.authState as McpConnectionRecord["authState"]) ?? "unknown",
						runtimeState: (record.runtimeState as McpConnectionRecord["runtimeState"]) ?? "projected",
						testState: (record.testState as McpConnectionRecord["testState"]) ?? "untested",
						status: (record.status as McpConnectionRecord["status"]) ?? "configured",
						provenance: {
							source: ((record.metadata?.source as McpConnectionRecord["source"] | undefined) ?? "manual"),
							curated: false,
						},
						restorePolicy: (record.restorePolicy as McpConnectionRecord["restorePolicy"]) ?? "reproject_on_boot",
						credentialArchitecture: null,
						lastTestAt: record.lastTestAt ?? null,
						lastError: record.lastError ?? null,
						lastHealthyAt: record.lastHealthyAt ?? null,
						registryEntry: null,
						curatedMetadata: null,
						projectedOpenCode: record.projectedOpenCode ?? null,
						metadata: record.metadata ?? {},
					})),
				)
			} catch {
				if (!cancelled) {
					setLiveConnections([])
				}
			}
		}
		void loadRecords()
		return () => {
			cancelled = true
		}
	}, [justConnectedId])

	const allConnections = [...liveConnections, ...IMPORTED_CONNECTIONS, ...RECOMMENDED_CONNECTIONS]
	const detailConnection = allConnections.find((connection) => connection.id === detailConnectionId) ?? null

	return (
		<div className="space-y-8">
			<header>
				<h2 className="text-xl font-semibold">Connections</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Connect MCP servers for docs, data, and runtime actions without leaving Elf.
				</p>
			</header>

			<SettingsSection title="Connected" description="Live server connections ready for runtime use.">
				{liveConnections.map((connection) => (
					<ConnectionRow
						key={connection.id}
						connection={connection}
						actionLabel="Manage"
						onConnect={() => setSelectedConnectionId(connection.id)}
						onTestConnection={() => void handleProbe(connection)}
						onViewDetails={() => setDetailConnectionId(connection.id)}
					/>
				))}
			</SettingsSection>

			<SettingsSection
				title="Imported"
				description="Migrated MCP servers preserved with provenance and copy-on-write behavior."
			>
				{IMPORTED_CONNECTIONS.map((connection) => (
					<ConnectionRow
						key={connection.id}
						connection={connection}
						actionLabel="Adopt"
						onConnect={() => setSelectedConnectionId(connection.id)}
						onTestConnection={() => void handleProbe(connection)}
						onViewDetails={() => setDetailConnectionId(connection.id)}
					/>
				))}
			</SettingsSection>

			<SettingsSection
				title="Recommended"
				description="Curated MCP servers for common engineering and knowledge workflows."
			>
				{RECOMMENDED_CONNECTIONS.map((connection) => (
					<ConnectionRow
						key={connection.id}
						connection={connection}
						actionLabel="Connect"
						onConnect={() => setSelectedConnectionId(connection.id)}
						onTestConnection={() => void handleProbe(connection)}
						onViewDetails={() => setDetailConnectionId(connection.id)}
					/>
				))}
			</SettingsSection>

			<div className="sticky bottom-6 flex gap-3">
				<Button variant="outline" className="flex-1" onClick={() => setCatalogOpen(true)}>
					<PlugIcon className="size-4" aria-hidden="true" />
					Browse MCP catalog
				</Button>
				<Button variant="ghost" onClick={() => setJustConnectedId(null)}>
					<RefreshCwIcon className="size-4" aria-hidden="true" />
					Refresh status
				</Button>
			</div>

			{justConnectedId ? (
				<div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
					Connection activated for {justConnectedId}. Runtime surfaces can refresh without restarting Elf.
				</div>
			) : null}

			{Object.entries(probeState)
				.filter(([, state]) => state.status !== "idle")
				.map(([connectionId, state]) => (
					<div
						key={connectionId}
						className={
							state.status === "failure"
								? "rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
								: "rounded-xl border border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground"
						}
					>
						{connectionId}: {state.message ?? state.status}
					</div>
				))}

			<ConnectionsCatalogDialog
				open={catalogOpen}
				onOpenChange={setCatalogOpen}
				connected={CONNECTED_CONNECTIONS}
				recommended={RECOMMENDED_CONNECTIONS}
				onConnect={(connection) => {
					setSelectedConnectionId(connection.id)
					setCatalogOpen(false)
				}}
				onViewDetails={(connectionId) => setDetailConnectionId(connectionId)}
				onTestConnection={(connectionId) => {
					const connection = allConnections.find((item) => item.id === connectionId)
					if (connection) {
						void handleProbe(connection)
					}
				}}
			/>

			<ConnectionDetailDialog
				connection={detailConnection}
				onOpenChange={(open) => {
					if (!open) {
						setDetailConnectionId(null)
					}
				}}
			/>

			<ConnectionWizardDialog
				connection={allConnections.find((connection) => connection.id === selectedConnectionId) ?? null}
				onConnected={(connectionId) => {
					setJustConnectedId(connectionId)
					setSelectedConnectionId(null)
				}}
				onRegister={handleRegister}
				onOpenChange={(open) => {
					if (!open) {
						setSelectedConnectionId(null)
					}
				}}
			/>
		</div>
	)
}

function ConnectionsCatalogDialog({
	open,
	onOpenChange,
	connected,
	recommended,
	onConnect,
	onViewDetails,
	onTestConnection,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	connected: McpConnectionRecord[]
	recommended: McpConnectionRecord[]
	onConnect: (connection: McpConnectionRecord) => void
	onViewDetails: (connectionId: string) => void
	onTestConnection: (connectionId: string) => void
}) {
	const [search, setSearch] = useState("")
	const [pageCursor, setPageCursor] = useState<string | null>(null)
	const [nextCursor, setNextCursor] = useState<string | null>(null)
	const [catalogEntries, setCatalogEntries] = useState<McpConnectionRecord[]>([])
	const searchRef = useRef<HTMLInputElement>(null)
	const pageSize = 4

	useEffect(() => {
		if (open) {
			const timer = setTimeout(() => searchRef.current?.focus(), 50)
			return () => clearTimeout(timer)
		}
		setSearch("")
		setPageCursor(null)
		setNextCursor(null)
	}, [open])

	const query = search.toLowerCase().trim()

	useEffect(() => {
		let cancelled = false

		async function loadCatalog() {
			try {
				const result = query
					? await searchMcpCatalog({ query, limit: pageSize })
					: await browseMcpCatalog({
							limit: pageSize,
							cursor: pageCursor ? { value: pageCursor, source: "registry" } : null,
						})
				if (cancelled) return
				const typedResult = result as {
					data?: { nextCursor?: { value?: string | null } | null }
					joined?: Array<{
						registry: { id: string; transport: string; description?: string }
						curated?: {
							category?: string
							whyRecommended?: string
							authComplexity?: "one_click" | "oauth" | "device_code" | "env_manual" | "local_command"
							requiresGateway?: boolean
							readToolHint?: string
							writeRisk?: "read_only" | "mixed" | "write_heavy"
							manualOnly?: boolean
							tags?: string[]
							registryBacked?: boolean
							sourceLabel?: "registry" | "curated/manual"
						} | null
					}>
				}
				const joined = typedResult.joined ?? []
				setNextCursor(typedResult.data?.nextCursor?.value ?? null)
				setCatalogEntries(
					joined.map((entry, index) => ({
						id: `catalog-${entry.registry.id}-${index}`,
						serverId: entry.registry.id,
						source: entry.curated ? "curated" : "registry",
						transport: entry.registry.transport as McpConnectionRecord["transport"],
						ownershipMode: "local-only",
						canonicalStore: "local",
						credentialMode: "local-desktop",
						installState: "not_installed",
						authState: "unknown",
						runtimeState: "not_projected",
						testState: "untested",
						status: "configured",
						provenance: { source: entry.curated ? "curated" : "registry", curated: Boolean(entry.curated) },
						restorePolicy: "none",
						credentialArchitecture: null,
						lastTestAt: null,
						lastError: null,
						lastHealthyAt: null,
						registryEntry: null,
						curatedMetadata: entry.curated
							? {
								serverId: entry.registry.id,
								rank: index + 1,
								category: entry.curated.category ?? "Catalog",
								whyRecommended: entry.curated.whyRecommended ?? entry.registry.description ?? "Catalog result",
								authComplexity: entry.curated.authComplexity ?? "oauth",
								requiresGateway: entry.curated.requiresGateway ?? false,
								readToolHint: entry.curated.readToolHint,
								writeRisk: entry.curated.writeRisk ?? "mixed",
								manualOnly: entry.curated.manualOnly ?? false,
								tags: entry.curated.tags ?? [],
								registryBacked: entry.curated.registryBacked ?? false,
								sourceLabel: entry.curated.sourceLabel ?? "curated/manual",
							}
							: null,
						projectedOpenCode: null,
						metadata: {},
					})),
				)
			} catch {
				if (!cancelled) {
					setCatalogEntries([])
				}
			}
		}

		void loadCatalog()
		return () => {
			cancelled = true
		}
	}, [pageCursor, pageSize, query])

	const longTail = useMemo(() => {
		if (catalogEntries.length > 0) return catalogEntries
		const combined = [...recommended, ...connected]
		return combined.filter((connection) => {
			if (!query) return true
			const recommendation = connection.curatedMetadata
			return (
				connection.serverId.includes(query) ||
				recommendation?.category.toLowerCase().includes(query) ||
				recommendation?.tags.some((tag) => tag.toLowerCase().includes(query))
			)
		})
	}, [catalogEntries, connected, query, recommended])

	const paged = longTail.slice(0, pageSize)
	const hasNextPage = Boolean(query ? false : nextCursor)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[72vh] max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<DialogHeader className="px-6 pt-6 pb-4">
					<DialogTitle>MCP catalog</DialogTitle>
					<DialogDescription>
						Curated picks first, then searchable registry-ready connections.
					</DialogDescription>
				</DialogHeader>

				<div className="border-y border-border px-4 py-2">
					<div className="relative">
						<SearchIcon
							className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50"
							aria-hidden="true"
						/>
						<Input
							ref={searchRef}
							value={search}
							onChange={(e) => {
								setSearch(e.target.value)
								setPageCursor(null)
							}}
							placeholder="Search MCP servers..."
							className="h-8 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
						/>
					</div>
				</div>

				<ScrollArea className="min-h-0 flex-1 overflow-hidden">
					<div className="space-y-6 px-6 py-5">
						<div className="space-y-3">
							<div>
								<h3 className="text-sm font-medium">Curated picks</h3>
								<p className="text-xs text-muted-foreground">
									Fastest connections to get useful tooling online.
								</p>
							</div>
							<div className="grid gap-3 md:grid-cols-2">
								{recommended.map((connection) => (
									<CatalogCard
										key={connection.id}
										connection={connection}
										onConnect={() => onConnect(connection)}
										onViewDetails={() => onViewDetails(connection.id)}
									/>
								))}
							</div>
						</div>

						<div className="space-y-3">
							<div className="flex items-center justify-between gap-3">
								<div>
									<h3 className="text-sm font-medium">Browse all</h3>
									<p className="text-xs text-muted-foreground">
										Search and paginate the broader MCP catalog.
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="ghost"
										size="sm"
										disabled={!pageCursor}
										onClick={() => setPageCursor(null)}
									>
										Prev
									</Button>
									<Button
										variant="ghost"
										size="sm"
										disabled={!hasNextPage}
										onClick={() => setPageCursor(nextCursor)}
									>
										Next
									</Button>
								</div>
							</div>
							<div className="space-y-3">
								{paged.map((connection) => (
									<ConnectionRow
										key={connection.id}
										connection={connection}
										actionLabel="Connect"
										onConnect={() => onConnect(connection)}
										onTestConnection={() => onTestConnection(connection.id)}
										onViewDetails={() => onViewDetails(connection.id)}
									/>


								))}
								{paged.length === 0 ? (
									<div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
										No MCP servers matching “{search}”
									</div>
								) : null}
							</div>
						</div>
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	)
}

function CatalogCard({
	connection,
	onConnect,
	onViewDetails,
}: {
	connection: McpConnectionRecord
	onConnect: () => void
	onViewDetails: () => void
}) {
	const recommendation = connection.curatedMetadata
	return (
		<div className="rounded-xl border border-border bg-muted/10 p-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<div className="text-sm font-medium capitalize">{connection.serverId}</div>
					<div className="mt-1 text-xs text-muted-foreground">{recommendation?.category}</div>
				</div>
				<Badge variant="outline" className="capitalize">
					{connection.transport.replace("-", " ")}
				</Badge>
			</div>
			<p className="mt-3 text-sm text-foreground">{recommendation?.whyRecommended}</p>
			<div className="mt-3 flex flex-wrap gap-2">
				{recommendation?.tags.map((tag) => (
					<Badge key={tag} variant="secondary">
						{tag}
					</Badge>
				))}
			</div>
			<div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
				<span>{recommendation?.sourceLabel === "registry" ? "Registry backed" : "Curated manual"}</span>
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" onClick={onViewDetails}>
						Details
						<ChevronRightIcon className="size-3.5" aria-hidden="true" />
					</Button>
					<Button variant="outline" size="sm" onClick={onConnect}>
						Connect
					</Button>
				</div>
			</div>
		</div>
	)
}

type ConnectionWizardStep =
	| { type: "choose-path" }
	| { type: "ownership" }
	| { type: "oauth" }
	| { type: "device-code" }
	| { type: "env-setup" }
	| { type: "stdio-setup" }
	| { type: "success" }

function ConnectionWizardDialog({
	connection,
	onConnected,
	onOpenChange,
	onRegister,
}: {
	connection: McpConnectionRecord | null
	onConnected: (connectionId: string) => void
	onOpenChange: (open: boolean) => void
	onRegister: (connection: McpConnectionRecord, target: string) => Promise<void>
}) {
	const [step, setStep] = useState<ConnectionWizardStep>({ type: "choose-path" })
	const [command, setCommand] = useState("npx -y @modelcontextprotocol/server-postgres")
	const [envValue, setEnvValue] = useState("")
	const [deviceCode] = useState("MCP-4821")
	const [ownershipMode, setOwnershipMode] = useState<"local-only" | "cloud-only">("local-only")
	const isOpen = Boolean(connection)

	useEffect(() => {
		if (!connection) return
		setOwnershipMode(connection.ownershipMode === "cloud-only" ? "cloud-only" : "local-only")
		if (connection.transport === "local-stdio") {
			setStep({ type: "stdio-setup" })
			return
		}
		if (connection.curatedMetadata?.authComplexity === "env_manual") {
			setStep({ type: "env-setup" })
			return
		}
		setStep({ type: "choose-path" })
	}, [connection])

	if (!connection) return null

	const title = connection.serverId

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="capitalize">Connect {title}</DialogTitle>
					<DialogDescription>
						Guided MCP setup for auth, ownership, environment, and local command flows.
					</DialogDescription>
				</DialogHeader>
				{step.type === "choose-path" ? (
					<div className="space-y-3 py-2">
						<Button variant="outline" className="w-full justify-start" onClick={() => setStep({ type: "ownership" })}>
							OAuth in browser
						</Button>
						<Button variant="outline" className="w-full justify-start" onClick={() => setStep({ type: "device-code" })}>
							Manual device code
						</Button>
						<Button variant="outline" className="w-full justify-start" onClick={() => setStep({ type: "env-setup" })}>
							Environment setup
						</Button>
						<Button variant="outline" className="w-full justify-start" onClick={() => setStep({ type: "stdio-setup" })}>
							Local stdio command
						</Button>
					</div>
				) : step.type === "ownership" ? (
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label>Ownership mode</Label>
							<div className="grid gap-2 sm:grid-cols-2">
								<Button
									variant={ownershipMode === "local-only" ? "default" : "outline"}
									onClick={() => setOwnershipMode("local-only")}
								>
									Keep secrets local
								</Button>
								<Button
									variant={ownershipMode === "cloud-only" ? "default" : "outline"}
									onClick={() => setOwnershipMode("cloud-only")}
								>
									Restore in cloud
								</Button>
							</div>
						</div>
						<div className="flex justify-between gap-3">
							<Button variant="ghost" onClick={() => setStep({ type: "choose-path" })}>
								Back
							</Button>
							<Button onClick={() => setStep({ type: "oauth" })}>Continue</Button>
						</div>
					</div>
				) : step.type === "oauth" ? (
					<div className="space-y-4 py-2">
						<div className="rounded-lg border border-border bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
							Open browser-based OAuth, then return here to finish setup.
						</div>
						<Button onClick={() => setStep({ type: "success" })}>
							<Spinner className="size-4" />
							Launch OAuth flow
						</Button>
					</div>
				) : step.type === "device-code" ? (
					<div className="space-y-4 py-2">
						<div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
							<div className="text-xs uppercase tracking-wide text-muted-foreground">Device code</div>
							<div className="mt-2 text-lg font-semibold tracking-widest text-foreground">{deviceCode}</div>
						</div>
						<Button onClick={() => setStep({ type: "success" })}>I entered the code</Button>
					</div>
				) : step.type === "env-setup" ? (
					<div className="space-y-4 py-2">
						<Label htmlFor="env-value">Required environment value</Label>
						<Input
							id="env-value"
							placeholder="DATABASE_URL=..."
							value={envValue}
							onChange={(event) => setEnvValue(event.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Set required environment or config before restarting the runtime.
						</p>
						<Button onClick={() => setStep({ type: "success" })} disabled={!envValue.trim()}>
							Save guidance
						</Button>
					</div>
				) : step.type === "stdio-setup" ? (
					<div className="space-y-4 py-2">
						<Label htmlFor="stdio-command">Local command</Label>
						<Input
							id="stdio-command"
							value={command}
							onChange={(event) => setCommand(event.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Use a local stdio server command when this connection lives entirely on your machine.
						</p>
						<Button onClick={() => setStep({ type: "success" })}>Save command</Button>
					</div>
				) : (
					<div className="space-y-4 py-2">
						<div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
							Setup ready. Next step can project this server into runtime without restarting the app.
						</div>
						<Button
							onClick={async () => {
								const target =
									connection.transport === "local-stdio"
										? command
										: `https://registry.modelcontextprotocol.io/v0/servers?search=${connection.serverId}`
								await onRegister(connection, target)
								onConnected(connection.id)
								onOpenChange(false)
							}}
						>
							Done
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}

function ConnectionDetailDialog({
	connection,
	onOpenChange,
}: {
	connection: McpConnectionRecord | null
	onOpenChange: (open: boolean) => void
}) {
	const recommendation = connection?.curatedMetadata
	const normalized = connection ? normalizeMcpConnectionStatus(connection) : null
	const toolCount = recommendation ? recommendation.tags.length + 2 : 0
	const readWrite = recommendation?.writeRisk === "read_only" ? "Read only" : "Read + write"

	return (
		<Dialog open={Boolean(connection)} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="capitalize">{connection?.serverId ?? "Connection details"}</DialogTitle>
					<DialogDescription>
						Inspect trust, setup, and runtime posture before you connect this MCP server.
					</DialogDescription>
				</DialogHeader>
				{connection && normalized ? (
					<div className="space-y-4 text-sm">
						<div className="grid gap-3 sm:grid-cols-2">
							<DetailPill label="Transport" value={connection.transport.replace("-", " ")} />
							<DetailPill label="Auth" value={connection.authState.replace("_", " ")} />
							<DetailPill label="Health" value={normalized.label} />
							<DetailPill label="Ownership" value={connection.ownershipMode.replace("-", " ")} />
							<DetailPill label="Tool count" value={`${toolCount}`} />
							<DetailPill label="Read/write" value={readWrite} />
						</div>
						<div className="rounded-lg border border-border bg-muted/10 p-4 text-muted-foreground">
							<div className="font-medium text-foreground">Recommendation</div>
							<p className="mt-1">{recommendation?.whyRecommended}</p>
							<div className="mt-3 flex flex-wrap gap-2">
								{recommendation?.tags.map((tag) => (
									<Badge key={tag} variant="secondary">
										{tag}
									</Badge>
								))}
							</div>
						</div>
						<div className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
							Schema details stay collapsed until an explicit describe action requests one tool contract.
						</div>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	)
}

function DetailPill({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-border px-3 py-2">
			<div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
			<div className="mt-1 capitalize text-foreground">{value}</div>
		</div>
	)
}

function ConnectionRow({
	connection,
	actionLabel,
	onConnect,
	onTestConnection,
	onViewDetails,
}: {
	connection: McpConnectionRecord
	actionLabel: string
	onConnect: () => void
	onTestConnection: () => void
	onViewDetails: () => void
}) {
	const normalized = normalizeMcpConnectionStatus(connection)
	const recommendation = connection.curatedMetadata

	return (
		<div className="flex items-center gap-3 px-4 py-3">
			<div className="flex size-10 items-center justify-center rounded-lg bg-muted/30 text-foreground">
				<ServerIcon className="size-4" aria-hidden="true" />
			</div>
			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium capitalize">{connection.serverId}</span>
					<Badge variant="outline" className="capitalize">
						{connection.transport.replace("-", " ")}
					</Badge>
					<Badge variant="secondary">{normalized.label}</Badge>
				</div>
				<p className="text-xs text-muted-foreground">{normalized.description}</p>
				{recommendation ? (
					<div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
						<span>{recommendation.category}</span>
						<span>•</span>
						<span>{recommendation.whyRecommended}</span>
					</div>
				) : null}
			</div>
			<div className="flex items-center gap-2">
				{recommendation?.registryBacked ? (
					<ShieldCheckIcon className="size-4 text-emerald-500" aria-hidden="true" />
				) : null}
				<Button variant="ghost" size="sm" onClick={onViewDetails}>
					Details
					<ChevronRightIcon className="size-3.5" aria-hidden="true" />
				</Button>
				<Button variant="outline" size="sm" onClick={onTestConnection}>
					Test connection
				</Button>
				<Button variant="outline" size="sm" onClick={onConnect}>
					{actionLabel}
				</Button>
			</div>

		</div>
	)
}
