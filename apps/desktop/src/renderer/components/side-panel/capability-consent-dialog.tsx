/**
 * Firefly Plugin Marketplace — capability consent dialog (P3d UI)
 *
 * Shown at install time when an extension declares capabilities that need
 * explicit user consent (medium/high/critical risk, or unknown). Deny-by-default:
 * every capability starts un-checked; the user opts in per capability. The
 * approved set flows back to the install → grant store as `granted/user`.
 *
 * Data-only themes declare no capabilities, so this never appears for them; it
 * is the surface for capability-bearing (code) extensions.
 */

import { ShieldAlertIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@ch5me/ch5-ui-web"
import type { ConsentItem } from "../../lib/capability-consent"
import { defaultApprovedSelection } from "../../lib/capability-consent"

const RISK_STYLE: Record<ConsentItem["risk"], string> = {
	critical: "text-destructive border-destructive/40",
	high: "text-destructive border-destructive/30",
	medium: "text-amber-600 border-amber-500/30",
	low: "text-muted-foreground border-border",
}

export interface CapabilityConsentDialogProps {
	extensionName: string
	items: readonly ConsentItem[]
	/** Resolve with the approved capability tokens, or null on cancel. */
	onResolve: (approved: string[] | null) => void
}

export function CapabilityConsentDialog({ extensionName, items, onResolve }: CapabilityConsentDialogProps) {
	const [approved, setApproved] = useState<Set<string>>(() => new Set(defaultApprovedSelection()))

	function toggle(capability: string) {
		setApproved((prev) => {
			const next = new Set(prev)
			if (next.has(capability)) next.delete(capability)
			else next.add(capability)
			return next
		})
	}

	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 p-4" role="dialog" aria-modal="true">
			<div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-lg">
				<div className="flex items-center gap-2 border-b border-border px-4 py-3">
					<ShieldAlertIcon className="size-4 text-amber-600" aria-hidden="true" />
					<div className="min-w-0">
						<div className="text-sm font-medium text-foreground truncate">Review permissions</div>
						<div className="text-[11px] text-muted-foreground truncate">{extensionName}</div>
					</div>
				</div>

				<div className="max-h-64 overflow-auto px-4 py-3 space-y-1.5">
					<p className="text-[11px] text-muted-foreground">
						This extension requests the following capabilities. Grant only what you trust — nothing is
						granted by default.
					</p>
					<ul className="space-y-1.5">
						{items.map((item) => (
							<li
								key={item.capability}
								className={`flex items-start gap-2 rounded-md border bg-muted/10 px-2 py-1.5 ${RISK_STYLE[item.risk]}`}
							>
								<input
									type="checkbox"
									checked={approved.has(item.capability)}
									onChange={() => toggle(item.capability)}
									className="mt-0.5"
									aria-label={`Grant ${item.capability}`}
								/>
								<div className="min-w-0">
									<div className="font-mono text-[10px] text-foreground truncate">{item.capability}</div>
									<div className="text-[10px]">
										{item.description} · <span className="uppercase">{item.risk}</span>
									</div>
								</div>
							</li>
						))}
					</ul>
				</div>

				<div className="flex justify-end gap-2 border-t border-border px-4 py-2.5">
					<Button type="button" variant="ghost" size="sm" onClick={() => onResolve(null)}>
						Cancel
					</Button>
					<Button type="button" size="sm" onClick={() => onResolve([...approved])}>
						{approved.size > 0 ? `Grant ${approved.size} & install` : "Install without grants"}
					</Button>
				</div>
			</div>
		</div>
	)
}
