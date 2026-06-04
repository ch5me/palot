import { randomUUID } from "node:crypto"
import fs from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { CrmContact, CrmStore, Customer, InboxChannel, InboxMessage } from "../preload/api"
import { createLogger } from "./logger"

const log = createLogger("crm")

export type { CrmContact, CrmStore }

export interface InboxThread {
	handle: string
	messages: InboxThreadMessage[]
}

export interface InboxThreadMessage {
	id: string
	ts: number
	direction: "in" | "out"
	text: string
	via: "draft" | "synthesized"
}

export interface SendResult {
	delivered: false
	stored: InboxThreadMessage
	reason: string
}

interface CustomerDraftState {
	contact: CrmContact
	handle: string
	lastMessage: InboxThreadMessage | null
	messageCount: number
}

function resolveUserDataDir(): string {
	const override = process.env.PALOT_DATA_DIR?.trim()
	if (override) return override
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const electron = require("electron") as { app?: { getPath: (key: string) => string } }
		if (electron.app?.getPath) {
			return electron.app.getPath("userData")
		}
	} catch {
		return process.cwd()
	}
	return process.cwd()
}

function dataDir(): string {
	return path.join(resolveUserDataDir(), "crm")
}

function contactsFile(): string {
	return path.join(dataDir(), "contacts.json")
}

function inboxDir(): string {
	return path.join(dataDir(), "inbox")
}

function inboxFile(handle: string): string {
	return path.join(inboxDir(), `${sanitizeHandle(handle)}.json`)
}

function sanitizeHandle(handle: string): string {
	return handle
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "_")
		.slice(0, 64)
}

async function ensureDataDir(): Promise<void> {
	await mkdir(dataDir(), { recursive: true })
	await mkdir(inboxDir(), { recursive: true })
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
	try {
		const text = await readFile(filePath, "utf-8")
		return JSON.parse(text) as T
	} catch (err) {
		const error = err as NodeJS.ErrnoException
		if (error.code === "ENOENT") return fallback
		log.warn("readJson failed", { filePath, error: error.message })
		return fallback
	}
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
	await ensureDataDir()
	const tmp = `${filePath}.tmp`
	await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8")
	await fs.promises.rename(tmp, filePath)
}

const VALID_CHANNELS = new Set([
	"whatsapp",
	"instagram",
	"telegram",
	"email",
	"phone",
	"referral",
	"other",
])

function validateContactInput(input: Partial<CrmContact>): CrmContact {
	const name = (input.name ?? "").trim()
	if (!name) {
		throw new Error("Contact name is required")
	}
	const channel = input.channel ?? "other"
	if (!VALID_CHANNELS.has(channel)) {
		throw new Error(`Unknown contact channel: ${channel}`)
	}
	const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)
	const notes = (input.notes ?? "").trim()
	const id = input.id?.trim() || randomUUID()
	const createdAt = typeof input.createdAt === "number" ? input.createdAt : Date.now()
	return {
		id,
		name,
		company: input.company?.trim() || undefined,
		email: input.email?.trim() || undefined,
		phone: input.phone?.trim() || undefined,
		channel,
		tags: tags.length > 0 ? tags : undefined,
		notes: notes.length > 0 ? notes : undefined,
		createdAt,
	}
}

export async function loadCrmStore(): Promise<CrmStore> {
	const contacts = await readJson<CrmContact[]>(contactsFile(), [])
	return { contacts, deals: [] }
}

export async function saveContact(input: Partial<CrmContact>): Promise<string> {
	const store = await loadCrmStore()
	const contact = validateContactInput(input)
	const existingIndex = store.contacts.findIndex((c) => c.id === contact.id)
	if (existingIndex >= 0) {
		const previous = store.contacts[existingIndex]
		store.contacts[existingIndex] = {
			...previous,
			...contact,
			createdAt: previous.createdAt,
		}
	} else {
		store.contacts.push(contact)
	}
	await writeJson(contactsFile(), store.contacts)
	return contact.id
}

export async function deleteContact(id: string): Promise<void> {
	if (!id?.trim()) {
		throw new Error("Contact id is required")
	}
	const store = await loadCrmStore()
	const next = store.contacts.filter((contact) => contact.id !== id)
	if (next.length !== store.contacts.length) {
		await writeJson(contactsFile(), next)
	}
	const matching = store.contacts.find((contact) => contact.id === id)
	if (matching) {
		const handle = contactHandle(matching)
		const threadPath = inboxFile(handle)
		try {
			await fs.promises.unlink(threadPath)
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
				log.debug("deleteContact: failed to unlink thread", { error: (err as Error).message })
			}
		}
	}
}

export function contactHandle(contact: CrmContact): string {
	if (contact.email) return contact.email
	if (contact.phone) return contact.phone
	return `${contact.channel ?? "other"}:${contact.id}`
}

export async function readInboxThread(handle: string): Promise<InboxThread> {
	const messages = await readJson<InboxThreadMessage[]>(inboxFile(handle), [])
	return { handle, messages }
}

export async function appendInboxMessage(
	handle: string,
	direction: "in" | "out",
	text: string,
	via: "draft" | "synthesized",
): Promise<InboxThreadMessage> {
	const trimmed = text.trim()
	if (!trimmed) {
		throw new Error("Message text is required")
	}
	const thread = await readInboxThread(handle)
	const message: InboxThreadMessage = {
		id: randomUUID(),
		ts: Date.now(),
		direction,
		text: trimmed,
		via,
	}
	thread.messages.push(message)
	await writeJson(inboxFile(handle), thread.messages)
	return message
}

function formatStamp(ts: number): string {
	const date = new Date(ts)
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const day = String(date.getDate()).padStart(2, "0")
	const hours = String(date.getHours()).padStart(2, "0")
	const minutes = String(date.getMinutes()).padStart(2, "0")
	return `${year}-${month}-${day} ${hours}:${minutes}`
}

function formatAgo(ts: number): string | null {
	const diffMs = Date.now() - ts
	if (!Number.isFinite(diffMs)) return null
	if (diffMs < 60_000) return "<1m"
	const diffMinutes = Math.floor(diffMs / 60_000)
	if (diffMinutes < 60) return `${diffMinutes}m`
	const diffHours = Math.floor(diffMinutes / 60)
	if (diffHours < 24) return `${diffHours}h`
	return `${Math.floor(diffHours / 24)}d`
}

function normalizeChannel(channel: CrmContact["channel"]): InboxChannel {
	switch (channel) {
		case "whatsapp":
		case "instagram":
		case "telegram":
		case "email":
			return channel
		case "phone":
			return "phone"
		case "referral":
		case "other":
		default:
			return "other"
	}
}

function summarizeMessage(message: InboxThreadMessage | null): string {
	if (!message) return "No messages yet"
	const compact = message.text.replace(/\s+/g, " ").trim()
	if (!compact) return "Empty message"
	return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact
}

function customerFromDraft(state: CustomerDraftState): Customer {
	return {
		id: state.contact.id,
		name: state.contact.name,
		channel: normalizeChannel(state.contact.channel),
		handle: state.handle,
		lastAt: state.lastMessage ? formatStamp(state.lastMessage.ts) : null,
		lastAgo: state.lastMessage ? formatAgo(state.lastMessage.ts) : null,
		lastText: summarizeMessage(state.lastMessage),
		msgCount: state.messageCount,
	}
}

async function contactDraftState(contact: CrmContact): Promise<CustomerDraftState> {
	const handle = contactHandle(contact)
	const thread = await readInboxThread(handle)
	const lastMessage = thread.messages.length > 0 ? thread.messages[thread.messages.length - 1] : null
	return {
		contact,
		handle,
		lastMessage,
		messageCount: thread.messages.length,
	}
}

export async function listCustomers(): Promise<Customer[]> {
	const store = await loadCrmStore()
	const states = await Promise.all(store.contacts.map((contact) => contactDraftState(contact)))
	return states
		.map((state) => customerFromDraft(state))
		.sort((left, right) => {
			const leftTs = left.lastAt ? Date.parse(left.lastAt.replace(" ", "T")) : 0
			const rightTs = right.lastAt ? Date.parse(right.lastAt.replace(" ", "T")) : 0
			if (rightTs !== leftTs) return rightTs - leftTs
			return left.name.localeCompare(right.name)
		})
}

export async function customerThread(handle: string, limit = 200): Promise<InboxMessage[]> {
	const normalizedLimit = Math.min(Math.max(Math.floor(limit || 0), 1), 2000)
	const thread = await readInboxThread(handle)
	return thread.messages.slice(-normalizedLimit).map((message) => ({
		ts: formatStamp(message.ts),
		tsAgo: formatAgo(message.ts),
		direction: message.direction,
		text: message.text,
	}))
}

async function resolveCustomer(channel: InboxChannel, to: string): Promise<{ contact: CrmContact; handle: string }> {
	const target = to.trim()
	if (!target) {
		throw new Error("Recipient is required")
	}
	const store = await loadCrmStore()
	const existing = store.contacts.find((contact) => contactHandle(contact) === target)
	if (existing) {
		return { contact: existing, handle: target }
	}
	const synthetic: Partial<CrmContact> = {
		name: target,
		channel: channel === "phone" ? "phone" : channel === "email" ? "email" : channel === "telegram" ? "telegram" : channel === "instagram" ? "instagram" : channel === "whatsapp" || channel === "whatsapp-personal" ? "whatsapp" : "other",
	}
	if (channel === "email") synthetic.email = target
	else synthetic.phone = target
	const id = await saveContact(synthetic)
	const created = (await loadCrmStore()).contacts.find((contact) => contact.id === id)
	if (!created) {
		throw new Error("Failed to create draft contact")
	}
	return { contact: created, handle: contactHandle(created) }
}

export async function sendMessage(channel: InboxChannel, to: string, text: string): Promise<string> {
	const { contact, handle } = await resolveCustomer(channel, to)
	const stored = await appendInboxMessage(handle, "out", text, "draft")
	log.info("sendMessage stored draft-only outbound message", {
		contactId: contact.id,
		handle,
		channel,
		messageId: stored.id,
	})
	return "channel not connected yet; message stored as draft"
}
