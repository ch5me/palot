import {
	quarantineRecordSchema,
	type QuarantineRecord,
} from "../../shared/firefly-plugin/runtime-supervision"

import { createLogger } from "../logger"
import { getSettings, updateSettings } from "../settings-store"
import {
	createPluginWorkerSupervisor,
	type PluginWorkerRegistration,
	type PluginWorkerSupervisor,
	type PluginWorkerSupervisorOptions,
} from "./worker-supervisor"
import { createWorkerThreadSpawner } from "./worker-thread-spawner"

const log = createLogger("firefly-plugin/utility-process-host")

const QUARANTINE_SETTINGS_KEY = "fireflyPluginQuarantines"

export interface PluginRuntimeQuarantineSnapshot {
	readonly version: 1
	readonly records: Record<string, QuarantineRecord>
}

export interface UtilityProcessPluginHostOptions {
	readonly supervisor?: PluginWorkerSupervisor
	readonly supervisorOptions?: Omit<PluginWorkerSupervisorOptions, "spawnWorker" | "quarantineStore">
	readonly spawnWorker?: PluginWorkerSupervisorOptions["spawnWorker"]
}

export interface UtilityProcessPluginHost {
	register(registration: PluginWorkerRegistration): ReturnType<PluginWorkerSupervisor["register"]>
	activate(pluginId: string): ReturnType<PluginWorkerSupervisor["activate"]>
	disable(pluginId: string): ReturnType<PluginWorkerSupervisor["disable"]>
	enable(pluginId: string): ReturnType<PluginWorkerSupervisor["enable"]>
	releaseQuarantine(pluginId: string, note: string): ReturnType<PluginWorkerSupervisor["releaseQuarantine"]>
	getSummary(pluginId: string): ReturnType<PluginWorkerSupervisor["getSummary"]>
	listSummaries(): ReturnType<PluginWorkerSupervisor["listSummaries"]>
	scanForHangs(): void
	dispose(): Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readPersistedQuarantines(): Record<string, QuarantineRecord> {
	const value = getSettings()[QUARANTINE_SETTINGS_KEY]
	if (!isRecord(value)) return {}
	const records: Record<string, QuarantineRecord> = {}
	for (const [pluginId, record] of Object.entries(value)) {
		const parsed = quarantineRecordSchema.safeParse(record)
		if (parsed.success) {
			records[pluginId] = parsed.data
		} else {
			log.warn("Dropping invalid persisted quarantine record", { pluginId })
		}
	}
	return records
}

function persistQuarantines(records: Record<string, QuarantineRecord>): void {
	updateSettings({
		[QUARANTINE_SETTINGS_KEY]: {
			...records,
		},
	})
}

export function getPersistedPluginQuarantines(): PluginRuntimeQuarantineSnapshot {
	return {
		version: 1,
		records: readPersistedQuarantines(),
	}
}

function createSettingsQuarantineStore() {
	return {
		write(record: QuarantineRecord) {
			const next = readPersistedQuarantines()
			next[record.pluginId] = record
			persistQuarantines(next)
		},
		clear(pluginId: string) {
			const next = readPersistedQuarantines()
			if (!(pluginId in next)) return
			delete next[pluginId]
			persistQuarantines(next)
		},
	}
}

export function createUtilityProcessPluginHost(
	options: UtilityProcessPluginHostOptions = {},
): UtilityProcessPluginHost {
	const supervisor =
		options.supervisor ??
		createPluginWorkerSupervisor({
			spawnWorker: options.spawnWorker ?? createWorkerThreadSpawner(),
			quarantineStore: createSettingsQuarantineStore(),
			...options.supervisorOptions,
			onTransition: (summary, decision) => {
				options.supervisorOptions?.onTransition?.(summary, decision)
				if (decision.action === "none") return
				log.info("Utility-process plugin host transition", {
					pluginId: summary.pluginId,
					state: summary.state,
					action: decision.action,
				})
			},
		})

	return {
		register: (registration) => supervisor.register(registration),
		activate: (pluginId) => supervisor.activate(pluginId),
		disable: (pluginId) => supervisor.disable(pluginId),
		enable: (pluginId) => supervisor.enable(pluginId),
		releaseQuarantine: (pluginId, note) => supervisor.releaseQuarantine(pluginId, note),
		getSummary: (pluginId) => supervisor.getSummary(pluginId),
		listSummaries: () => supervisor.listSummaries(),
		scanForHangs: () => supervisor.scanForHangs(),
		dispose: () => supervisor.dispose(),
	}
}
