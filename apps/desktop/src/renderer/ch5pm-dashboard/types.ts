export interface Ch5PmSnapshotTicketRow {
	ticketId?: string
	id?: string
	projectIdentifier?: string
	projectName?: string
	sequenceId?: number
	repo?: string
	name?: string
	title?: string
	state?: string
	priority?: string
	classification?: string
	boxId?: string
	sourceBoxId?: string
	slotId?: string
	tmuxSession?: string
	sessionId?: string
	sessionLive?: boolean
	workerLive?: boolean
	tmuxLive?: boolean
	workerExited?: boolean
	manualTracking?: boolean
	runState?: string
	runtimeLastActivityAt?: string
	runtimeLastActivityMinutesAgo?: number
	runtimeMessageCount?: number
	updatedAt?: string
	updatedMinutesAgo?: number
	planeUrl?: string
}

export interface Ch5PmSessionRow {
	sourceBoxId?: string
	sessionId?: string
	projectIdentifier?: string
	sequenceId?: number
	title?: string
	repo?: string
	directory?: string
	status?: string
	state?: string
	scope?: string
	role?: string
	tmuxSession?: string
	tmuxPaneId?: string
	cmuxWorkspaceRef?: string
	cmuxSurfaceRef?: string
	elapsedMinutes?: number
	messageCount?: number
	toolCount?: number
	ticketId?: string
}

export interface Ch5PmSignalRow extends Ch5PmSessionRow {
	classification?: string
	stateName?: string
	sourceKind?: string
	statusLine?: string
	needsInvestigation?: boolean
	signal?: string
	manualTracking?: boolean
	manualTrackingStateName?: string
	closedByPlane?: boolean
	planeUrl?: string
	reopenable?: boolean
}

export interface Ch5PmProcessRow {
	pid?: number
	cpuPct?: number
	rssMiB?: number
	category?: string
	command?: string
}

export interface Ch5PmPressureCategory {
	processes?: number
	cpuPct?: number
	rssMiB?: number
}

export interface Ch5PmPressurePayload {
	schema?: string
	generatedAt?: string
	pressure?: {
		level?: string
		score?: number
		dispatchBudget?: number
		reasons?: string[]
	}
	system?: {
		loadAvg?: number[]
		cpu?: {
			busyPct?: number
		}
	}
	memory?: {
		availableGiB?: number
		compressorGiB?: number
	}
	processes?: {
		ok?: boolean
		totals?: {
			rssMiB?: number
			opencodeProcesses?: number
			opencodeRunProcesses?: number
			opencodeTuiProcesses?: number
		}
		topProcesses?: Ch5PmProcessRow[]
		categories?: Record<string, Ch5PmPressureCategory>
	}
	opencode?: {
		activeSessions?: number
		rootSessions?: number
		childSessions?: number
		repoCounts?: Record<string, number>
	}
}

export interface Ch5PmAttentionRequestRow {
	id?: string
	ticketSeq?: number
	project?: string
	deadTimeSeconds?: number
	status?: string
}

export interface Ch5PmAttentionMetrics {
	schema?: string
	generatedAt?: string
	openRequestCount?: number
	totalOpenDeadTimeSeconds?: number
	maxDeadTimeSeconds?: number
	avgResolutionSeconds?: number
	resolvedTodayCount?: number
	blockedWithoutAttentionCount?: number
	openRequests?: Ch5PmAttentionRequestRow[]
	blockedWithoutAttention?: Ch5PmSnapshotTicketRow[]
}

export interface Ch5PmCompactBox {
	boxId?: string
	boxName?: string
	nodeType?: string
	kind?: string
	boxMode?: string
	hub?: boolean
	reachable?: boolean
	healthy?: boolean
	boxApiEnabled?: boolean
	displayEnabled?: boolean
	activeDisplay?: boolean
	dispatchEnabled?: boolean
	dispatchEligible?: boolean
	notDispatchTarget?: boolean
	checkedAt?: string
	error?: string
	displayState?: Record<string, unknown>
	opencodeHost?: Record<string, unknown>
	storage?: Record<string, unknown>
	workspacePrereqs?: Record<string, unknown>
	resourcePressure?: Ch5PmPressurePayload
	pressure?: Record<string, unknown>
	slots?: Record<string, unknown>
	workers?: Ch5PmSnapshotTicketRow[]
}

export interface Ch5PmSnapshotPayload {
	schema?: string
	kind?: string
	generatedAt?: string
	degraded?: boolean
	error?: string
	node?: {
		boxId?: string
		nodeType?: string
	}
	capabilities?: Record<string, unknown>
	counts?: {
		inProgress?: number
		todo?: number
		blocked?: number
		closedSessionSignals?: number
	}
	planeApiBudget?: Record<string, unknown>
	managerBrief?: string
	nodeBrief?: string
	dataAges?: Record<string, unknown>
	clusterDisplay?: {
		activeDisplayBoxId?: string | null
	}
	displayState?: {
		displayEnabled?: boolean
		activeDisplay?: boolean
		layoutHealthy?: boolean
	}
	localDisplayState?: {
		displayEnabled?: boolean
		activeDisplay?: boolean
		layoutHealthy?: boolean
	}
	daemon?: {
		name?: string
		dryRun?: boolean
		normalSnoopLevel?: string
		timingsMs?: Record<string, unknown>
		tickPhaseTimingsMs?: Record<string, unknown>
		performanceWarningMs?: number
		tick?: {
			snapshotStale?: boolean
		}
	}
	runtime?: {
		dispatch?: {
			enabled?: boolean
		}
		opencodeHost?: Record<string, unknown>
		opencodeDb?: Record<string, unknown>
		tmux?: Record<string, unknown>
		claudeCode?: Record<string, unknown>
		statusPane?: Record<string, unknown>
		cmux?: {
			slots?: Array<{
				state?: string
				workerLive?: boolean
				tmuxAttached?: boolean
				surfaceExists?: boolean
				ticketId?: string
				slotKey?: string
				issues?: string[]
			}>
		}
		cmuxSurfaceMemory?: Record<string, unknown>
		resourcePressure?: Ch5PmPressurePayload
		nodes?: Ch5PmCompactBox[]
		boxes?: Ch5PmCompactBox[]
	}
	jobs?: {
		counts?: {
			running?: number
			queued?: number
			held?: number
		}
		backlog?: number
	}
	attentionMetrics?: Ch5PmAttentionMetrics
	plane?: {
		workspace?: string
		projectIdentifier?: string
		webBaseUrl?: string
	}
	idleNudges?: Array<{
		ticketId?: string
		status?: string
		idleMinutes?: number
		reason?: string
		error?: string
	}>
	activeTickets?: Ch5PmSnapshotTicketRow[]
	queueTickets?: Ch5PmSnapshotTicketRow[]
	blockedTickets?: Ch5PmSnapshotTicketRow[]
	inactiveTickets?: Ch5PmSnapshotTicketRow[]
	manualSessions?: Ch5PmSessionRow[]
	sessionSignals?: Ch5PmSignalRow[]
	closedSessionSignals?: Ch5PmSignalRow[]
	claudeCodeSessions?: Ch5PmSessionRow[]
	nodes?: Record<string, Ch5PmCompactBox> | Ch5PmCompactBox[]
	boxes?: Record<string, Ch5PmCompactBox> | Ch5PmCompactBox[]
}

export interface Ch5PmSystemPayload {
	generatedAt?: string
	system?: Ch5PmPressurePayload["system"]
	memory?: Ch5PmPressurePayload["memory"]
}

export interface Ch5PmDashboardState {
	snapshot: Ch5PmSnapshotPayload | null
	pressure: Ch5PmPressurePayload | null
	system: Ch5PmSystemPayload | null
	streamConnected: boolean
	streamError: string | null
	lastEventAt: string | null
}

export interface Ch5PmLiveBox {
	id: string
	role?: string
	daemon: {
		url?: string
		altUrl?: string
		health?: string
		boundHost?: string
	}
	opencodeServe?: string
	notes?: string
}

export interface Ch5PmLiveSession {
	id: string
	title: string
	repo?: string
	box?: string
	state?: string
	lane?: string
	projectSlug?: string
}

export interface Ch5PmLiveLane {
	name: string
	symbol?: string
	status?: string
	session?: string
	goal?: string
}

export interface Ch5PmLiveBackgroundAgent {
	task: string
	status?: string
	milestones?: Record<string, string>
}

export interface Ch5PmLiveReadyFrontierTicket {
	ticket: string
	title: string
	priority?: string
	repo?: string
	coveredBy?: string | null
}

export interface Ch5PmLivePlaneSummary {
	workspaceSlug?: string
	projects?: number
	epics?: number
	readUrl?: string
	readyFrontier: Ch5PmLiveReadyFrontierTicket[]
	humanGated?: {
		count?: number
		note?: string
	}
}

export interface Ch5PmNeedsChrisItem {
	ticket?: string
	title?: string
	note?: string
	source?: string
	priority?: string
}

export interface Ch5PmFollowUp {
	source?: string
	item: string
	status?: string
	resolution?: string
}

export interface Ch5PmBabysitter {
	running?: boolean
	surface?: string
	package?: string
	loopSeconds?: number
	watchdogCron?: string
}

export interface Ch5PmLineageSession {
	id: string
	role: "planning" | "implementation" | "review" | "manual"
	agent?: string
	status?: string
	output?: string
	input?: string
	repo?: string
	projectSlug?: string
}

export interface Ch5PmLineageEdge {
	from: string
	to: string
	kind?: string
}

export interface Ch5PmLineageItem {
	ticket: string
	title?: string
	kind?: string
	origin?: string
	plan?: string
	sessions: Ch5PmLineageSession[]
	edges: Ch5PmLineageEdge[]
}

export interface Ch5PmLiveState {
	_doc?: string
	schemaVersion?: number
	updatedAt?: string
	generatedBy?: string
	host?: string
	boxes: Ch5PmLiveBox[]
	sessions: Ch5PmLiveSession[]
	lanes: Ch5PmLiveLane[]
	backgroundAgents: Ch5PmLiveBackgroundAgent[]
	plane: Ch5PmLivePlaneSummary
	recentCompletions: string[]
	needsChris: Ch5PmNeedsChrisItem[]
	followUps?: Ch5PmFollowUp[]
	babysitter?: Ch5PmBabysitter
	lineage?: Ch5PmLineageItem[]
}

export interface Ch5PmEventStreamHandlers {
	onSnapshot?: (payload: Ch5PmSnapshotPayload) => void
	onPressure?: (payload: Ch5PmPressurePayload) => void
	onSystem?: (payload: Ch5PmSystemPayload) => void
	onHeartbeat?: () => void
	onOpen?: () => void
	onError?: (message: string) => void
}
