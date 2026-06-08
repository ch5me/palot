import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { fireflySurfaceFlagAtoms } from "../atoms/feature-flags"

export interface FireflySurfaceFlags {
	review: boolean
	browserPanelEnabled: boolean
	notes: boolean
	pulse: boolean
	artifacts: boolean
	memory: boolean
	files: boolean
	terminal: boolean
	editor: boolean
	plugins: boolean
	bridges: boolean
	crm: boolean
	studio: boolean
	voice: boolean
	oracle: boolean
	claude: boolean
	ch5pm: boolean
	pdfReview: boolean
}

export interface FireflySurfaceFlagContext {
	flags: Readonly<FireflySurfaceFlags>
}

export function useFireflySurfaceContext(): FireflySurfaceFlagContext {
	const review = useAtomValue(fireflySurfaceFlagAtoms.review)
	const browser = useAtomValue(fireflySurfaceFlagAtoms.browser)
	const notes = useAtomValue(fireflySurfaceFlagAtoms.notes)
	const pulse = useAtomValue(fireflySurfaceFlagAtoms.pulse)
	const artifacts = useAtomValue(fireflySurfaceFlagAtoms.artifacts)
	const memory = useAtomValue(fireflySurfaceFlagAtoms.memory)
	const files = useAtomValue(fireflySurfaceFlagAtoms.files)
	const terminal = useAtomValue(fireflySurfaceFlagAtoms.terminal)
	const editor = useAtomValue(fireflySurfaceFlagAtoms.editor)
	const plugins = useAtomValue(fireflySurfaceFlagAtoms.plugins)
	const bridges = useAtomValue(fireflySurfaceFlagAtoms.bridges)
	const crm = useAtomValue(fireflySurfaceFlagAtoms.crm)
	const studio = useAtomValue(fireflySurfaceFlagAtoms.studio)
	const voice = useAtomValue(fireflySurfaceFlagAtoms.voice)
	const oracle = useAtomValue(fireflySurfaceFlagAtoms.oracle)
	const claude = useAtomValue(fireflySurfaceFlagAtoms.claude)
	const ch5pm = useAtomValue(fireflySurfaceFlagAtoms.ch5pm)
	const pdfReview = useAtomValue(fireflySurfaceFlagAtoms["pdf-review"])

	const flags = useMemo<FireflySurfaceFlags>(
		() => ({
			review,
			browserPanelEnabled: browser,
			notes,
			pulse,
			artifacts,
			memory,
			files,
			terminal,
			editor,
			plugins,
			bridges,
			crm,
			studio,
			voice,
			oracle,
			claude,
			ch5pm,
			pdfReview,
		}),
		[
			review,
			browser,
			notes,
			pulse,
			artifacts,
			memory,
			files,
			terminal,
			editor,
			plugins,
			bridges,
			crm,
			studio,
			voice,
			oracle,
			claude,
			ch5pm,
			pdfReview,
		],
	)

	return { flags }
}
