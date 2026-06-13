import "../../ui/src/styles/globals.css"

import type { Preview } from "@storybook/react-vite"

const preview: Preview = {
	parameters: {
		layout: "centered",
		actions: {
			argTypesRegex: "^on.*",
		},
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		backgrounds: {
			default: "canvas",
			values: [
				{ name: "canvas", value: "hsl(38 33% 98%)" },
				{ name: "charcoal", value: "hsl(0 0% 6%)" },
			],
		},
	},
	globalTypes: {
		theme: {
			name: "Theme",
			description: "Preview theme",
			defaultValue: "light",
			toolbar: {
				icon: "mirror",
				items: [
					{ value: "light", title: "Light" },
					{ value: "dark", title: "Dark" },
				],
				dynamicTitle: true,
			},
		},
	},
	decorators: [
		(Story, context) => {
			const theme = context.globals.theme === "dark" ? "dark" : "light"
			return (
				<div className={theme}>
					<div className="min-h-screen bg-background text-foreground p-8">
						<Story />
					</div>
				</div>
			)
		},
	],
}

export default preview
