import { pathToFileURL } from "node:url"
import { createLogger } from "./logger"

const log = createLogger("palot-opencode-plugin-shim")

export interface PalotPluginModule {
	id: string
	server: unknown
}

export async function loadPalotPluginModule(filePath: string): Promise<PalotPluginModule> {
	const moduleUrl = pathToFileURL(filePath).href
	const imported = (await import(moduleUrl)) as {
		default?: PalotPluginModule
		id?: string
		server?: unknown
	}
	const candidate = imported.default ??
		(imported.id && imported.server ? { id: imported.id, server: imported.server } : null)
	if (!candidate || typeof candidate.id !== "string" || !("server" in candidate)) {
		throw new Error(`Invalid Palot plugin module at ${filePath}`)
	}
	log.info("Loaded Palot plugin module", { filePath, id: candidate.id })
	return candidate
}
