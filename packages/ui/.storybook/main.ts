import tailwindcss from "@tailwindcss/vite"
import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
	// Co-located stories next to their components.
	stories: ["../src/**/*.stories.tsx"],
	// Storybook 9: controls/toolbars/backgrounds live in core (no addon-essentials).
	addons: ["@storybook/addon-a11y"],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	core: {
		disableTelemetry: true,
	},
	typescript: {
		reactDocgen: false,
	},
	viteFinal: async (baseConfig) => {
		// Tailwind v4 compiles src/styles/globals.css (incl. the
		// @ch5me/firefly-design + shadcn @imports and the @source scan).
		baseConfig.plugins = [...(baseConfig.plugins ?? []), tailwindcss()]
		// packages/ui pins its own react copy while the workspace root hoists
		// another — without dedupe, Storybook's renderer and the components
		// load two Reacts and stories crash with a null `useRef`.
		baseConfig.resolve = {
			...(baseConfig.resolve ?? {}),
			dedupe: [...(baseConfig.resolve?.dedupe ?? []), "react", "react-dom"],
		}
		return baseConfig
	},
}

export default config
