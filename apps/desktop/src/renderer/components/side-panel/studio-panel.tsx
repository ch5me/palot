import { Button, Input } from "@ch5me/ch5-ui-web";
import { useMemo, useState } from "react"
import {
	ExternalLinkIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	Loader2Icon,
	MonitorPlayIcon,
	RefreshCwIcon,
} from "lucide-react"
import { useFileSearch } from "../../hooks/use-file-search"
import { detectLanguage } from "../../lib/language"
import type { Agent } from "../../lib/types"
import {
	convertOfficeToPdf,
	fetchFilePreview,
	readTextFile,
	type FilePreview,
	type OfficeConversionResult,
} from "../../services/backend"

interface StudioPanelProps {
	agent: Agent
	className?: string
}

type LoadedPreview =
	| { kind: "idle" }
	| { kind: "loading" }
	| { kind: "error"; message: string }
	| { kind: "text"; text: string; preview: FilePreview }
	| { kind: "pdf"; title: string; src: string }

function isOfficeLike(path: string): boolean {
	return /\.(doc|docx|docm|dot|dotx|rtf|odt|ott|fodt|xls|xlsx|xlsm|xlsb|ods|ots|fods|ppt|pptx|pptm|pps|ppsx|odp|otp|fodp)$/i.test(path)
}

function isPdf(path: string): boolean {
	return /\.pdf$/i.test(path)
}

function fileLabel(path: string): string {
	return path.split("/").pop() ?? path
}

export function StudioPanel({ agent, className }: StudioPanelProps) {
	const directory = agent.worktreePath ?? agent.directory
	const [query, setQuery] = useState("")
	const { files: results, isLoading: loadingResults } = useFileSearch(directory, query, true)
	const [selectedPath, setSelectedPath] = useState<string | null>(null)
	const [previewState, setPreviewState] = useState<LoadedPreview>({ kind: "idle" })

	const shownResults = useMemo(
		() => results.filter((path) => isOfficeLike(path) || isPdf(path)).slice(0, 50),
		[results],
	)

	const selectedName = useMemo(() => (selectedPath ? fileLabel(selectedPath) : null), [selectedPath])

	const loadPreview = async (path: string) => {
		setSelectedPath(path)
		setPreviewState({ kind: "loading" })
		try {
			if (isOfficeLike(path)) {
				const conversion: OfficeConversionResult = await convertOfficeToPdf(path)
				setPreviewState({ kind: "pdf", title: fileLabel(path), src: conversion.pdfPath })
				return
			}

			const preview = await fetchFilePreview(path)
			if (preview.kind === "pdf") {
				setPreviewState({ kind: "pdf", title: preview.name, src: path })
				return
			}

			if (preview.kind === "text") {
				const text = await readTextFile(path)
				setPreviewState({ kind: "text", text, preview })
				return
			}

			setPreviewState({ kind: "error", message: "Preview is not available for this file type in Studio yet." })
		} catch (err) {
			setPreviewState({
				kind: "error",
				message: err instanceof Error ? err.message : "Failed to load document preview",
			})
		}
	}

	const renderPreview = () => {
		if (!selectedPath) {
			return (
				<div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
					Search for a PDF, Word doc, spreadsheet, or slide deck to preview it here.
				</div>
			)
		}

		switch (previewState.kind) {
			case "idle":
				return null
			case "loading":
				return (
					<div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
						<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
						Rendering preview...
					</div>
				)
			case "error":
				return (
					<div className="flex h-full items-center justify-center px-6 text-center">
						<div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-xs text-destructive">
							<div>{previewState.message}</div>
							<div className="text-muted-foreground">Corrupt documents, unsupported formats, or missing LibreOffice all land here explicitly.</div>
						</div>
					</div>
				)
			case "text":
				return (
					<div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/10">
						<div className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
							Preview{detectLanguage(selectedPath) ? ` · ${detectLanguage(selectedPath)}` : ""}
						</div>
						<pre className="min-h-[320px] overflow-auto p-3 text-xs leading-5 text-foreground">
							<code>{previewState.text}</code>
						</pre>
					</div>
				)
			case "pdf":
				return <iframe src={previewState.src} title={previewState.title} className="h-full min-h-[320px] w-full rounded-lg border border-border bg-background" />
		}
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Studio / Office</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					PDF and office-document preview lane for {agent.project}, backed by the new LibreOffice conversion seam.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
				<div className="flex items-center gap-2">
					<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search docs, slides, spreadsheets, PDFs" className="h-9 flex-1" />
					<Button type="button" variant="outline" size="sm" disabled={!selectedPath} onClick={() => selectedPath && void loadPreview(selectedPath)}>
						<RefreshCwIcon className="size-4" aria-hidden="true" />
						Refresh
					</Button>
				</div>
				<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,240px)_minmax(0,1fr)] gap-4 overflow-hidden">
					<div className="min-h-0 overflow-auto rounded-lg border border-border p-2">
						{loadingResults ? (
							<div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
								<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
								Searching...
							</div>
						) : shownResults.length === 0 ? (
							<div className="px-2 py-3 text-xs text-muted-foreground">No office-style files match this query yet.</div>
						) : (
							shownResults.map((path) => {
								const officeLike = isOfficeLike(path)
								return (
									<button
										key={path}
										type="button"
										onClick={() => void loadPreview(path)}
										className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${selectedPath === path ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
									>
										{officeLike ? <FileSpreadsheetIcon className="size-3.5 shrink-0 text-sky-500" aria-hidden="true" /> : <MonitorPlayIcon className="size-3.5 shrink-0 text-red-500" aria-hidden="true" />}
										<span className="min-w-0 truncate font-mono">{path}</span>
									</button>
									)
								})
						)}
					</div>
					<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
						<div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
							<FileTextIcon className="size-4 text-muted-foreground" aria-hidden="true" />
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm font-medium text-foreground">{selectedName ?? "No document selected"}</div>
								<div className="truncate font-mono text-[11px] text-muted-foreground">{selectedPath ?? directory}</div>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 px-2"
								disabled={!selectedPath}
								onClick={() => {
									if (selectedPath) {
										void navigator.clipboard.writeText(selectedPath)
									}
								}}
							>
								<ExternalLinkIcon className="size-3" aria-hidden="true" />
								Path
							</Button>
						</div>
						<div className="min-h-0 flex-1 overflow-hidden">{renderPreview()}</div>
					</div>
				</div>
			</div>
		</div>
	)
}
