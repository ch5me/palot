import type { SplitDockZone } from "./split-dock-protection"
import type { SplitDockPanelProtection } from "./split-dock-protection"

export const SPLIT_DOCK_DRAG_MIME = "application/x-palot-split-dock-panel"

export const SPLIT_DOCK_TRANSFER_POLICIES = ["move", "clone"] as const
export type SplitDockTransferPolicy = (typeof SPLIT_DOCK_TRANSFER_POLICIES)[number]

export interface SplitDockTransferDescriptor {
	id: string
	zone: SplitDockZone
	transferPolicies?: readonly SplitDockTransferPolicy[]
	protection?: SplitDockPanelProtection
}

export interface SplitDockDragPayload {
	version: 1
	panelId: string
	sourceZone: SplitDockZone
	policy: SplitDockTransferPolicy
}

export interface SplitDockTransferRequest {
	panelId: string
	sourceZone: SplitDockZone
	targetZone: SplitDockZone
	policy: SplitDockTransferPolicy
	targetPanelId?: string
	targetPosition?: "left" | "right" | "top" | "bottom"
}

export function createSplitDockDragPayload(
	descriptor: SplitDockTransferDescriptor,
	policy: SplitDockTransferPolicy = "move",
): SplitDockDragPayload | null {
	if (!supportsTransferPolicy(descriptor.transferPolicies, policy)) {
		return null
	}

	return {
		version: 1,
		panelId: descriptor.id,
		sourceZone: descriptor.zone,
		policy,
	}
}

export function serializeSplitDockDragPayload(payload: SplitDockDragPayload): string {
	return JSON.stringify(payload)
}

export function hasSplitDockDragMime(event: DragEvent | PointerEvent): boolean {
	return event instanceof DragEvent && Array.from(event.dataTransfer?.types ?? []).includes(SPLIT_DOCK_DRAG_MIME)
}

export function parseSplitDockDragPayload(raw: string): SplitDockDragPayload | null {
	try {
		const parsed = JSON.parse(raw) as Partial<SplitDockDragPayload>
		if (
			parsed.version !== 1 ||
			typeof parsed.panelId !== "string" ||
			!isSplitDockZone(parsed.sourceZone) ||
			!isSplitDockTransferPolicy(parsed.policy)
		) {
			return null
		}

		return {
			version: 1,
			panelId: parsed.panelId,
			sourceZone: parsed.sourceZone,
			policy: parsed.policy,
		}
	} catch {
		return null
	}
}

export function validateSplitDockTransferPayload({
	payload,
	targetZone,
	descriptorsById,
	targetPanelId,
	targetPosition,
}: {
	payload: SplitDockDragPayload
	targetZone: SplitDockZone
	descriptorsById: Map<string, SplitDockTransferDescriptor>
	targetPanelId?: string
	targetPosition?: "left" | "right" | "top" | "bottom"
}): SplitDockTransferRequest | null {
	const descriptor = descriptorsById.get(payload.panelId)
	if (!descriptor) {
		return null
	}

	if (descriptor.zone !== payload.sourceZone) {
		return null
	}

	if (!supportsTransferPolicy(descriptor.transferPolicies, payload.policy)) {
		return null
	}

	if (descriptor.protection?.requiredZone && descriptor.protection.requiredZone !== targetZone) {
		return null
	}

	if (payload.sourceZone === targetZone) {
		return null
	}

	return {
		panelId: payload.panelId,
		sourceZone: payload.sourceZone,
		targetZone,
		policy: payload.policy,
		targetPanelId,
		targetPosition,
	}
}

function supportsTransferPolicy(
	policies: readonly SplitDockTransferPolicy[] | undefined,
	policy: SplitDockTransferPolicy,
): boolean {
	const allowedPolicies = policies ?? ["move"]
	return allowedPolicies.includes(policy)
}

function isSplitDockZone(value: unknown): value is SplitDockZone {
	return value === "main" || value === "right" || value === "bottom"
}

function isSplitDockTransferPolicy(value: unknown): value is SplitDockTransferPolicy {
	return value === "move" || value === "clone"
}
