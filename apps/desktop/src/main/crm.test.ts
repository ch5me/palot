import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import {
	contactHandle,
	deleteContact,
	loadCrmStore,
	readInboxThread,
	saveContact,
} from "./crm"
import { customerThread, listCustomers, sendMessage } from "./inbox"

async function withTempDataDir<T>(run: () => Promise<T>): Promise<T> {
	const previous = process.env.PALOT_DATA_DIR
	const tempDir = await mkdtemp(join(tmpdir(), "palot-crm-"))
	process.env.PALOT_DATA_DIR = tempDir
	try {
		return await run()
	} finally {
		if (previous === undefined) delete process.env.PALOT_DATA_DIR
		else process.env.PALOT_DATA_DIR = previous
		await rm(tempDir, { recursive: true, force: true })
	}
}

test("loadCrmStore starts empty", async () => {
	await withTempDataDir(async () => {
		const store = await loadCrmStore()
		assert.equal(store.contacts.length, 0)
	})
})

test("saveContact creates a contact and returns id", async () => {
	await withTempDataDir(async () => {
		const id = await saveContact({
			name: "Ada Lovelace",
			email: "ada@example.com",
			channel: "email",
			tags: ["math"],
		})
		assert.ok(id)
		const store = await loadCrmStore()
		assert.equal(store.contacts.length, 1)
		assert.equal(store.contacts[0].name, "Ada Lovelace")
	})
})

test("saveContact rejects empty name and unknown channel", async () => {
	await withTempDataDir(async () => {
		await assert.rejects(() => saveContact({ name: "" }), /name is required/)
		await assert.rejects(
			() => saveContact({ name: "X", channel: "carrier-pigeon" as never }),
			/channel/,
		)
	})
})

test("saveContact updates existing contact by id", async () => {
	await withTempDataDir(async () => {
		const id = await saveContact({ name: "Grace", email: "grace@example.com" })
		await saveContact({ id, name: "Grace Hopper", phone: "+1-555-0001", channel: "phone" })
		const store = await loadCrmStore()
		assert.equal(store.contacts.length, 1)
		assert.equal(store.contacts[0].name, "Grace Hopper")
		assert.equal(store.contacts[0].channel, "phone")
	})
})

test("deleteContact removes the contact and its thread", async () => {
	await withTempDataDir(async () => {
		const id = await saveContact({ name: "Doomed", email: "doomed@example.com" })
		await sendMessage("email", "doomed@example.com", "hi")
		await deleteContact(id)
		const store = await loadCrmStore()
		assert.equal(store.contacts.length, 0)
		const thread = await readInboxThread("doomed@example.com")
		assert.equal(thread.messages.length, 0)
	})
})

test("contactHandle prefers email, then phone, then synthetic", async () => {
	await withTempDataDir(async () => {
		assert.equal(
			contactHandle({ id: "a", name: "A", email: "a@x.com", createdAt: 0 }),
			"a@x.com",
		)
		assert.equal(
			contactHandle({ id: "b", name: "B", phone: "+1", createdAt: 0 }),
			"+1",
		)
		assert.equal(
			contactHandle({ id: "c", name: "C", channel: "other", createdAt: 0 }),
			"other:c",
		)
	})
})

test("listCustomers projects contacts and thread snippets", async () => {
	await withTempDataDir(async () => {
		const id = await saveContact({ name: "Inbox", email: "inbox@example.com", channel: "email" })
		await sendMessage("email", "inbox@example.com", "hello")
		const customers = await listCustomers()
		assert.equal(customers.length, 1)
		assert.equal(customers[0].id, id)
		assert.equal(customers[0].channel, "email")
		assert.equal(customers[0].msgCount, 1)
		assert.equal(customers[0].lastText, "hello")
	})
})

test("customerThread returns messages oldest-first", async () => {
	await withTempDataDir(async () => {
		const handle = "thread@example.com"
		await sendMessage("email", handle, "first")
		await sendMessage("email", handle, "second")
		const thread = await customerThread(handle, 10)
		assert.equal(thread.length, 2)
		assert.equal(thread[0].text, "first")
		assert.equal(thread[1].text, "second")
	})
})

test("sendMessage returns explicit no-delivery reason", async () => {
	await withTempDataDir(async () => {
		const result = await sendMessage("whatsapp", "+1-555-0002", "ping")
		assert.equal(result.delivered, false)
		assert.match(result.reason, /whatsapp/)
		assert.equal(typeof result.ts, "number")
	})
})

test("sendMessage rejects empty text and unknown channel", async () => {
	await withTempDataDir(async () => {
		await assert.rejects(() => sendMessage("email", "x@y.com", ""), /text is required/)
		await assert.rejects(
			() => sendMessage("pigeon" as never, "x@y.com", "hi"),
			/channel/,
		)
	})
})

test("readInboxThread returns empty for unknown handle", async () => {
	await withTempDataDir(async () => {
		const thread = await readInboxThread("nobody@example.com")
		assert.equal(thread.messages.length, 0)
	})
})

test("deleteContact unlinks the inbox thread for the contact", async () => {
	await withTempDataDir(async () => {
		const id = await saveContact({ name: "Thread Owner", email: "t@example.com" })
		await sendMessage("email", "t@example.com", "draft only")
		await deleteContact(id)
		const thread = await readInboxThread("t@example.com")
		assert.equal(thread.messages.length, 0)
	})
})
