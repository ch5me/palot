import { Hono } from "hono"
import { cors } from "hono/cors"
import files from "./routes/files"
import health from "./routes/health"
import modelState from "./routes/model-state"
import servers from "./routes/servers"
import { ensureSingleServer } from "./services/server-manager"

// ============================================================
// App — CORS middleware applied first, then routes chained for RPC
// ============================================================

const app = new Hono()

// Middleware — applied via .use() before route chaining
app.use(
	"*",
	cors({
		origin: ["http://localhost:20883", "http://127.0.0.1:20883"],
	}),
)

// Routes — chained for Hono RPC type inference
const routes = app
	.route("/api/servers", servers)
	.route("/api/model-state", modelState)
	.route("/api/files", files)
	.route("/health", health)

export type AppType = typeof routes

// ============================================================
// Start
// ============================================================

const port = Number(process.env.PORT) || 30206

console.log(`Elf server starting on port ${port}`)

// Eagerly start the single OpenCode server in the background
ensureSingleServer()
	.then((server) => {
		console.log(`OpenCode server ready at ${server.url}`)
	})
	.catch((err) => {
		console.error("Failed to start OpenCode server on boot:", err)
	})

export default {
	port,
	fetch: app.fetch,
}
