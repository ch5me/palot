import { describe, expect, test } from "bun:test"
import type { ChildSession, RuntimeEventPage } from "@ch5me/agent-runtime-contracts"
import {
	buildMetaSessionReviewModel,
	renderMetaSessionReviewEvent,
} from "./palot-meta-session-review"

const timestamp = "2026-06-17T12:00:00.000Z"

function buildChildSession(overrides: Partial<ChildSession> = {}): ChildSession {
	return {
		id: "opencode:ses_meta_child",
		parentSessionId: "meta_1",
		runtimeKind: "opencode",
		runtimeSessionId: "ses_meta_child",
		title: "OpenCode child",
		status: "idle",
		createdAt: timestamp,
		lastHeartbeatAt: timestamp,
		lastEventAt: timestamp,
		...overrides,
	}
}

describe("palot-meta-session-review", () => {
	test("child rows derive approval-needed state from shared contract events", () => {
		const child = buildChildSession()
		const eventPage: RuntimeEventPage = {
			events: [
				{
					type: "session.status",
					eventId: "evt_status",
					childSessionId: child.id,
					runtimeKind: child.runtimeKind,
					occurredAt: timestamp,
					status: "idle",
					runtimeStatus: "ready",
				},
				{
					type: "policy",
					eventId: "evt_policy",
					childSessionId: child.id,
					runtimeKind: child.runtimeKind,
					occurredAt: "2026-06-17T12:01:00.000Z",
					verdict: {
						mode: "ask",
						decision: "ask",
						reason: "send paused for operator approval",
						blockers: [],
					},
				},
			],
		}

		const model = buildMetaSessionReviewModel({
			children: [child],
			eventPagesByChildSessionId: {
				[child.id]: eventPage,
			},
		})

		expect(model.rows).toEqual([
			expect.objectContaining({
				childSessionId: child.id,
				reviewState: "needs-approval",
				summary: "send paused for operator approval",
			}),
		])
		expect(model.eventsByChildSessionId[child.id]?.[0]).toEqual(
			expect.objectContaining({
				label: "Needs approval",
				detail: "send paused for operator approval",
			}),
		)
	})

	test("approved policy events render granted permission detail", () => {
		const rendered = renderMetaSessionReviewEvent({
			type: "policy",
			eventId: "evt_policy_allow",
			childSessionId: "opencode:ses_meta_child",
			runtimeKind: "opencode",
			occurredAt: "2026-06-17T12:02:00.000Z",
			verdict: {
				mode: "enforce",
				decision: "allow",
				reason: "send approved for adapter dispatch",
				blockers: [],
				adapterDispatchPermission: {
					grantedAt: "2026-06-17T12:02:00.000Z",
					grantedBy: "approval_meta_123",
				},
			},
		})

		expect(rendered).toEqual(
			expect.objectContaining({
				label: "Approved",
				detail: "Granted by approval_meta_123",
				tone: "success",
			}),
		)
	})
})
