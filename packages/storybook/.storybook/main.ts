import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import type { StorybookConfig } from "@storybook/react-vite"

const here = dirname(fileURLToPath(import.meta.url))
const uiRoot = resolve(here, "../../ui")

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx|mdx)"],
	addons: ["@storybook/addon-docs", "@storybook/addon-links", "@storybook/addon-a11y"],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	async viteFinal(config) {
		const { mergeConfig, searchForWorkspaceRoot } = await import("vite")
		return mergeConfig(config, {
			plugins: [tailwindcss()],
			resolve: {
				alias: [
					{
						find: /^@ch5me\/elf-ui\/(.*)$/,
						replacement: `${uiRoot}/src/$1`,
					},
					{
						find: "@ch5me/elf-ui",
						replacement: uiRoot,
					},
				],
			},
			server: {
				fs: {
					allow: [searchForWorkspaceRoot(process.cwd()), uiRoot],
				},
			},
		})
	},
}

export default config
