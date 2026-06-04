import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { convertOfficeToPdf } from "./files"

function makeTempDir(name: string): string {
	const directory = path.join(tmpdir(), `elf-office-${name}-${Date.now()}`)
	mkdirSync(directory, { recursive: true })
	return directory
}

test("office conversion reports unavailable when soffice is missing", async () => {
	const directory = makeTempDir("missing")
	const filePath = path.join(directory, "sample.docx")
	try {
		writeFileSync(filePath, "stub", "utf-8")
		await assert.rejects(() => convertOfficeToPdf(filePath), /LibreOffice \(soffice\) not found|conversion failed|produced no PDF/)
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
})
