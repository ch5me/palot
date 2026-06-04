import { Button } from "@ch5me/elf-ui/components/button"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { useEffect, useMemo, useState } from "react"
import { FileIcon, FolderIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import { useSetAtom } from "jotai"
import { viewFileInDiffPanelAtom } from "../../atoms/ui"
import { detectContentLanguage, detectLanguage, prettyPrintJson } from "../../lib/language"
import type { Agent } from "../../lib/types"
import { listDirectory, readFileContents, type FileSystemEntry } from "../../services/backend"

interface FilesPanelProps {
	agent: Agent
	className?: string
}

export function FilesPanel({ agent, className }: FilesPanelProps) {
	const openDiffFile = useSetAtom(viewFileInDiffPanelAtom)
	const [entries, setEntries] = useState<FileSystemEntry[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [selectedPath, setSelectedPath] = useState<string | null>(null)
	const [previewContent, setPreviewContent] = useState<string>("")
	const [previewLoading, setPreviewLoading] = useState(false)
	const [previewError, setPreviewError] = useState<string | null>(null)

	const loadEntries = async () => {
		setLoading(true)
		setError(null)
		try {
			const nextEntries = await listDirectory(agent.worktreePath ?? agent.directory)
			setEntries(nextEntries)
			setSelectedPath((current) =>
				current && nextEntries.some((entry) => entry.path === current) ? current : null,
			)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load files")
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void loadEntries()
	}, [agent.directory, agent.worktreePath])

	const selectedEntry = useMemo(
		() => entries.find((entry) => entry.path === selectedPath) ?? null,
		[entries, selectedPath],
	)

	useEffect(() => {
		if (!selectedEntry || selectedEntry.type === "directory") {
			setPreviewContent("")
			setPreviewError(null)
			setPreviewLoading(false)
			return
		}

		let cancelled = false
		setPreviewLoading(true)
		setPreviewError(null)
		void readFileContents(selectedEntry.path)
			.then((result) => {
				if (cancelled) return
				const language = detectLanguage(result.path)
				const contentLanguage = detectContentLanguage(result.content)
				const nextContent = language === "json" || contentLanguage === "json"
					? prettyPrintJson(result.content)
					: result.content
				setPreviewContent(nextContent)
			})
			.catch((err) => {
				if (cancelled) return
				setPreviewError(err instanceof Error ? err.message : "Failed to read file")
				setPreviewContent("")
			})
			.finally(() => {
				if (cancelled) return
				setPreviewLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [selectedEntry])

	const previewLanguage = useMemo(() => {
		if (!selectedEntry || selectedEntry.type === "directory") return undefined
		return detectLanguage(selectedEntry.path) ?? detectContentLanguage(previewContent)
	}, [selectedEntry, previewContent])

	return (
		<div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-medium text-foreground">Files</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							Review-adjacent file browser for the active project checkout.
						</p>
					</div>
					<Button type="button" variant="outline" size="sm" onClick={() => void loadEntries()}>
						<RefreshCwIcon className="size-4" aria-hidden="true" />
						Refresh
					</Button>
				</div>
			</div>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,220px)_minmax(0,1fr)] overflow-hidden">
				<div className="min-h-0 overflow-auto border-r border-border p-2">
					{loading ? (
						<div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
							<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
							Loading files...
						</div>
					) : error ? (
						<div className="px-2 py-3 text-xs text-destructive">{error}</div>
					) : entries.length === 0 ? (
						<div className="px-2 py-3 text-xs text-muted-foreground">No visible files in this directory.</div>
					) : (
						entries.map((entry) => (
							<button
								key={entry.path}
								type="button"
								onClick={() => setSelectedPath(entry.path)}
								className={cn(
									"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
									selectedPath === entry.path
										? "bg-muted text-foreground"
										: "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
								)}
							>
								{entry.type === "directory" ? (
									<FolderIcon className="size-3.5 shrink-0" aria-hidden="true" />
								) : (
									<FileIcon className="size-3.5 shrink-0" aria-hidden="true" />
								)}
								<span className="min-w-0 truncate font-mono">{entry.name}</span>
							</button>
						))
					)}
				</div>
				<div className="min-h-0 overflow-auto p-4">
					{selectedEntry ? (
						<div className="flex min-h-full flex-col gap-4">
							<div>
								<p className="text-xs uppercase tracking-wide text-muted-foreground">Selected</p>
								<h4 className="mt-1 text-sm font-medium text-foreground">{selectedEntry.name}</h4>
								<p className="mt-1 break-all font-mono text-xs text-muted-foreground">
									{selectedEntry.path}
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => openDiffFile(selectedEntry.path)}
									disabled={selectedEntry.type === "directory"}
								>
									Open in Changes
								</Button>
							</div>
							{selectedEntry.type === "directory" ? (
								<div className="rounded-lg border border-dashed border-border px-4 py-6 text-xs text-muted-foreground">
									Directory previews are deferred. Pick a file to inspect its contents.
								</div>
							) : previewLoading ? (
								<div className="flex items-center gap-2 rounded-lg border border-border px-4 py-6 text-xs text-muted-foreground">
									<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
									Loading preview...
								</div>
							) : previewError ? (
								<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-xs text-destructive">
									{previewError}
								</div>
							) : (
								<div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/10">
									<div className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
										Preview{previewLanguage ? ` · ${previewLanguage}` : ""}
									</div>
									<pre className="min-h-[240px] overflow-auto p-3 text-xs leading-5 text-foreground">
										<code>{previewContent}</code>
									</pre>
								</div>
							)}
						</div>
					) : (
						<div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
							Select a file to inspect it or jump into the Changes surface.
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
