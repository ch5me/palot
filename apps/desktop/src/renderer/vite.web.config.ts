/**
 * Standalone Vite config for browser-mode development (no Electron).
 * Usage: bun run dev:web (or `vite --config src/renderer/vite.web.config.ts`)
 *
 * In this mode, the Elf Bun server (apps/server) must be running
 * on port 30206 to handle filesystem operations and process management.
 * Randomized high port to avoid conflicts with other projects.
 */

import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const ROOT_NODE_MODULES = path.resolve(__dirname, "../../../../node_modules")
const EFFECTS_SWARM_ENTRY = path.resolve(
	ROOT_NODE_MODULES,
	"@ch5me/effects/dist/particles/SwarmParticles/index.js",
)
const EFFECTS_GRADIENT_BRAND_TEXT_ENTRY = path.resolve(
	ROOT_NODE_MODULES,
	"@ch5me/effects/dist/text/GradientBrandText/GradientBrandText.js",
)
const MOTION_WEB_ENTRY = path.resolve(ROOT_NODE_MODULES, "@ch5me/motion/dist/index.web.js")
const WORKSPACE_ENTRY = path.resolve(ROOT_NODE_MODULES, "@ch5me/workspace/dist/index.js")
const REACT_NODE_MODULES = path.resolve(ROOT_NODE_MODULES, "react")
const REACT_DOM_NODE_MODULES = path.resolve(ROOT_NODE_MODULES, "react-dom")
const REACT_SPRING_CORE_ENTRY = path.resolve(
	ROOT_NODE_MODULES,
	"@react-spring/core/dist/react-spring_core.modern.mjs",
)
const REACT_SPRING_SHARED_ENTRY = path.resolve(
	ROOT_NODE_MODULES,
	"@react-spring/shared/dist/react-spring_shared.modern.mjs",
)
const REACT_SPRING_WEB_ENTRY = path.resolve(
	ROOT_NODE_MODULES,
	"@react-spring/web/dist/react-spring_web.modern.mjs",
)

export default defineConfig({
	root: __dirname,
	plugins: [react(), tailwindcss()],
	resolve: {
		preserveSymlinks: true,
		alias: {
			"@": __dirname,
			"@ch5me/effects/particles": EFFECTS_SWARM_ENTRY,
			"@ch5me/effects/text": EFFECTS_GRADIENT_BRAND_TEXT_ENTRY,
			"@ch5me/motion": MOTION_WEB_ENTRY,
			"@ch5me/workspace": WORKSPACE_ENTRY,
			"@ch5me/ch5-ui-web/animate/discrete-tabs": path.resolve(
				__dirname,
				"../../../../../ch5-packages/packages/web/ch5-ui-web/src/animate/discrete-tabs.tsx",
			),
			"@ch5me/elf-ui": path.resolve(__dirname, "../../../../packages/ui/src"),
			"@ch5me/elf-server/client": path.resolve(__dirname, "../../../server/src/client.ts"),
			"@react-spring/core": REACT_SPRING_CORE_ENTRY,
			"@react-spring/shared": REACT_SPRING_SHARED_ENTRY,
			"@react-spring/web": REACT_SPRING_WEB_ENTRY,
			react: REACT_NODE_MODULES,
			"react-dom": REACT_DOM_NODE_MODULES,
		},
	},
	optimizeDeps: {
		include: ["@react-spring/core", "@react-spring/shared", "@react-spring/web"],
		esbuildOptions: {
			preserveSymlinks: true,
		},
	},
	clearScreen: false,
	server: {
		port: Number(process.env.PORT) || 20883,
		strictPort: true,
		host: "127.0.0.1",
		fs: {
			allow: [
				path.resolve(__dirname, "../../../../.."),
				path.resolve(__dirname, "../../../../../ch5-packages"),
			],
		},
	},
})

