import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app"
import { runFireflyPluginFlagMigrations } from "./firefly-plugin-flag-migration"
import "./index.css"

// One-time legacy surface-flag → plugin-lifecycle migration (idempotent).
void runFireflyPluginFlagMigrations()

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
