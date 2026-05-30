import type {
	Event,
	FileDiff,
	Message,
	OpenCodeProject,
	QuestionAnswer,
	Session,
	SessionStatus,
} from "../lib/types"

export type { Event, FileDiff, Message, OpenCodeProject, QuestionAnswer, Session, SessionStatus }

export interface GlobalEvent {
	directory: string
	payload: Event
}

export type { GlobalEvent as AgentBackendGlobalEvent }

export interface ListSessionsOptions {
	limit?: number
	roots?: boolean
	search?: string
}

export interface SendPromptOptions {
	providerID?: string
	modelID?: string
	agent?: string
	variant?: string
}

export type PermissionResponse = "once" | "always" | "reject"

export interface CommandInfo {
	name: string
	description?: string
}

/**
 * Backend contract for agent/session operations.
 *
 * This abstracts the transport and provider implementation so the UI can
 * target OpenCode or another backend with the same session-oriented surface.
 */
export interface AgentBackend {
	listProjects(): Promise<OpenCodeProject[]>
	listSessions(options?: ListSessionsOptions): Promise<Session[]>
	getSessionStatuses(): Promise<Record<string, SessionStatus>>
	createSession(title?: string): Promise<Session>
	sendPrompt(sessionId: string, text: string, options?: SendPromptOptions): Promise<void>
	abortSession(sessionId: string): Promise<void>
	renameSession(sessionId: string, title: string): Promise<void>
	deleteSession(sessionId: string): Promise<void>
	getSession(sessionId: string): Promise<Session | null>
	getSessionDiff(sessionId: string): Promise<FileDiff[]>
	respondToPermission(
		sessionId: string,
		permissionId: string,
		response: PermissionResponse,
	): Promise<void>
	replyToQuestion(requestId: string, answers: QuestionAnswer[]): Promise<void>
	rejectQuestion(requestId: string): Promise<void>
	disposeInstance(): Promise<void>
	disposeAllInstances(): Promise<void>
	subscribeToGlobalEvents(): Promise<AsyncIterable<GlobalEvent>>
	revertSession(sessionId: string, messageId: string): Promise<Session>
	unrevertSession(sessionId: string): Promise<Session>
	executeCommand(sessionId: string, command: string, args: string): Promise<void>
	listCommands(): Promise<CommandInfo[]>
	findFiles(query: string): Promise<string[]>
	forkSession(sessionId: string, messageId?: string): Promise<Session>
	summarizeSession(sessionId: string): Promise<void>
	getSessionMessages(sessionId: string): Promise<Message[]>
}
