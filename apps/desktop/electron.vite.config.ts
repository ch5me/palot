import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import type { Plugin } from "vite"

const ROOT_NODE_MODULES = path.resolve(__dirname, "../../node_modules")
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

/**
 * Copies the drizzle migrations directory into the main process output.
 *
 * viteStaticCopy does not reliably fire during electron-vite's dev rebuilds,
 * so we use a plain Rollup writeBundle hook instead.
 */
function copyDrizzleMigrations(): Plugin {
	const src = path.resolve(__dirname, "drizzle")
	return {
		name: "copy-drizzle-migrations",
		writeBundle(options) {
			const dest = path.join(options.dir!, "drizzle")
			if (fs.existsSync(src)) {
				fs.cpSync(src, dest, { recursive: true })
			}
		},
	}
}

/**
 * Copies the firefly surface-registry id sidecar into the main process
 * output's sibling `renderer/` dir.
 *
 * The main process reads `out/renderer/firefly-surface-registry-ids.json`
 * at boot, but in dev the renderer is served from the vite dev server and
 * never written to `out/renderer/`, so the file would be missing (ENOENT
 * crash on cold boot). Like copyDrizzleMigrations, a writeBundle hook is
 * used because viteStaticCopy does not reliably fire on dev rebuilds.
 */
function copySurfaceRegistryIds(): Plugin {
	const src = path.resolve(__dirname, "src/renderer/firefly-surface-registry-ids.json")
	return {
		name: "copy-surface-registry-ids",
		writeBundle(options) {
			const destDir = path.join(options.dir!, "..", "renderer")
			if (fs.existsSync(src)) {
				fs.mkdirSync(destDir, { recursive: true })
				fs.cpSync(src, path.join(destDir, "firefly-surface-registry-ids.json"))
			}
		},
	}
}

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

export default defineConfig({
	main: {
		plugins: [
			externalizeDepsPlugin({ exclude: ["@ch5me/elf-configconv", "drizzle-orm"] }),
			copyDrizzleMigrations(),
			copySurfaceRegistryIds(),
		],
		build: {
			rollupOptions: {
				input: { index: path.resolve(__dirname, "src/main/index.ts") },
			},
		},
	},
	preload: {
		// No externalizeDepsPlugin — sandboxed preloads must bundle all deps.
		// Output CJS because Electron sandboxed preloads cannot use ESM.
		build: {
			rollupOptions: {
				input: { index: path.resolve(__dirname, "src/preload/index.ts") },
				output: {
					format: "cjs",
				},
			},
		},
	},
	renderer: {
		root: path.resolve(__dirname, "src/renderer"),
		plugins: [react(), tailwindcss()],
		optimizeDeps: {
			include: ["@react-spring/core", "@react-spring/shared", "@react-spring/web"],
			esbuildOptions: {
				preserveSymlinks: true,
			},
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "src/renderer"),
				"@ch5me/effects/particles": EFFECTS_SWARM_ENTRY,
				"@ch5me/effects/text": EFFECTS_GRADIENT_BRAND_TEXT_ENTRY,
				"@ch5me/motion": MOTION_WEB_ENTRY,
				"@ch5me/workspace": WORKSPACE_ENTRY,
				"@ch5me/elf-ui": path.resolve(__dirname, "../../packages/ui/src"),
				"@react-spring/core": REACT_SPRING_CORE_ENTRY,
				"@react-spring/shared": REACT_SPRING_SHARED_ENTRY,
				"@react-spring/web": REACT_SPRING_WEB_ENTRY,
				react: REACT_NODE_MODULES,
				"react-dom": REACT_DOM_NODE_MODULES,
			},
			preserveSymlinks: true,
		},
		worker: {
			format: "es",
		},
		server: {
			port: 1420,
			strictPort: true,
		},
		build: {
			rollupOptions: {
				input: { index: path.resolve(__dirname, "src/renderer/index.html") },
			},
		},
	},
})
