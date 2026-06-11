import type {
	McpCatalogBrowseInput,
	McpCatalogSearchInput,
	McpConnectionRegisterInput,
} from "@ch5me/mcp-runtime-shared"
import {
	browseCatalog,
	listMcpConnectionRecords,
	loginMcpConnection,
	registerMcpConnection,
	searchCatalog,
	testMcpConnection,
} from "../services/mcp-connections"
import { Hono } from "hono"
import { getMcpAuthSessionStatus, startMcpAuthSession } from "../services/mcp-auth-sessions"

const app = new Hono()
	.post("/catalog/browse", async (c) => {
		try {
			const input = await c.req.json<McpCatalogBrowseInput>()
			return c.json(await browseCatalog(input), 200)
		} catch (err) {
			return c.json(
				{ error: err instanceof Error ? err.message : "Failed to browse MCP catalog" },
				500,
			)
		}
	})
	.post("/catalog/search", async (c) => {
		try {
			const input = await c.req.json<McpCatalogSearchInput>()
			return c.json(await searchCatalog(input), 200)
		} catch (err) {
			return c.json(
				{ error: err instanceof Error ? err.message : "Failed to search MCP catalog" },
				500,
			)
		}
	})
	.post("/register", async (c) => {
		try {
			const input = await c.req.json<McpConnectionRegisterInput>()
			return c.json(await registerMcpConnection(input), 200)
		} catch (err) {
			return c.json(
				{ error: err instanceof Error ? err.message : "Failed to register MCP connection" },
				500,
			)
		}
	})
	.post("/login", async (c) => {
		try {
			const input = await c.req.json<{ name: string }>()
			return c.json(await loginMcpConnection(input.name), 200)
		} catch (err) {
			return c.json(
				{ error: err instanceof Error ? err.message : "Failed to start MCP login" },
				500,
			)
		}
	})
	.post("/auth/start", async (c) => {
		try {
			const input = await c.req.json<{ name: string }>()
			return c.json(await startMcpAuthSession(input.name), 200)
		} catch (err) {
			return c.json(
				{ error: err instanceof Error ? err.message : "Failed to start MCP auth session" },
				500,
			)
		}
	})
	.get("/auth/:name", async (c) => {
		try {
			return c.json(await getMcpAuthSessionStatus(c.req.param("name")), 200)
		} catch (err) {
			return c.json(
				{ error: err instanceof Error ? err.message : "Failed to read MCP auth session" },
				500,
			)
		}
	})
	.post("/test", async (c) => {
		try {
			const input = await c.req.json<{ name: string }>()
			return c.json(await testMcpConnection(input.name), 200)
		} catch (err) {
			return c.json(
				{ error: err instanceof Error ? err.message : "Failed to test MCP connection" },
				500,
			)
		}
	})
	.get("/records", async (c) => {
		try {
			return c.json(listMcpConnectionRecords(), 200)
		} catch (err) {
			return c.json(
				{ error: err instanceof Error ? err.message : "Failed to list MCP records" },
				500,
			)
		}
	})

export default app
