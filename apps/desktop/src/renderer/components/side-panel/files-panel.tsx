import { Button } from "@ch5me/elf-ui/components/button"
import { Input } from "@ch5me/elf-ui/components/input"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import {
	ChevronRightIcon,
	FileCodeIcon,
	FileIcon,
	FileTextIcon,
	FolderIcon,
	HomeIcon,
	ImageIcon,
	Loader2Icon,
	RefreshCwIcon,
	SearchIcon,
} from "lucide-react"
import { useSetAtom } from "jotai"
import { viewFileInDiffPanelAtom } from "../../atoms/ui"
import { detectContentLanguage, detectLanguage, prettyPrintJson } from "../../lib/language"
import type { Agent } from "../../lib/types"
import {
	fetchFileGitStatus,
	fetchFilePreview,
	fetchHomeDirectory,
	readDirectoryTree,
	type FilePreview,
	type FileSystemEntry,
} from "../../services/backend"

interface FilesPanelProps {
	agent: Agent
	className?: string
}

type GitCode = "M" | "A" | "D" | "R" | "U"

interface TreeRow {
	entry: FileSystemEntry
	depth: number
	folderDirty: boolean
	gitCode?: GitCode
}

const GIT_COLOR: Record<GitCode, string> = {
	M: "text-amber-500",
	A: "text-emerald-500",
	U: "text-emerald-500",
	D: "text-red-500",
	R: "text-sky-500",
}

function fileVisual(name: string) {
	const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : ""
	if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
		return { Icon: ImageIcon, className: "text-violet-500" }
	}
	if (detectLanguage(name)) {
		return { Icon: FileCodeIcon, className: "text-sky-500" }
	}
	if (["md", "txt", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)) {
		return { Icon: FileTextIcon, className: "text-muted-foreground" }
	}
	return { Icon: FileIcon, className: "text-muted-foreground" }
}

function buildTreeRows(args: {
	root: string
	children: Map<string, FileSystemEntry[]>
	expanded: Set<string>
	filter: string
	git: Map<string, GitCode>
	gitFolders: Set<string>
}): TreeRow[] {
	const rows: TreeRow[] = []
	const query = args.filter.trim().toLowerCase()

	const walk = (directory: string, depth: number) => {
		const list = args.children.get(directory) ?? []
		for (const entry of list) {
			if (query && !entry.type.includes("directory") && !entry.name.toLowerCase().includes(query)) {
				continue
			}
			rows.push({
				entry,
				depth,
				gitCode: args.git.get(entry.path),
				folderDirty: entry.type === "directory" && args.gitFolders.has(entry.path),
			})
			if (entry.type === "directory" && args.expanded.has(entry.path)) {
				walk(entry.path, depth + 1)
			}
		}
	}

	walk(args.root, 0)
	return rows
}

export function FilesPanel({ agent, className }: FilesPanelProps) {
	const openDiffFile = useSetAtom(viewFileInDiffPanelAtom)
	const projectRoot = agent.worktreePath ?? agent.directory
	const [root, setRoot] = useState(projectRoot)
	const [expanded, setExpanded] = useState<Set<string>>(new Set([projectRoot]))
	const [children, setChildren] = useState<Map<string, FileSystemEntry[]>>(new Map())
	const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set())
	const [filter, setFilter] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [selectedPath, setSelectedPath] = useState<string | null>(null)
	const [preview, setPreview] = useState<FilePreview | null>(null)
	const [previewLoading, setPreviewLoading] = useState(false)
	const [previewError, setPreviewError] = useState<string | null>(null)
	const [git, setGit] = useState<Map<string, GitCode>>(new Map())
	const [gitFolders, setGitFolders] = useState<Set<string>>(new Set())

	const loadDir = async (directory: string) => {
		setLoadingDirs((current) => new Set(current).add(directory))
		try {
			const entries = await readDirectoryTree(directory)
			setChildren((current) => new Map(current).set(directory, entries))
			setError(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load files")
		} finally {
			setLoadingDirs((current) => {
				const next = new Set(current)
				next.delete(directory)
				return next
			})
		}
	}

	const refreshGit = async (directory: string) => {
		try {
			const status = await fetchFileGitStatus(directory)
			const nextGit = new Map<string, GitCode>()
			const nextFolders = new Set<string>()
			const stopAt = status.root ?? ""
			for (const entry of status.entries) {
				nextGit.set(entry.path, entry.status)
				let current = entry.path.slice(0, entry.path.lastIndexOf("/"))
				while (current && current.length >= stopAt.length) {
					nextFolders.add(current)
					if (current === stopAt) {
						break
					}
					const parent = current.slice(0, current.lastIndexOf("/"))
					if (parent === current) {
						break
					}
					current = parent
				}
			}
			setGit(nextGit)
			setGitFolders(nextFolders)
		} catch {
			setGit(new Map())
			setGitFolders(new Set())
		}
	}

	useEffect(() => {
		setRoot(projectRoot)
		setExpanded(new Set([projectRoot]))
		setChildren(new Map())
		setSelectedPath(null)
		void loadDir(projectRoot)
		void refreshGit(projectRoot)
	}, [projectRoot])

	useEffect(() => {
		if (!selectedPath) {
			setPreview(null)
			setPreviewError(null)
			setPreviewLoading(false)
			return
		}

		const selectedEntry = Array.from(children.values())
			.flat()
			.find((entry) => entry.path === selectedPath)

		if (!selectedEntry || selectedEntry.type === "directory") {
			setPreview(null)
			setPreviewError(null)
			setPreviewLoading(false)
			return
		}

		let cancelled = false
		setPreviewLoading(true)
		setPreviewError(null)
		void fetchFilePreview(selectedEntry.path)
			.then((nextPreview) => {
				if (!cancelled) {
					setPreview(nextPreview)
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setPreview(null)
					setPreviewError(err instanceof Error ? err.message : "Failed to preview file")
				}
			})
			.finally(() => {
				if (!cancelled) {
					setPreviewLoading(false)
				}
			})

		return () => {
			cancelled = true
		}
	}, [selectedPath, children])

	const rows = useMemo(
		() =>
			buildTreeRows({
				root,
				children,
				expanded,
				filter,
				git,
				gitFolders,
			}),
		[root, children, expanded, filter, git, gitFolders],
	)

	const selectedEntry = useMemo(
		() => Array.from(children.values()).flat().find((entry) => entry.path === selectedPath) ?? null,
		[children, selectedPath],
	)

	const rootName = root.split("/").filter(Boolean).pop() ?? root

	const toggleDirectory = (directory: string) => {
		setExpanded((current) => {
			const next = new Set(current)
			if (next.has(directory)) {
				next.delete(directory)
			} else {
				next.add(directory)
				if (!children.has(directory)) {
					void loadDir(directory)
				}
			}
			return next
		})
	}

	const refreshAll = () => {
		for (const directory of expanded) {
			void loadDir(directory)
		}
		if (!children.has(root)) {
			void loadDir(root)
		}
		void refreshGit(root)
	}

	const goHome = async () => {
		const home = await fetchHomeDirectory()
		setRoot(home)
		setExpanded(new Set([home]))
		setChildren(new Map())
		setSelectedPath(null)
		void loadDir(home)
		void refreshGit(home)
	}

	const goUp = () => {
		const parent = root.replace(/\/[^/]+\/?$/, "") || "/"
		if (parent !== root) {
			setRoot(parent)
			setExpanded(new Set([parent]))
			setChildren(new Map())
			setSelectedPath(null)
			void loadDir(parent)
			void refreshGit(parent)
		}
	}

	const previewText = useMemo(() => {
		if (!preview || preview.kind !== "text") {
			return ""
		}
		const language = detectLanguage(selectedEntry?.path) ?? detectContentLanguage(preview.text ?? "")
		return language === "json" ? prettyPrintJson(preview.text ?? "") : (preview.text ?? "")
	}, [preview, selectedEntry])

	return (
		<div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-medium text-foreground">Files</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							Tree explorer with git decorations and inline file viewer for the active checkout.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button type="button" variant="outline" size="sm" onClick={() => void goHome()}>
							<HomeIcon className="size-4" aria-hidden="true" />
						</Button>
						<Button type="button" variant="outline" size="sm" onClick={refreshAll}>
							<RefreshCwIcon className={cn("size-4", loadingDirs.size > 0 && "animate-spin")} aria-hidden="true" />
							Refresh
						</Button>
					</div>
				</div>
			</div>
			<div className="flex items-center gap-2 border-b border-border px-4 py-2">
				<Button type="button" variant="ghost" size="sm" onClick={goUp}>
					{rootName}
				</Button>
				<div className="relative min-w-0 flex-1">
					<SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
					<Input value={filter} onChange={(event: ChangeEvent<HTMLInputElement>) => setFilter(event.target.value)} placeholder="Filter files" className="h-8 pl-7" />
				</div>
			</div>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,260px)_minmax(0,1fr)] overflow-hidden">
				<div className="min-h-0 overflow-auto border-r border-border p-2">
					{error ? (
						<div className="px-2 py-3 text-xs text-destructive">{error}</div>
					) : rows.length === 0 ? (
						<div className="px-2 py-3 text-xs text-muted-foreground">{loadingDirs.size > 0 ? "Loading files..." : "No matching files."}</div>
					) : (
						rows.map(({ entry, depth, gitCode, folderDirty }) => {
							const { Icon, className: iconClassName } = fileVisual(entry.name)
							const isOpen = expanded.has(entry.path)
							return (
								<button
									key={entry.path}
									type="button"
									onClick={() => (entry.type === "directory" ? toggleDirectory(entry.path) : setSelectedPath(entry.path))}
									className={cn(
										"flex h-7 w-full items-center gap-1 rounded-md pr-2 text-left text-xs transition-colors",
										selectedPath === entry.path
											? "bg-muted text-foreground"
											: "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
									)}
								>
									{Array.from({ length: depth }).map((_, index) => (
										<span key={`${entry.path}-indent-${index}`} className="ml-3 h-full w-3 shrink-0 border-l border-border/40" />
									))}
									{entry.type === "directory" ? (
										<ChevronRightIcon className={cn("size-3 shrink-0 transition-transform", isOpen && "rotate-90")} aria-hidden="true" />
									) : (
										<span className="w-3 shrink-0" />
									)}
									{entry.type === "directory" ? (
										<FolderIcon className="size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
									) : (
										<Icon className={cn("size-3.5 shrink-0", iconClassName)} aria-hidden="true" />
									)}
									<span className="min-w-0 flex-1 truncate font-mono">{entry.name}</span>
									{gitCode ? (
										<span className={cn("shrink-0 font-mono text-[10px]", GIT_COLOR[gitCode])}>{gitCode}</span>
									) : folderDirty ? (
										<span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
									) : null}
									{loadingDirs.has(entry.path) && <Loader2Icon className="size-3 animate-spin text-muted-foreground" aria-hidden="true" />}
								</button>
							)
						})
					)}
				</div>
				<div className="min-h-0 overflow-auto p-4">
					{selectedEntry ? (
						<div className="flex min-h-full flex-col gap-4">
							<div>
								<p className="text-xs uppercase tracking-wide text-muted-foreground">Selected</p>
								<h4 className="mt-1 text-sm font-medium text-foreground">{selectedEntry.name}</h4>
								<p className="mt-1 break-all font-mono text-xs text-muted-foreground">{selectedEntry.path}</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button type="button" variant="outline" size="sm" onClick={() => openDiffFile(selectedEntry.path)} disabled={selectedEntry.type === "directory"}>
									Open in Changes
								</Button>
							</div>
							{selectedEntry.type === "directory" ? (
								<div className="rounded-lg border border-dashed border-border px-4 py-6 text-xs text-muted-foreground">
									Directory selected. Expand it in the tree or choose a file to preview.
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
							) : preview?.kind === "image" ? (
								<div className="grid min-h-[240px] place-items-center rounded-lg border border-border bg-muted/10 p-4">
									<div className="text-xs text-muted-foreground">Inline image preview ships in T12 viewer polish. Open in Changes for now.</div>
								</div>
							) : preview?.kind === "pdf" || preview?.kind === "office" ? (
								<div className="rounded-lg border border-border bg-muted/10 px-4 py-6 text-xs text-muted-foreground">
									Document preview is available through the Studio / Office lane. Use this tree to pick the file, then continue there.
								</div>
							) : preview?.kind === "binary" ? (
								<div className="rounded-lg border border-border bg-muted/10 px-4 py-6 text-xs text-muted-foreground">
									Binary file. Open it externally or inspect related diffs in Changes.
								</div>
							) : (
								<div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/10">
									<div className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
										Preview{preview?.kind === "text" && detectLanguage(selectedEntry.path) ? ` · ${detectLanguage(selectedEntry.path)}` : ""}
									</div>
									<pre className="min-h-[240px] overflow-auto p-3 text-xs leading-5 text-foreground">
										<code>{previewText}</code>
									</pre>
								</div>
							)}
						</div>
					) : (
						<div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
							Select a file to preview it inline or jump into Changes.
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
