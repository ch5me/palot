
export const PDF_LOCATOR_SCHEMA_VERSION = 1

export const PDF_LOCATOR_RESOLUTION = {
	resolved: "resolved",
	ambiguous: "ambiguous",
	pageOnly: "page-only",
	unresolved: "unresolved",
} as const

export type PdfLocatorResolution = (typeof PDF_LOCATOR_RESOLUTION)[keyof typeof PDF_LOCATOR_RESOLUTION]

export interface PdfLocatorTextQuote {
	exact: string
	prefix?: string
	suffix?: string
}

export interface PdfLocatorTextPosition {
	page: number
	start: number
	end: number
}

export interface PdfLocatorStructuralAnchor {
	kind: "section" | "heading" | "list-item" | "figure" | "table" | "page"
	id?: string
	label?: string
}

export interface PdfLocatorBase {
	documentId: string
	schemaVersion: number
	createdAt?: string
	updatedAt?: string
}

export interface PdfLocatorResolved extends PdfLocatorBase {
	resolution: "resolved"
	page: number
	quote: PdfLocatorTextQuote
	position: PdfLocatorTextPosition
	structural?: PdfLocatorStructuralAnchor
	confidence: number
}

export interface PdfLocatorAmbiguous extends PdfLocatorBase {
	resolution: "ambiguous"
	page?: number
	quote: PdfLocatorTextQuote
	matches: Array<{
		page: number
		position: PdfLocatorTextPosition
		confidence: number
	}>
	confidence: number
}

export interface PdfLocatorPageOnly extends PdfLocatorBase {
	resolution: "page-only"
	page: number
	quote?: PdfLocatorTextQuote
	confidence: number
}

export interface PdfLocatorUnresolved extends PdfLocatorBase {
	resolution: "unresolved"
	quote?: PdfLocatorTextQuote
	attempted: Array<"exact" | "page" | "quote" | "context">
	reason: string
}

export type PdfLocator =
	| PdfLocatorResolved
	| PdfLocatorAmbiguous
	| PdfLocatorPageOnly
	| PdfLocatorUnresolved

export interface PdfDocumentRef {
	documentId: string
	title?: string
	sourceUri?: string
	mimeType?: string
}

export function isResolvedLocator(
	locator: PdfLocator,
): locator is PdfLocatorResolved | PdfLocatorAmbiguous | PdfLocatorPageOnly {
	return locator.resolution !== "unresolved"
}

export function serializePdfLocator(locator: PdfLocator): string {
	if (locator.schemaVersion !== PDF_LOCATOR_SCHEMA_VERSION) {
		throw new Error(
			`Unsupported pdf locator schemaVersion ${locator.schemaVersion}; expected ${PDF_LOCATOR_SCHEMA_VERSION}`,
		)
	}
	return JSON.stringify(locator)
}

export function deserializePdfLocator(payload: string): PdfLocator {
	const parsed = JSON.parse(payload) as PdfLocator
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		typeof parsed.documentId !== "string" ||
		typeof parsed.schemaVersion !== "number" ||
		typeof parsed.resolution !== "string"
	) {
		throw new Error("Malformed pdf locator payload: missing documentId, schemaVersion, or resolution")
	}
	if (parsed.schemaVersion !== PDF_LOCATOR_SCHEMA_VERSION) {
		throw new Error(
			`Unsupported pdf locator schemaVersion ${parsed.schemaVersion}; expected ${PDF_LOCATOR_SCHEMA_VERSION}`,
		)
	}
	return parsed
}

export function buildResolvedLocator(input: {
	documentId: string
	page: number
	quote: PdfLocatorTextQuote
	position: PdfLocatorTextPosition
	structural?: PdfLocatorStructuralAnchor
	confidence?: number
}): PdfLocatorResolved {
	return {
		schemaVersion: PDF_LOCATOR_SCHEMA_VERSION,
		resolution: "resolved",
		documentId: input.documentId,
		page: input.page,
		quote: input.quote,
		position: input.position,
		structural: input.structural,
		confidence: input.confidence ?? 1,
		createdAt: new Date().toISOString(),
	}
}

export function buildUnresolvedLocator(input: {
	documentId: string
	quote?: PdfLocatorTextQuote
	attempted: Array<"exact" | "page" | "quote" | "context">
	reason: string
}): PdfLocatorUnresolved {
	return {
		schemaVersion: PDF_LOCATOR_SCHEMA_VERSION,
		resolution: "unresolved",
		documentId: input.documentId,
		quote: input.quote,
		attempted: input.attempted,
		reason: input.reason,
		createdAt: new Date().toISOString(),
	}
}
