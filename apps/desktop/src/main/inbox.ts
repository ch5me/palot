import type { Customer, InboxChannel, InboxMessage } from "../preload/api"
import { createLogger } from "./logger"
import {
	appendInboxMessage,
	contactHandle,
	loadCrmStore,
	readInboxThread,
	type CrmContact,
	type InboxThread,
	type InboxThreadMessage,
} from "./crm"

const log = createLogger("inbox")

const VALID_INBOX_CHANNELS = new Set<InboxChannel>([
	"whatsapp",
	"whatsapp-personal",
	"instagram",
	"telegram",
	"email",
	"phone",
	"other",
])

function formatLocal(date: Date): string {
	const year = date.getFullYear()
	const month = `${date.getMonth() + 1}`.padStart(2, "0")
	const day = `${date.getDate()}`.padStart(2, "0")
	const hours = `${date.getHours()}`.padStart(2, "0")
	const minutes = `${date.getMinutes()}`.padStart(2, "0")
	return `${year}-${month}-${day} ${hours}:${minutes}`
}

function humanizeAgo(date: Date): string | null {
	const delta = Date.now() - date.getTime()
	if (delta < 0) return null
	const seconds = Math.floor(delta / 1000)
	if (seconds < 60) return "<1m"
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
	if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`
	return `${Math.floor(seconds / 86_400)}d`
}

function toInboxMessage(message: InboxThreadMessage): InboxMessage {
	const date = new Date(message.ts)
	return {
		ts: formatLocal(date),
		tsAgo: humanizeAgo(date),
		direction: message.direction,
		text: message.text,
	}
}

async function buildThreadSnapshot(contact: CrmContact): Promise<InboxThread> {
	return readInboxThread(contactHandle(contact))
}

export async function listCustomers(): Promise<Customer[]> {
	const store = await loadCrmStore()
	const customers: Customer[] = []
	for (const contact of store.contacts) {
		const thread = await buildThreadSnapshot(contact)
		const last = thread.messages.at(-1) ?? null
		const lastDate = last ? new Date(last.ts) : null
		customers.push({
			id: contact.id,
			name: contact.name,
			channel: mapToInboxChannel(contact.channel),
			handle: contactHandle(contact),
			lastAt: lastDate ? formatLocal(lastDate) : null,
			lastAgo: lastDate ? humanizeAgo(lastDate) : null,
			lastText: last?.text ?? "",
			msgCount: thread.messages.length,
		})
	}
	customers.sort((a, b) => {
		const aTime = a.lastAt ? Date.parse(a.lastAt.replace(" ", "T")) : 0
		const bTime = b.lastAt ? Date.parse(b.lastAt.replace(" ", "T")) : 0
		return bTime - aTime
	})
	return customers
}

function mapToInboxChannel(contactChannel: CrmContact["channel"]): InboxChannel {
	if (contactChannel === "referral") return "other"
	if (VALID_INBOX_CHANNELS.has(contactChannel as InboxChannel)) {
		return contactChannel as InboxChannel
	}
	return "other"
}

export async function customerThread(handle: string, limit = 50): Promise<InboxMessage[]> {
	if (!handle?.trim()) {
		throw new Error("Customer handle is required")
	}
	const thread = await readInboxThread(handle.trim())
	const recent = thread.messages.slice(-Math.max(1, limit))
	return recent.map(toInboxMessage)
}

export interface InboxSendResult {
	delivered: false
	ts: number
	reason: string
}

export async function sendMessage(
	channel: InboxChannel,
	to: string,
	text: string,
): Promise<InboxSendResult> {
	if (!VALID_INBOX_CHANNELS.has(channel)) {
		throw new Error(`Unknown channel: ${channel}`)
	}
	if (!to.trim()) {
		throw new Error("Recipient handle is required")
	}
	const trimmedText = text.trim()
	if (!trimmedText) {
		throw new Error("Message text is required")
	}
	const message = await appendInboxMessage(to.trim(), "out", trimmedText, "draft")
	log.debug("sendMessage stored draft", { channel, to, messageId: message.id })
	return {
		delivered: false,
		ts: message.ts,
		reason: `no live connector for ${channel}; message saved as draft only`,
	}
}
