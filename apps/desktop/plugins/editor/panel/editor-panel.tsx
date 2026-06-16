/**
 * Editor surface panel — moved from
 * `src/renderer/components/side-panel/editor-panel.tsx`.
 * Part of the V2 plugin catalog migration (firefly.built-in.surface.editor).
 */

import { Button, Input } from "@ch5me/ch5-ui-web";
import { useEffect, useMemo, useRef, useState } from "react"
import type * as Monaco from "monaco-editor"
import { CheckIcon, CircleIcon, ExternalLinkIcon, FileIcon, Loader2Icon } from "lucide-react"
import { useFileSearch } from "../../../src/renderer/hooks/use-file-search"
import { initMonaco, languageForPath } from "../../../src/renderer/lib/monaco"
import type { Agent } from "../../../src/renderer/lib/types"
import { readTextFile, writeTextFile } from "../../../src/renderer/services/backend"

interface EditorPanelProps {
	agent: Agent
	className?: string
}

export default function EditorPanel({ agent, className }: EditorPanelProps) {
	const [query, setQuery] = useState("")
	const { files: results, isLoading: loadingResults } = useFileSearch(agent.worktreePath ?? agent.directory, query, true)
	const [selectedPath, setSelectedPath] = useState<string | null>(null)
	const [dirty, setDirty] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [savedAt, setSavedAt] = useState<number | null>(null)
	const hostRef = useRef<HTMLDivElement | null>(null)
	const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
	const saveRef = useRef<() => void>(() => {})

	useEffect(() => {
		if (!selectedPath) {
			setDirty(false)
			setSavedAt(null)
			setError(null)
			setLoading(false)
			editorRef.current?.getModel()?.dispose()
			editorRef.current?.dispose()
			editorRef.current = null
			return
		}

		let disposed = false
		let editor: Monaco.editor.IStandaloneCodeEditor | null = null

		const setup = async () => {
			setLoading(true)
			setError(null)
			setDirty(false)
			setSavedAt(null)
			const monaco = initMonaco()
			let content: string
			try {
				content = await readTextFile(selectedPath)
			} catch (err) {
				if (!disposed) {
					setError(err instanceof Error ? err.message : "Failed to read file")
					setLoading(false)
				}
				return
			}

			if (disposed || !hostRef.current) {
				return
			}

			editorRef.current?.getModel()?.dispose()
			editorRef.current?.dispose()

			editor = monaco.editor.create(hostRef.current, {
				value: content,
				language: languageForPath(selectedPath),
				theme: "elf-dark",
				automaticLayout: true,
				fontSize: 13,
				fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
				fontLigatures: true,
				minimap: { enabled: true },
				smoothScrolling: true,
				cursorBlinking: "smooth",
				scrollBeyondLastLine: false,
				renderWhitespace: "selection",
				tabSize: 2,
				bracketPairColorization: { enabled: true },
				padding: { top: 10 },
			})
			editorRef.current = editor
			setLoading(false)

			const save = async () => {
				const current = editorRef.current
				if (!current) {
					return
				}
				try {
					await writeTextFile(selectedPath, current.getValue())
					if (!disposed) {
						setDirty(false)
						setSavedAt(Date.now())
					}
				} catch (err) {
					if (!disposed) {
						setError(err instanceof Error ? err.message : "Failed to save file")
					}
				}
			}

			saveRef.current = save
			editor.onDidChangeModelContent(() => {
				if (!disposed) {
					setDirty(true)
					setSavedAt(null)
				}
			})
			editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
				void saveRef.current()
			})
		}

		void setup()

		return () => {
			disposed = true
			editor?.getModel()?.dispose()
			editor?.dispose()
			if (editorRef.current === editor) {
				editorRef.current = null
			}
		}
	}, [selectedPath])

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
				event.preventDefault()
				void saveRef.current()
			}
		}
		window.addEventListener("keydown", onKeyDown)
		return () => window.removeEventListener("keydown", onKeyDown)
	}, [])

	const selectedName = useMemo(() => selectedPath?.split("/").pop() ?? null, [selectedPath])

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Editor</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Monaco-backed in-app editor for text files in the active checkout.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
				<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project files" className="h-9" />
				<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,240px)_minmax(0,1fr)] overflow-hidden rounded-lg border border-border">
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
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
							{dirty ? (
								<CircleIcon className="size-2 shrink-0 fill-amber-500 text-amber-500" aria-hidden="true" />
							) : savedAt ? (
								<CheckIcon className="size-3 shrink-0 text-emerald-500" aria-hidden="true" />
							) : null}
							<span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground" title={selectedPath ?? undefined}>
								{selectedName ?? "Select a file"}
							</span>
							{dirty && <span className="font-mono text-[10px] text-muted-foreground">Cmd/Ctrl+S to save</span>}
							<span className="flex-1" />
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-6 px-2"
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
						<div className="relative min-h-0 flex-1 overflow-hidden">
							<div ref={hostRef} className="h-full w-full" />
							{loading && (
								<div className="absolute inset-0 grid place-items-center bg-background">
									<Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
								</div>
							)}
							{error && (
								<div className="absolute inset-0 grid place-items-center bg-background px-6 text-center">
									<div className="flex flex-col items-center gap-2">
										<span className="font-mono text-[12px] text-destructive">{error}</span>
										<div className="text-xs text-muted-foreground">
											{error.includes("outside allowed roots")
												? "Browser mode can only edit files inside allowed project roots."
												: "Unsupported binary or oversized file. Use the Files surface or open the path externally."}
										</div>
									</div>
								</div>
							)}
							{!selectedPath && !loading && !error && (
								<div className="absolute inset-0 flex items-center justify-center text-center text-xs text-muted-foreground">
									Search and select a file to edit it in Monaco.
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
