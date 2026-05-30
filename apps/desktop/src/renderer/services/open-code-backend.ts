import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"

import type {
	AgentBackend,
	AgentBackendGlobalEvent,
	CommandInfo,
	ListSessionsOptions,
	Message,
	PermissionResponse,
	QuestionAnswer,
	SendPromptOptions,
} from "./agent-backend"
import {
	abortSession,
	connectToServer,
	createSession,
	deleteSession,
	disposeAllInstances,
	disposeInstance,
	executeCommand,
	findFiles,
	forkSession,
	getSession,
	getSessionDiff,
	getSessionMessages,
	getSessionStatuses,
	listCommands,
	listProjects,
	listSessions,
	rejectQuestion,
	renameSession,
	replyToQuestion,
	respondToPermission,
	revertSession,
	sendPrompt,
	subscribeToGlobalEvents,
	summarizeSession,
	unrevertSession,
} from "./opencode"

export interface OpenCodeBackendOptions {
	baseUrl: string
	directory?: string
	authHeader?: string
	client?: OpencodeClient
}

class OpenCodeBackend implements AgentBackend {
	readonly client: OpencodeClient

	constructor(clientOrOptions: OpencodeClient | OpenCodeBackendOptions) {
		this.client = isOpencodeClient(clientOrOptions)
			? clientOrOptions
			: clientOrOptions.client ??
				connectToServer(clientOrOptions.baseUrl, {
					directory: clientOrOptions.directory,
					authHeader: clientOrOptions.authHeader,
				})
	}

	listProjects() {
		return listProjects(this.client)
	}

	listSessions(options?: ListSessionsOptions) {
		return listSessions(this.client, options)
	}

	getSessionStatuses() {
		return getSessionStatuses(this.client)
	}

	createSession(title?: string) {
		return createSession(this.client, title)
	}

	sendPrompt(sessionId: string, text: string, options?: SendPromptOptions) {
		return sendPrompt(this.client, sessionId, text, options)
	}

	abortSession(sessionId: string) {
		return abortSession(this.client, sessionId)
	}

	renameSession(sessionId: string, title: string) {
		return renameSession(this.client, sessionId, title)
	}

	deleteSession(sessionId: string) {
		return deleteSession(this.client, sessionId)
	}

	getSession(sessionId: string) {
		return getSession(this.client, sessionId)
	}

	getSessionDiff(sessionId: string) {
		return getSessionDiff(this.client, sessionId)
	}

	respondToPermission(
		sessionId: string,
		permissionId: string,
		response: PermissionResponse,
	) {
		return respondToPermission(this.client, sessionId, permissionId, response)
	}

	replyToQuestion(requestId: string, answers: QuestionAnswer[]) {
		return replyToQuestion(this.client, requestId, answers)
	}

	rejectQuestion(requestId: string) {
		return rejectQuestion(this.client, requestId)
	}

	disposeInstance() {
		return disposeInstance(this.client)
	}

	disposeAllInstances() {
		return disposeAllInstances(this.client)
	}

	subscribeToGlobalEvents(): Promise<AsyncIterable<AgentBackendGlobalEvent>> {
		return subscribeToGlobalEvents(this.client)
	}

	revertSession(sessionId: string, messageId: string) {
		return revertSession(this.client, sessionId, messageId)
	}

	unrevertSession(sessionId: string) {
		return unrevertSession(this.client, sessionId)
	}

	executeCommand(sessionId: string, command: string, args: string) {
		return executeCommand(this.client, sessionId, command, args)
	}

	listCommands(): Promise<CommandInfo[]> {
		return listCommands(this.client)
	}

	findFiles(query: string) {
		return findFiles(this.client, query)
	}

	forkSession(sessionId: string, messageId?: string) {
		return forkSession(this.client, sessionId, messageId)
	}

	summarizeSession(sessionId: string) {
		return summarizeSession(this.client, sessionId)
	}

	async getSessionMessages(sessionId: string): Promise<Message[]> {
		const messages = await getSessionMessages(this.client, sessionId)
		return messages as unknown as Message[]
	}
}

function isOpencodeClient(value: OpencodeClient | OpenCodeBackendOptions): value is OpencodeClient {
	return "app" in value
}

export default OpenCodeBackend
