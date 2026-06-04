import { Input } from "@ch5me/palot-ui/components/input"
import { useEffect, useMemo, useState } from "react"
import { FileIcon, Loader2Icon } from "lucide-react"
import { detectContentLanguage, detectLanguage, prettyPrintJson } from "../../lib/language"
import type { Agent } from "../../lib/types"
import { readFileContents } from "../../services/backend"
import { getProjectClient } from "../../services/connection-manager"

interface EditorPanelProps {
	agent: Agent
	className?: string
}

export function EditorPanel({ agent, className }: EditorPanelProps) {
	const [query, setQuery] = useState("")
	const [results, setResults] = useState<string[]>([])
	const [loadingResults, setLoadingResults] = useState(false)
	const [selectedPath, setSelectedPath] = useState<string | null>(null)
	const [content, setContent] = useState("")
	const [loadingContent, setLoadingContent] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		const trimmed = query.trim()
		if (!trimmed) {
			setResults([])
			return
		}
		const client = getProjectClient(agent.directory)
		if (!client) {
			setError("Not connected to OpenCode server")
			return
		}
		setLoadingResults(true)
		void client.find.files({ query: trimmed })
			.then((result) => {
				if (cancelled) return
				setResults((result.data ?? []) as string[])
			})
			.catch((err) => {
				if (cancelled) return
				setError(err instanceof Error ? err.message : "Failed to search files")
			})
			.finally(() => {
				if (cancelled) return
				setLoadingResults(false)
			})
		return () => {
			cancelled = true
		}
	}, [agent.directory, query])

	useEffect(() => {
		if (!selectedPath) {
			setContent("")
			return
		}
		let cancelled = false
		setLoadingContent(true)
		setError(null)
		void readFileContents(selectedPath)
			.then((result) => {
				if (cancelled) return
				const language = detectLanguage(result.path)
				const contentLanguage = detectContentLanguage(result.content)
				setContent(
					language === "json" || contentLanguage === "json"
						? prettyPrintJson(result.content)
						: result.content,
				)
			})
			.catch((err) => {
				if (cancelled) return
				setError(err instanceof Error ? err.message : "Failed to load file")
				setContent("")
			})
			.finally(() => {
				if (cancelled) return
				setLoadingContent(false)
			})
		return () => {
			cancelled = true
		}
	}, [selectedPath])

	const language = useMemo(
		() => detectLanguage(selectedPath ?? undefined) ?? detectContentLanguage(content),
		[selectedPath, content],
	)

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Editor</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Read-only code inspection shell that complements Files. Monaco is deferred until true editing is needed.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search project files"
					className="h-9"
				/>
				<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,220px)_minmax(0,1fr)] overflow-hidden rounded-lg border border-border">
					<div className="min-h-0 overflow-auto border-r border-border p-2">
						{loadingResults ? (
							<div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
								<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
								Searching...
							</div>
						) : results.length === 0 ? (
							<div className="px-2 py-3 text-xs text-muted-foreground">Type to search project files.</div>
						) : (
							results.map((result) => (
								<button
									key={result}
									type="button"
									onClick={() => setSelectedPath(result)}
									className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${selectedPath === result ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
								>
									<FileIcon className="size-3.5 shrink-0" aria-hidden="true" />
									<span className="min-w-0 truncate font-mono">{result}</span>
								</button>
							))
						)}
					</div>
					<div className="min-h-0 overflow-auto p-3">
						{error ? (
							<div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-xs text-destructive">
								{error}
							</div>
						) : loadingContent ? (
							<div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
								<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
								Loading file...
							</div>
						) : selectedPath ? (
							<div className="space-y-3">
								<div className="text-[11px] text-muted-foreground">{selectedPath}{language ? ` · ${language}` : ""}</div>
								<pre className="min-h-[320px] overflow-auto rounded-md bg-muted/20 p-3 text-xs leading-5 text-foreground">
									<code>{content}</code>
								</pre>
							</div>
						) : (
							<div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
								Search and select a file to inspect it in the editor shell.
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
