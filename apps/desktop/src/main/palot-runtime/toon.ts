const SAFE_SCALAR_RE = /^[A-Za-z_][A-Za-z0-9_.\/-]*$/

function encodeScalar(value: unknown): string {
	if (typeof value === "string") {
		return SAFE_SCALAR_RE.test(value) ? value : JSON.stringify(value)
	}
	if (typeof value === "number" || typeof value === "boolean") return String(value)
	if (value === null) return "null"
	throw new Error("Unsupported TOON scalar")
}

function decodeScalar(token: string): unknown {
	if (token === "null") return null
	if (token === "true") return true
	if (token === "false") return false
	if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(token)) return Number(token)
	if (token.startsWith("\"") && token.endsWith("\"")) return JSON.parse(token)
	return token
}

function splitCsv(line: string): string[] {
	const values: string[] = []
	let current = ""
	let inString = false
	let escaped = false
	for (const char of line) {
		if (escaped) {
			current += char
			escaped = false
			continue
		}
		if (char === "\\") {
			current += char
			escaped = true
			continue
		}
		if (char === '\"') {
			current += char
			inString = !inString
			continue
		}
		if (char === "," && !inString) {
			values.push(current)
			current = ""
			continue
		}
		current += char
	}
	if (inString || escaped) throw new Error("Malformed TOON CSV row")
	values.push(current)
	return values
}

function isScalar(value: unknown): boolean {
	return value === null || ["string", "number", "boolean"].includes(typeof value)
}

function isTabularArray(value: unknown[]): value is Array<Record<string, unknown>> {
	if (value.length === 0) return false
	return value.every((row) => {
		if (!row || typeof row !== "object" || Array.isArray(row)) return false
		return Object.values(row).every((cell) => isScalar(cell))
	})
}

function encodeArray(value: unknown[], key?: string): string[] {
	if (isTabularArray(value)) {
		const headers = Object.keys(value[0])
		const head = key
			? `${key}[${value.length}]{${headers.join(",")}}:`
			: `[${value.length}]{${headers.join(",")}}:`
		return [
			head,
			...value.map((row) => `  ${headers.map((header) => encodeScalar(row[header])).join(",")}`),
		]
	}
	if (!value.every((entry) => isScalar(entry))) throw new Error("Unsupported TOON array")
	const head = key ? `${key}[${value.length}]:` : `[${value.length}]:`
	return [head, ...value.map((entry) => `  ${encodeScalar(entry)}`)]
}

function decodeArrayBlock(header: string, rows: string[]): unknown {
	const tableMatch = header.match(/^(?:([^\[{:]+))?\[(\d+)\]\{([^}]*)\}:$/)
	if (tableMatch) {
		const [, key, countRaw, headerRaw] = tableMatch
		const headers = headerRaw.split(",").map((part) => part.trim()).filter(Boolean)
		if (rows.length !== Number(countRaw)) throw new Error("TOON table count mismatch")
		const values = rows.map((row) => {
			const cells = splitCsv(row)
			if (cells.length !== headers.length) throw new Error("Malformed TOON table row")
			return Object.fromEntries(headers.map((name, index) => [name, decodeScalar(cells[index])]))
		})
		return key ? { key, value: values } : values
	}
	const arrayMatch = header.match(/^(?:([^\[{:]+))?\[(\d+)\]:$/)
	if (!arrayMatch) throw new Error(`Malformed TOON line: ${header}`)
	const [, key, countRaw] = arrayMatch
	if (rows.length !== Number(countRaw)) throw new Error("TOON array count mismatch")
	const values = rows.map((row) => decodeScalar(row))
	return key ? { key, value: values } : values
}

export function encode(value: unknown): string {
	if (isScalar(value)) return encodeScalar(value)
	if (Array.isArray(value)) return encodeArray(value).join("\n")
	if (!value || typeof value !== "object") throw new Error("Unsupported TOON value")
	const lines: string[] = []
	for (const [key, entry] of Object.entries(value)) {
		if (isScalar(entry)) lines.push(`${key}: ${encodeScalar(entry)}`)
		else if (Array.isArray(entry)) lines.push(...encodeArray(entry, key))
		else lines.push(`${key}: ${JSON.stringify(entry)}`)
	}
	return lines.join("\n")
}

export function decode(toon: string): unknown {
	const trimmed = toon.trim()
	if (!trimmed) throw new Error("TOON input is empty")
	const lines = trimmed.split(/\r?\n/)
	if (lines.length === 1 && !lines[0].includes(":")) return decodeScalar(lines[0])
	if (lines[0].startsWith("[")) {
		const rows = lines.slice(1).map((line) => {
			if (!line.startsWith("  ")) throw new Error("Malformed TOON array row")
			return line.slice(2)
		})
		return decodeArrayBlock(lines[0], rows)
	}
	const result: Record<string, unknown> = {}
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index]
		if (line.startsWith("  ")) throw new Error("Unexpected TOON indentation")
		const scalarMatch = line.match(/^([^\[{:]+):\s*(.+)$/)
		if (scalarMatch) {
			const valueToken = scalarMatch[2]
			result[scalarMatch[1]] = valueToken.startsWith("{") || valueToken.startsWith("[")
				? JSON.parse(valueToken)
				: decodeScalar(valueToken)
			continue
		}
		if (!line.endsWith(":")) throw new Error(`Malformed TOON line: ${line}`)
		const rows: string[] = []
		while (index + 1 < lines.length && lines[index + 1].startsWith("  ")) {
			rows.push(lines[index + 1].slice(2))
			index += 1
		}
		const decoded = decodeArrayBlock(line, rows)
		if (!decoded || typeof decoded !== "object" || Array.isArray(decoded) || !("key" in decoded)) {
			throw new Error(`Malformed TOON line: ${line}`)
		}
		result[decoded.key] = decoded.value
	}
	return result
}
