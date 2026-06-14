import { Button, Input, Textarea } from "@ch5me/ch5-ui-web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
	AlertTriangleIcon,
	AtSignIcon,
	Loader2Icon,
	MailIcon,
	PhoneIcon,
	PlusIcon,
	RefreshCwIcon,
	SaveIcon,
	SendIcon,
	Trash2Icon,
	UserIcon,
	UsersIcon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import type { Agent } from "../../lib/types"
import {
	deleteCrmContact,
	fetchCrmStore,
	fetchInboxThread,
	listInboxCustomers,
	saveCrmContact,
	sendInboxMessage,
	type InboxMessage,
} from "../../services/backend"
import type { CrmContact, Customer } from "../../../preload/api"

interface CrmPanelProps {
	agent: Agent
	className?: string
}

const CHANNEL_OPTIONS: Array<{ value: CrmContact["channel"]; label: string }> = [
	{ value: "email", label: "Email" },
	{ value: "whatsapp", label: "WhatsApp" },
	{ value: "instagram", label: "Instagram" },
	{ value: "telegram", label: "Telegram" },
	{ value: "phone", label: "Phone" },
	{ value: "referral", label: "Referral" },
	{ value: "other", label: "Other" },
]

function useCrmStore() {
	return useQuery({
		queryKey: ["crm-panel-store"],
		queryFn: fetchCrmStore,
		staleTime: 5_000,
		refetchInterval: 10_000,
	})
}

function useCustomers() {
	return useQuery({
		queryKey: ["crm-panel-customers"],
		queryFn: listInboxCustomers,
		staleTime: 5_000,
		refetchInterval: 10_000,
	})
}

function useThread(handle: string, enabled: boolean) {
	return useQuery({
		queryKey: ["crm-panel-thread", handle],
		queryFn: () => fetchInboxThread(handle, 200),
		enabled,
		staleTime: 3_000,
		refetchInterval: enabled ? 8_000 : false,
	})
}

function channelIcon(channel?: CrmContact["channel"]) {
	switch (channel) {
		case "email":
			return <MailIcon className="size-3.5 text-sky-500" aria-hidden="true" />
		case "phone":
			return <PhoneIcon className="size-3.5 text-emerald-500" aria-hidden="true" />
		case "instagram":
		case "telegram":
		case "whatsapp":
			return <AtSignIcon className="size-3.5 text-foreground" aria-hidden="true" />
		default:
			return <UserIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
	}
}

function isElectronMode(): boolean {
	return typeof window !== "undefined" && "elf" in window
}

export function CrmPanel({ agent, className }: CrmPanelProps) {
	const queryClient = useQueryClient()
	const store = useCrmStore()
	const customers = useCustomers()
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [editing, setEditing] = useState<Partial<CrmContact> | null>(null)
	const [draft, setDraft] = useState("")
	const [sending, setSending] = useState(false)

	const contacts = store.data?.contacts ?? []
	const sortedContacts = useMemo(
		() => [...contacts].sort((a, b) => b.createdAt - a.createdAt),
		[contacts],
	)
	const selected = useMemo(
		() => contacts.find((c) => c.id === selectedId) ?? null,
		[contacts, selectedId],
	)
	const selectedCustomer: Customer | null = useMemo(() => {
		if (!selected) return null
		return (
			customers.data?.find((customer) => customer.id === selected.id) ??
			({
				id: selected.id,
				name: selected.name,
				channel: "other",
				handle: selected.email ?? selected.phone ?? selected.id,
				lastAt: null,
				lastAgo: null,
				lastText: "",
				msgCount: 0,
			} satisfies Customer)
		)
	}, [selected, customers.data])

	const threadQuery = useThread(selectedCustomer?.handle ?? "", Boolean(selectedCustomer))

	useEffect(() => {
		if (!selectedId && sortedContacts.length > 0) {
			setSelectedId(sortedContacts[0].id)
		}
	}, [selectedId, sortedContacts])

	const saveMutation = useMutation({
		mutationFn: (contact: Partial<CrmContact>) => saveCrmContact(contact),
		onSuccess: (id) => {
			toast.success(editing?.id ? "Contact updated" : "Contact added")
			setSelectedId(id)
			setEditing(null)
			void queryClient.invalidateQueries({ queryKey: ["crm-panel-store"] })
			void queryClient.invalidateQueries({ queryKey: ["crm-panel-customers"] })
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to save contact")
		},
	})

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteCrmContact(id),
		onSuccess: () => {
			toast.success("Contact deleted")
			setSelectedId(null)
			setEditing(null)
			void queryClient.invalidateQueries({ queryKey: ["crm-panel-store"] })
			void queryClient.invalidateQueries({ queryKey: ["crm-panel-customers"] })
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to delete contact")
		},
	})

	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: ["crm-panel-store"] })
		void queryClient.invalidateQueries({ queryKey: ["crm-panel-customers"] })
	}

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!editing) return
		saveMutation.mutate(editing)
	}

	const handleSend = async () => {
		if (!selectedCustomer || !draft.trim()) return
		setSending(true)
		try {
			const result = await sendInboxMessage(
				selectedCustomer.channel,
				selectedCustomer.handle,
				draft.trim(),
			)
			toast.message(result.reason, {
				description: "Saved as draft — no live connector attached.",
			})
			setDraft("")
			void queryClient.invalidateQueries({ queryKey: ["crm-panel-thread", selectedCustomer.handle] })
			void queryClient.invalidateQueries({ queryKey: ["crm-panel-customers"] })
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to send message")
		} finally {
			setSending(false)
		}
	}

	const handleDelete = (contact: CrmContact) => {
		if (window.confirm(`Delete ${contact.name}?`)) {
			deleteMutation.mutate(contact.id)
		}
	}

	const startNewContact = () => {
		setEditing({ name: "", email: "", channel: "email" })
		setSelectedId(null)
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="flex items-center gap-2">
							<UsersIcon className="size-4 text-foreground" aria-hidden="true" />
							<h3 className="text-sm font-medium text-foreground">Contacts / CRM</h3>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							People, threads, and draft dispatch around {agent.project}.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button type="button" variant="outline" size="sm" onClick={refresh}>
							<RefreshCwIcon className="size-4" aria-hidden="true" />
							Refresh
						</Button>
						<Button type="button" variant="outline" size="sm" onClick={startNewContact}>
							<PlusIcon className="size-4" aria-hidden="true" />
							New
						</Button>
					</div>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				{store.isError ? (
					<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
						<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						<span>
							{store.error instanceof Error ? store.error.message : "Failed to load contacts"}
						</span>
					</div>
				) : null}
				{!isElectronMode() ? (
					<div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
						CRM data is only available in the desktop runtime. The HTTP bridge does not
						expose the crm/inbox seams.
					</div>
				) : null}
				{editing ? (
					<form
						className="space-y-2 rounded-lg border border-border bg-muted/10 p-3"
						onSubmit={handleSubmit}
					>
						<div className="text-xs font-medium text-foreground">
							{editing.id ? `Edit ${editing.name}` : "Add contact"}
						</div>
						<Input
							value={editing.name ?? ""}
							onChange={(event) =>
								setEditing((current: Partial<CrmContact> | null) => ({ ...(current ?? {}), name: event.target.value }))
							}
							placeholder="Full name"
							className="h-8"
							autoFocus
						/>
						<Input
							value={editing.email ?? ""}
							onChange={(event) =>
								setEditing((current: Partial<CrmContact> | null) => ({ ...(current ?? {}), email: event.target.value }))
							}
							placeholder="email (optional)"
							className="h-8"
						/>
						<Input
							value={editing.phone ?? ""}
							onChange={(event) =>
								setEditing((current: Partial<CrmContact> | null) => ({ ...(current ?? {}), phone: event.target.value }))
							}
							placeholder="phone (optional)"
							className="h-8"
						/>
						<select
							value={editing.channel ?? "other"}
							onChange={(event) =>
								setEditing((current: Partial<CrmContact> | null) => ({
									...(current ?? {}),
									channel: event.target.value as CrmContact["channel"],
								}))
							}
							className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none"
						>
							{CHANNEL_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						<Input
							value={editing.notes ?? ""}
							onChange={(event) =>
								setEditing((current: Partial<CrmContact> | null) => ({ ...(current ?? {}), notes: event.target.value }))
							}
							placeholder="Notes"
							className="h-8"
						/>
						<Input
							value={editing.tags?.join(", ") ?? ""}
							onChange={(event) =>
								setEditing((current: Partial<CrmContact> | null) => ({
									...(current ?? {}),
									tags: event.target.value
										.split(",")
										.map((tag) => tag.trim())
										.filter(Boolean),
								}))
							}
							placeholder="tags (comma separated)"
							className="h-8"
						/>
						<div className="flex items-center justify-end gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setEditing(null)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="outline"
								size="sm"
								disabled={saveMutation.isPending || !editing.name?.trim()}
							>
								<SaveIcon className="size-3.5" aria-hidden="true" />
								{saveMutation.isPending ? "Saving..." : "Save"}
							</Button>
						</div>
					</form>
				) : null}
				<section className="space-y-2">
					<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Contacts ({contacts.length})
					</h4>
					{sortedContacts.length === 0 ? (
						<div className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
							No contacts yet. Add one to start threading.
						</div>
					) : (
						<div className="space-y-1.5">
							{sortedContacts.map((contact) => (
								<button
									key={contact.id}
									type="button"
									onClick={() => {
										setSelectedId(contact.id)
										setEditing(null)
									}}
									className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
										selectedId === contact.id
											? "border-foreground/30 bg-muted"
											: "border-border bg-muted/10 hover:bg-muted/30"
									}`}
								>
									<div className="flex min-w-0 flex-1 items-center gap-2">
										{channelIcon(contact.channel)}
										<div className="min-w-0 flex-1">
											<div className="truncate text-xs font-medium text-foreground">
												{contact.name}
											</div>
											<div className="truncate text-[10px] text-muted-foreground">
												{contact.email ?? contact.phone ?? contact.channel ?? "—"}
											</div>
										</div>
									</div>
									<div className="flex items-center gap-1">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={(event) => {
												event.stopPropagation()
												setEditing(contact)
											}}
										>
											Edit
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={(event) => {
												event.stopPropagation()
												handleDelete(contact)
											}}
										>
											<Trash2Icon className="size-3.5" aria-hidden="true" />
										</Button>
									</div>
								</button>
							))}
						</div>
					)}
				</section>
				{selected && selectedCustomer ? (
					<section className="space-y-2">
						<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Thread — {selectedCustomer.name} ({selectedCustomer.channel})
						</h4>
						<div className="rounded-md border border-border bg-background p-3">
							{threadQuery.isLoading ? (
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
									Loading thread...
								</div>
							) : threadQuery.isError ? (
								<div className="text-xs text-destructive">
									{threadQuery.error instanceof Error
										? threadQuery.error.message
										: "Failed to load thread"}
								</div>
							) : (threadQuery.data?.length ?? 0) === 0 ? (
								<div className="text-xs text-muted-foreground">
									No messages yet. Send a draft to start the thread.
								</div>
							) : (
								<div className="space-y-2">
									{threadQuery.data?.map((message) => (
										<ThreadBubble key={message.ts + message.text} message={message} />
									))}
								</div>
							)}
						</div>
						<form
							className="space-y-2"
							onSubmit={(event) => {
								event.preventDefault()
								void handleSend()
							}}
						>
							<Textarea
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								placeholder="Draft a message (no live connector attached)"
								className="min-h-[80px] resize-none"
							/>
							<div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
								<span>Sends save as drafts only — no live {selectedCustomer.channel} connector.</span>
								<Button
									type="submit"
									variant="outline"
									size="sm"
									disabled={!draft.trim() || sending}
								>
									<SendIcon className="size-3.5" aria-hidden="true" />
									{sending ? "Sending..." : "Send draft"}
								</Button>
							</div>
						</form>
					</section>
				) : null}
			</div>
		</div>
	)
}

function ThreadBubble({ message }: { message: InboxMessage }) {
	const outbound = message.direction === "out"
	return (
		<div
			className={`max-w-[92%] rounded-lg border px-2.5 py-2 text-xs ${
				outbound
					? "ml-auto border-sky-500/20 bg-sky-500/5"
					: "mr-auto border-border bg-muted/30"
			}`}
		>
			<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
				<span className="font-medium text-foreground">
					{outbound ? "You" : "Customer"}
				</span>
				<span className="ml-auto">{message.ts}</span>
				{message.tsAgo ? <span>· {message.tsAgo}</span> : null}
			</div>
			<p className="mt-1 leading-relaxed text-foreground">{message.text}</p>
		</div>
	)
}
