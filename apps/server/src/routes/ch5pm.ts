import path from "node:path"
import { Hono } from "hono"

const app = new Hono()

const DEFAULT_PM_STATE_PATH = path.join(
	process.env.HOME ?? "",
	".local",
	"state",
	"ch5pm",
	"pm-state.json",
)

function resolvePmStatePath(): string {
	const override = process.env.CH5PM_STATE_PATH?.trim()
	if (override && override.length > 0) {
		return path.resolve(override)
	}
	return path.resolve(DEFAULT_PM_STATE_PATH)
}

const routes = app.get("/state", async (c) => {
	try {
		const file = Bun.file(resolvePmStatePath())
		if (!(await file.exists())) {
			return c.json(
				{ error: `CH5PM state file not found: ${resolvePmStatePath()}` },
				404,
			)
		}
		const payload = await file.json()
		return c.json(payload, 200)
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : "Failed to read CH5PM state" },
			500,
		)
	}
})

export default routes
