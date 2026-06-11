const ULID_TIME_LEN = 10
const ULID_RANDOM_LEN = 16
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const ARTIFACT_ID_PREFIX = "art_"

let lastTime = -1
let lastRandom = Array.from({ length: ULID_RANDOM_LEN }, () => 0)

function nextRandomValues(): number[] {
	const values = new Uint8Array(ULID_RANDOM_LEN)
	crypto.getRandomValues(values)
	return Array.from(values, (value) => value % CROCKFORD.length)
}

function incrementRandom(values: number[]): number[] {
	const next = [...values]
	for (let index = next.length - 1; index >= 0; index -= 1) {
		if (next[index] < CROCKFORD.length - 1) {
			next[index] += 1
			return next
		}
		next[index] = 0
	}
	return next
}

function encodeTime(timestamp: number): string {
	let value = Math.floor(timestamp)
	let encoded = ""
	for (let index = 0; index < ULID_TIME_LEN; index += 1) {
		encoded = CROCKFORD[value % CROCKFORD.length] + encoded
		value = Math.floor(value / CROCKFORD.length)
	}
	return encoded
}

function encodeRandom(values: number[]): string {
	return values.map((value) => CROCKFORD[value]).join("")
}

export function mintArtifactUlid(timestamp = Date.now()): string {
	if (timestamp > lastTime) {
		lastTime = timestamp
		lastRandom = nextRandomValues()
	} else {
		lastRandom = incrementRandom(lastRandom)
	}
	return `${encodeTime(lastTime)}${encodeRandom(lastRandom)}`
}

export function mintArtifactId(timestamp = Date.now()): string {
	return `${ARTIFACT_ID_PREFIX}${mintArtifactUlid(timestamp)}`
}

export function isArtifactUlid(value: string): boolean {
	return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value)
}

export function isArtifactId(value: string): boolean {
	if (!value.startsWith(ARTIFACT_ID_PREFIX)) return false
	return isArtifactUlid(value.slice(ARTIFACT_ID_PREFIX.length))
}
