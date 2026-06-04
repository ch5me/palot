import type { Ch5PmDashboardState } from "./types"

const now = Date.now()
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString()

export const MOCK_CH5PM_DASHBOARD_STATE: Ch5PmDashboardState = {
	snapshot: {
		schema: "ch5pm.snapshot.v1",
		kind: "cluster",
		generatedAt: iso(1),
		node: {
			boxId: "dell",
			nodeType: "hub",
		},
		counts: {
			inProgress: 3,
			todo: 5,
			blocked: 1,
			closedSessionSignals: 2,
		},
		managerBrief: "Queue healthy. One blocked ticket needs human answer. Two worker slots live.",
		clusterDisplay: {
			activeDisplayBoxId: "laptop",
		},
		displayState: {
			displayEnabled: true,
			activeDisplay: false,
			layoutHealthy: true,
		},
		localDisplayState: {
			displayEnabled: true,
			activeDisplay: false,
			layoutHealthy: true,
		},
		daemon: {
			name: "CH5PMDaemon",
			tick: {
				snapshotStale: false,
			},
		},
		runtime: {
			dispatch: {
				enabled: true,
			},
			cmux: {
				slots: [
					{
						state: "assigned",
						workerLive: true,
						tmuxAttached: true,
						surfaceExists: true,
						ticketId: "CH5COMPAC4C-108",
						slotKey: "fitbot-slot-1",
					},
					{
						state: "assigned",
						workerLive: true,
						tmuxAttached: false,
						surfaceExists: true,
						ticketId: "CH5COMPAC4C-110",
						slotKey: "cloud-slot-2",
						issues: ["tmux detached"],
					},
				],
			},
			resourcePressure: {
				generatedAt: iso(1),
				pressure: {
					level: "green",
					score: 22,
					dispatchBudget: 3,
					reasons: ["memory healthy", "OpenCode session count below threshold"],
				},
				system: {
					loadAvg: [2.1, 2.4, 2.6],
					cpu: {
						busyPct: 38,
					},
				},
				memory: {
					availableGiB: 19.8,
					compressorGiB: 0.8,
				},
				processes: {
					totals: {
						rssMiB: 1642,
						opencodeProcesses: 6,
						opencodeRunProcesses: 3,
						opencodeTuiProcesses: 2,
					},
					topProcesses: [
						{ pid: 2411, cpuPct: 28.4, rssMiB: 812, category: "opencode", command: "opencode --session CH5PM" },
						{ pid: 882, cpuPct: 11.2, rssMiB: 255, category: "python", command: "python scripts/ch5pm-daemon" },
					],
					categories: {
						opencode: { processes: 6, cpuPct: 41.2, rssMiB: 1210 },
						python: { processes: 3, cpuPct: 14.7, rssMiB: 301 },
					},
				},
				opencode: {
					activeSessions: 7,
					rootSessions: 4,
					childSessions: 3,
					repoCounts: {
						"ch5-company": 3,
						fitbot: 2,
						"firefly-cloud": 2,
					},
				},
			},
			boxes: [
				{
					boxId: "dell",
					nodeType: "hub",
					hub: true,
					reachable: true,
					healthy: true,
					dispatchEligible: true,
					resourcePressure: {
						pressure: { level: "green", score: 22, dispatchBudget: 3 },
						system: { loadAvg: [2.1, 2.4, 2.6], cpu: { busyPct: 38 } },
						memory: { availableGiB: 19.8, compressorGiB: 0.8 },
						processes: { totals: { rssMiB: 1642 }, topProcesses: [] },
						opencode: { activeSessions: 7 },
					},
				},
				{
					boxId: "macmini",
					nodeType: "worker",
					reachable: true,
					healthy: true,
					dispatchEligible: true,
					workers: [
						{ ticketId: "CH5COMPAC4C-108", repo: "fitbot", slotId: "slot-1", state: "running", workerLive: true },
					],
				},
			],
		},
		jobs: {
			counts: {
				running: 1,
				queued: 2,
				held: 0,
			},
			backlog: 2,
		},
		attentionMetrics: {
			openRequestCount: 1,
			totalOpenDeadTimeSeconds: 95,
			maxDeadTimeSeconds: 95,
			resolvedTodayCount: 4,
			blockedWithoutAttentionCount: 0,
			openRequests: [
				{
					id: "attn-1",
					ticketSeq: 111,
					project: "CH5COMPAC4C",
					deadTimeSeconds: 95,
					status: "awaiting Chris",
				},
			],
		},
		plane: {
			workspace: "ch5",
			projectIdentifier: "CH5COMPAC4C",
			webBaseUrl: "https://plane.ch5.me",
		},
		idleNudges: [
			{
				ticketId: "CH5COMPAC4C-109",
				status: "sent",
				idleMinutes: 22,
				reason: "No output after last worker send",
			},
		],
		activeTickets: [
			{
				ticketId: "CH5COMPAC4C-108",
				repo: "fitbot",
				name: "Port CH5PM queue board",
				boxId: "macmini",
				slotId: "slot-1",
				sessionId: "ses_fitbot_108",
				classification: "worker",
				planeUrl: "https://plane.ch5.me/CH5COMPAC4C-108",
			},
			{
				ticketId: "CH5COMPAC4C-110",
				repo: "firefly-cloud",
				name: "Fix approval snapshot gap",
				boxId: "dell",
				slotId: "slot-2",
				sessionId: "ses_cloud_110",
				classification: "worker",
				planeUrl: "https://plane.ch5.me/CH5COMPAC4C-110",
			},
		],
		queueTickets: [
			{
				ticketId: "CH5COMPAC4C-112",
				repo: "palot",
				name: "Scaffold CH5PM dashboard surface",
				priority: "high",
				planeUrl: "https://plane.ch5.me/CH5COMPAC4C-112",
			},
		],
		blockedTickets: [
			{
				ticketId: "CH5COMPAC4C-111",
				repo: "ch5-company",
				name: "Choose daemon proxy auth path",
				classification: "needs_human",
				planeUrl: "https://plane.ch5.me/CH5COMPAC4C-111",
			},
		],
		manualSessions: [
			{
				sessionId: "ses_manual_pm",
				title: "CH5PM planning lane",
				repo: "ch5-company",
				role: "pm-intake",
				messageCount: 18,
			},
		],
		sessionSignals: [
			{
				sessionId: "ses_fitbot_108",
				title: "Port CH5PM queue board",
				repo: "fitbot",
				state: "running",
				signal: "healthy",
				classification: "worker",
			},
		],
		closedSessionSignals: [
			{
				ticketId: "CH5COMPAC4C-102",
				sessionId: "ses_done_102",
				title: "Daemon telemetry cleanup",
				repo: "ch5-company",
				statusLine: "Merged to main",
				closedByPlane: true,
				reopenable: true,
				planeUrl: "https://plane.ch5.me/CH5COMPAC4C-102",
			},
		],
		claudeCodeSessions: [
			{
				sessionId: "claude_pm",
				title: "CH5PM Intake 1",
				sourceBoxId: "laptop",
				role: "pm-intake",
				directory: "/Users/hassoncs/src/ch5/ch5-company",
			},
		],
	},
	pressure: {
		generatedAt: iso(1),
		pressure: {
			level: "green",
			score: 22,
			dispatchBudget: 3,
			reasons: ["memory healthy", "OpenCode session count below threshold"],
		},
		system: {
			loadAvg: [2.1, 2.4, 2.6],
			cpu: { busyPct: 38 },
		},
		memory: {
			availableGiB: 19.8,
			compressorGiB: 0.8,
		},
		processes: {
			totals: {
				rssMiB: 1642,
				opencodeProcesses: 6,
				opencodeRunProcesses: 3,
				opencodeTuiProcesses: 2,
			},
			topProcesses: [
				{ pid: 2411, cpuPct: 28.4, rssMiB: 812, category: "opencode", command: "opencode --session CH5PM" },
			],
			categories: {
				opencode: { processes: 6, cpuPct: 41.2, rssMiB: 1210 },
			},
		},
		opencode: {
			activeSessions: 7,
			rootSessions: 4,
			childSessions: 3,
			repoCounts: {
				"ch5-company": 3,
				fitbot: 2,
			},
		},
	},
	system: {
		generatedAt: iso(1),
		system: {
			loadAvg: [2.1, 2.4, 2.6],
			cpu: { busyPct: 38 },
		},
		memory: {
			availableGiB: 19.8,
			compressorGiB: 0.8,
		},
	},
	streamConnected: true,
	streamError: null,
	lastEventAt: iso(0),
}
