import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import type { StorybookConfig } from "@storybook/react-vite"

const here = dirname(fileURLToPath(import.meta.url))
const uiRoot = resolve(here, "../../ui")

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx|mdx)"],
	addons: [
		getAbsolutePath("@storybook/addon-docs"),
		getAbsolutePath("@storybook/addon-links"),
		getAbsolutePath("@storybook/addon-a11y"),
	],
	framework: {
		name: getAbsolutePath("@storybook/react-vite"),
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
				allowedHosts: ["storybook.elf.localhost"],
				fs: {
					allow: [searchForWorkspaceRoot(process.cwd()), uiRoot],
				},
			},
		})
	},
}

export default config

function getAbsolutePath(value: string): string {
	return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)))
}
