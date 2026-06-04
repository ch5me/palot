const FILE_SCHEME = /^file:\/\//i
const HTTP_SCHEME = /^https?:\/\//i
const LINE_SUFFIX = /:\d+(?::\d+)?$/
const HASH_SUFFIX = /#[^/]*$/

const RELATIVE_ROOTS = /^(docs|src|scripts|tests?|lib|app|public|assets|config|\.agents|\.codex)\//
const FILEISH_SEGMENT = /(^|\/)[^/\s]+\.[a-z0-9]{1,12}$/i

export function isHttpPaneTarget(target: string): boolean {
	return HTTP_SCHEME.test(target.trim())
}

export function normalizePaneFileTarget(target: string): string {
	let normalized = target.trim()
	if (
		(normalized.startsWith("<") && normalized.endsWith(">")) ||
		(normalized.startsWith('"') && normalized.endsWith('"'))
	) {
		normalized = normalized.slice(1, -1).trim()
	}
	if (
		(normalized.startsWith("'") && normalized.endsWith("'")) ||
		(normalized.startsWith("`") && normalized.endsWith("`"))
	) {
		normalized = normalized.slice(1, -1).trim()
	}
	normalized = normalized.replace(HASH_SUFFIX, "")
	if (FILE_SCHEME.test(normalized)) {
		try {
			normalized = decodeURIComponent(new URL(normalized).pathname)
		} catch {
			normalized = normalized.replace(FILE_SCHEME, "")
		}
	}
	return normalized.replace(LINE_SUFFIX, "")
}

export function isPaneFileTarget(target: string): boolean {
	const normalized = normalizePaneFileTarget(target)
	if (!normalized || /\s/.test(normalized)) {
		return false
	}
	return (
		normalized.startsWith("/") ||
		normalized.startsWith("~/") ||
		normalized.startsWith("./") ||
		normalized.startsWith("../") ||
		RELATIVE_ROOTS.test(normalized) ||
		FILEISH_SEGMENT.test(normalized)
	)
}

function dirname(path: string): string {
	const index = path.lastIndexOf("/")
	return index > 0 ? path.slice(0, index) : "/"
}

function normalizePosix(path: string): string {
	const absolute = path.startsWith("/")
	const parts: string[] = []
	for (const part of path.split("/")) {
		if (!part || part === ".") {
			continue
		}
		if (part === "..") {
			parts.pop()
		} else {
			parts.push(part)
		}
	}
	return `${absolute ? "/" : ""}${parts.join("/")}`
}

export function resolvePaneFileTarget(target: string, baseFilePath?: string): string {
	const normalized = normalizePaneFileTarget(target)
	if (!baseFilePath || normalized.startsWith("/") || normalized.startsWith("~/")) {
		return normalized
	}
	if (!normalized.startsWith("./") && !normalized.startsWith("../")) {
		return normalized
	}
	return normalizePosix(`${dirname(baseFilePath)}/${normalized}`)
}

export function targetLabel(target: string): string {
	const normalized = normalizePaneFileTarget(target)
	return normalized.split("/").filter(Boolean).pop() || normalized || "file"
}
