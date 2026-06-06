import { FileTextIcon, ScrollTextIcon } from "lucide-react"
import type { Agent } from "../../lib/types"
import { PDF_LOCATOR_SCHEMA_VERSION, buildResolvedLocator, serializePdfLocator } from "../../../shared/pdf-locator"

interface PdfReviewPanelProps {
	agent: Agent
	className?: string
}

export function PdfReviewPanel({ agent, className }: PdfReviewPanelProps) {
	const sampleLocator = buildResolvedLocator({
		documentId: "sample-document",
		page: 1,
		quote: { exact: "Sample quote", prefix: "Before ", suffix: " after" },
		position: { page: 1, start: 0, end: 12 },
	})
	return (
		<div
			className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}
			data-testid="pdf-review-panel"
			aria-label="PDF Review panel"
		>
			<div className="border-b border-border px-4 py-3" data-testid="pdf-review-header">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
							<FileTextIcon className="size-4" aria-hidden="true" />
							PDF Review
						</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							Grounded chat, selection actions, annotations, and project retrieval for {agent.project}.
						</p>
					</div>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 text-sm">
				<section
					className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
					data-testid="pdf-review-locator-preview"
				>
					<div className="font-medium text-foreground">Shared locator contract v{PDF_LOCATOR_SCHEMA_VERSION}</div>
					<p className="mt-1">
						Every chat citation, annotation, search hit, project answer, artifact reference, and grounded
						data-table cell uses the same locator shape. This panel is the wire-format preview.
					</p>
					<pre className="mt-2 overflow-x-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-snug">
						{serializePdfLocator(sampleLocator)}
					</pre>
				</section>
				<section
					className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
					data-testid="pdf-review-next-slices"
				>
					<div className="flex items-center gap-2 font-medium text-foreground">
						<ScrollTextIcon className="size-3.5" aria-hidden="true" />
						Next slices
					</div>
					<ul className="mt-1 list-disc space-y-1 pl-5">
						<li>Locator resolution engine (precise, page, quote, context fallback)</li>
						<li>Desktop viewer integration via react-pdf + PDF.js text layer</li>
						<li>Grounded streaming citation protocol between chat and document viewer</li>
						<li>Selection action menu (ask AI, annotate, save quote)</li>
					</ul>
				</section>
			</div>
		</div>
	)
}
