const WHISPER_URL = "http://localhost:9000/inference"
const TARGET_SAMPLE_RATE = 16000
const TRANSCRIBE_TIMEOUT_MS = 60_000
const MIN_WAV_BYTES = 1024

interface DictationSession {
	stream: MediaStream
	recorder: MediaRecorder
	chunks: Blob[]
	stopped: Promise<void>
}

let session: DictationSession | null = null

export function isVoiceSupported(): { available: boolean; reason: string | null } {
	if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
		return { available: false, reason: "microphone capture unavailable in this environment" }
	}
	if (typeof MediaRecorder === "undefined") {
		return { available: false, reason: "audio recording (MediaRecorder) unavailable" }
	}
	return { available: true, reason: null }
}

function pickMimeType(): string {
	const candidates = [
		"audio/webm;codecs=opus",
		"audio/webm",
		"audio/ogg;codecs=opus",
		"audio/ogg",
		"audio/mp4",
		"audio/mpeg",
	]
	if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
		for (const candidate of candidates) {
			if (MediaRecorder.isTypeSupported(candidate)) {
				return candidate
			}
		}
	}
	return ""
}

function releaseStream(stream: MediaStream) {
	for (const track of stream.getTracks()) {
		try {
			track.stop()
		} catch {
			// best effort
		}
	}
}

export async function dictateStart(): Promise<void> {
	if (session) {
		throw new Error("already recording")
	}
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new Error("microphone capture unavailable in this environment")
	}
	if (typeof MediaRecorder === "undefined") {
		throw new Error("audio recording (MediaRecorder) unavailable")
	}

	let stream: MediaStream
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true })
	} catch (error) {
		const name = (error as DOMException)?.name
		if (name === "NotAllowedError" || name === "SecurityError") {
			throw new Error("microphone permission denied — allow mic access for Elf")
		}
		if (name === "NotFoundError" || name === "OverconstrainedError") {
			throw new Error("no microphone found")
		}
		throw new Error(`could not access microphone: ${String((error as Error)?.message ?? error)}`)
	}

	let recorder: MediaRecorder
	try {
		const mimeType = pickMimeType()
		recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
	} catch (error) {
		releaseStream(stream)
		throw new Error(`could not start recorder: ${String((error as Error)?.message ?? error)}`)
	}

	const chunks: Blob[] = []
	recorder.ondataavailable = (event) => {
		if (event.data.size > 0) {
			chunks.push(event.data)
		}
	}
	const stopped = new Promise<void>((resolve) => {
		recorder.onstop = () => resolve()
		recorder.onerror = () => resolve()
	})
	session = { stream, recorder, chunks, stopped }
	try {
		recorder.start()
	} catch (error) {
		const active = session
		session = null
		if (active) {
			releaseStream(active.stream)
		}
		throw new Error(`could not start recording: ${String((error as Error)?.message ?? error)}`)
	}
}

export async function dictateStop(): Promise<string> {
	const active = session
	if (!active) {
		throw new Error("not recording")
	}
	session = null
	try {
		if (active.recorder.state !== "inactive") {
			active.recorder.stop()
		}
		await active.stopped
		const type = active.recorder.mimeType || active.chunks[0]?.type || "audio/webm"
		const recordedBlob = new Blob(active.chunks, { type })
		if (recordedBlob.size === 0) {
			throw new Error("no audio captured — check microphone permission")
		}
		const wavBlob = await encodeBlobToWav(recordedBlob)
		if (wavBlob.size <= MIN_WAV_BYTES) {
			throw new Error("no audio captured — check microphone permission")
		}
		return await postToWhisper(wavBlob)
	} finally {
		releaseStream(active.stream)
	}
}

export async function dictateCancel(): Promise<void> {
	const active = session
	if (!active) {
		return
	}
	session = null
	try {
		if (active.recorder.state !== "inactive") {
			active.recorder.stop()
		}
	} catch {
		// best effort
	}
	releaseStream(active.stream)
}

function getAudioContextCtor(): typeof AudioContext {
	const ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
	if (!ctor) {
		throw new Error("Web Audio (AudioContext) unavailable")
	}
	return ctor
}

async function encodeBlobToWav(blob: Blob): Promise<Blob> {
	const arrayBuffer = await blob.arrayBuffer()
	const AudioCtor = getAudioContextCtor()
	const decodeContext = new AudioCtor()
	let decoded: AudioBuffer
	try {
		decoded = await decodeContext.decodeAudioData(arrayBuffer.slice(0))
	} catch (error) {
		void decodeContext.close?.()
		throw new Error(`could not decode recorded audio: ${String((error as Error)?.message ?? error)}`)
	}
	try {
		await decodeContext.close?.()
	} catch {
		// best effort
	}
	const mono = downmixToMono(decoded)
	const resampled = decoded.sampleRate === TARGET_SAMPLE_RATE ? mono : resampleLinear(mono, decoded.sampleRate, TARGET_SAMPLE_RATE)
	return encodeWav(resampled, TARGET_SAMPLE_RATE)
}

function downmixToMono(buffer: AudioBuffer): Float32Array {
	if (buffer.numberOfChannels === 1) {
		return Float32Array.from(buffer.getChannelData(0))
	}
	const output = new Float32Array(buffer.length)
	for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
		const channel = buffer.getChannelData(channelIndex)
		for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
			output[sampleIndex] += channel[sampleIndex]
		}
	}
	for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
		output[sampleIndex] /= buffer.numberOfChannels
	}
	return output
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
	if (fromRate === toRate) {
		return input
	}
	const ratio = fromRate / toRate
	const output = new Float32Array(Math.max(1, Math.round(input.length / ratio)))
	for (let index = 0; index < output.length; index += 1) {
		const sourcePosition = index * ratio
		const lower = Math.floor(sourcePosition)
		const upper = Math.min(lower + 1, input.length - 1)
		const fraction = sourcePosition - lower
		output[index] = input[lower] * (1 - fraction) + input[upper] * fraction
	}
	return output
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
	const bytesPerSample = 2
	const blockAlign = bytesPerSample
	const byteRate = sampleRate * blockAlign
	const dataSize = samples.length * bytesPerSample
	const buffer = new ArrayBuffer(44 + dataSize)
	const view = new DataView(buffer)
	const writeString = (offset: number, text: string) => {
		for (let index = 0; index < text.length; index += 1) {
			view.setUint8(offset + index, text.charCodeAt(index))
		}
	}
	writeString(0, "RIFF")
	view.setUint32(4, 36 + dataSize, true)
	writeString(8, "WAVE")
	writeString(12, "fmt ")
	view.setUint32(16, 16, true)
	view.setUint16(20, 1, true)
	view.setUint16(22, 1, true)
	view.setUint32(24, sampleRate, true)
	view.setUint32(28, byteRate, true)
	view.setUint16(32, blockAlign, true)
	view.setUint16(34, bytesPerSample * 8, true)
	writeString(36, "data")
	view.setUint32(40, dataSize, true)
	let offset = 44
	for (let index = 0; index < samples.length; index += 1) {
		const sample = Math.max(-1, Math.min(1, samples[index]))
		view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
		offset += 2
	}
	return new Blob([buffer], { type: "audio/wav" })
}

async function postToWhisper(wav: Blob): Promise<string> {
	const form = new FormData()
	form.append("file", wav, "audio.wav")
	form.append("temperature", "0")
	form.append("response_format", "json")
	const controller = new AbortController()
	const timer = window.setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS)
	let response: Response
	try {
		response = await window.fetch(WHISPER_URL, { method: "POST", body: form, signal: controller.signal })
	} catch (error) {
		if ((error as DOMException)?.name === "AbortError") {
			throw new Error("transcription timed out")
		}
		throw new Error(`transcription request failed — is the whisper server running on :9000? (${String((error as Error)?.message ?? error)})`)
	} finally {
		window.clearTimeout(timer)
	}
	if (!response.ok) {
		throw new Error(`transcription request failed: HTTP ${response.status}`)
	}
	const body = await response.text()
	return parseTranscript(body)
}

export function parseTranscript(body: string): string {
	let parsed: unknown
	try {
		parsed = JSON.parse(body.trim())
	} catch {
		throw new Error(`could not parse transcription response: ${body.trim()}`)
	}
	const text = (parsed as { text?: unknown }).text
	if (typeof text !== "string") {
		throw new Error("transcription response had no text")
	}
	return text.trim()
}
