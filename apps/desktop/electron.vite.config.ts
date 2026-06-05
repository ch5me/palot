import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import type { Plugin } from "vite"

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

const EFFECTS_SWARM_ENTRY = path.resolve(
	__dirname,
	"../../node_modules/@ch5me/effects/dist/particles/SwarmParticles/index.js",
)
const EFFECTS_GRADIENT_BRAND_TEXT_ENTRY = path.resolve(
	__dirname,
	"../../node_modules/@ch5me/effects/dist/text/GradientBrandText/GradientBrandText.js",
)
const MOTION_WEB_ENTRY = path.resolve(
	__dirname,
	"../../../ch5-packages/packages/motion/motion/src/index.web.ts",
)

export default defineConfig({
	main: {
		plugins: [
			externalizeDepsPlugin({ exclude: ["@ch5me/elf-configconv", "drizzle-orm"] }),
			copyDrizzleMigrations(),
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
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "src/renderer"),
				"@ch5me/effects/particles": EFFECTS_SWARM_ENTRY,
				"@ch5me/effects/text": EFFECTS_GRADIENT_BRAND_TEXT_ENTRY,
				"@ch5me/motion": MOTION_WEB_ENTRY,
				"@ch5me/elf-ui": path.resolve(__dirname, "../../packages/ui/src"),
				react: path.resolve(__dirname, "node_modules/react"),
				"react-dom": path.resolve(__dirname, "node_modules/react-dom"),
			},
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
