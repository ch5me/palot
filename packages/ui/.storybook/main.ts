import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Storybook for @ch5me/elf-ui — the base-ui (`@base-ui/react`) component library
// backported from the design system. Web-only; no react-native shims needed.
//
// Also scans apps/desktop workspace stories (dock-shell, surface-host regression
// tests) that need dockview-react and the surface-host registry. Those modules
// are resolved from the hoisted root node_modules without adding extra deps here.
const config: StorybookConfig = {
	stories: [
		"../src/**/*.stories.@(ts|tsx|mdx)",
		"../../../apps/desktop/src/renderer/**/*.stories.@(ts|tsx|mdx)",
	],
	addons: [
		getAbsolutePath("@storybook/addon-docs"),
		getAbsolutePath("@storybook/addon-links"),
		getAbsolutePath("@storybook/addon-a11y"),
	],
	framework: {
		name: getAbsolutePath("@storybook/react-vite"),
		options: {},
	},
	core: {
		disableTelemetry: true,
	},
	typescript: {
		reactDocgen: false,
	},
	viteFinal: async (base) => {
		const root = resolve(__dirname, "..")
		return {
			...base,
			plugins: [...(base.plugins ?? []), tailwindcss()],
			resolve: {
				...(base.resolve ?? {}),
				alias: {
					...(base.resolve?.alias ?? {}),
					// elf-ui imports its own subpaths via the package name
					// (e.g. "@ch5me/elf-ui/lib/utils"). Map to src so stories
					// resolve without a build step.
					"@ch5me/elf-ui": resolve(root, "src"),
				},
			},
		}
	},
}

export default config

function getAbsolutePath(value: string): string {
	return dirname(require.resolve(join(value, "package.json")))
}
