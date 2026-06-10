export interface McpVerificationRecord {
	name: string
	authState?: string
	testState?: string
	status?: string
	runtimeState?: string
	lastHealthyAt?: string | null
	canonicalStore?: string
	ownershipMode?: string
}

export interface McpVerificationSnapshot {
	serverNames: string[]
	activeCount: number
	gatewayCount: number
	ownershipModes: string[]
	hydrationStates: string[]
	statuses: string[]
}

export function summarizeMcpVerification(records: McpVerificationRecord[]): McpVerificationSnapshot {
	const activeCount = records.filter((record) => record.runtimeState === "active" || Boolean(record.lastHealthyAt)).length
	const gatewayCount = records.filter((record) => record.canonicalStore === "gateway").length
	return {
		serverNames: records.map((record) => record.name),
		activeCount,
		gatewayCount,
		ownershipModes: records.map((record) => record.ownershipMode ?? "local-only"),
		hydrationStates: records.map((record) =>
			record.runtimeState === "active" || record.lastHealthyAt
				? "active"
				: record.runtimeState === "projected"
					? "projected"
					: "inactive",
		),
		statuses: records.map((record) =>
			record.status ??
			(record.testState === "failing" ? "degraded" : record.authState === "failed" ? "needs_auth" : "ready"),
		),
	}
}
