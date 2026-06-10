import "../src/styles/globals.css"
import type { Preview } from "@storybook/react-vite"

const preview: Preview = {
	globalTypes: {
		theme: {
			description: "Color scheme",
			toolbar: {
				title: "Theme",
				icon: "mirror",
				items: [
					{ value: "light", title: "Light" },
					{ value: "dark", title: "Dark" },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: {
		theme: "light",
	},
	decorators: [
		(Story, context) => {
			// globals.css declares `@custom-variant dark (&:is(.dark *))`,
			// so the `dark` class must sit on an ancestor of the story root.
			// firefly-design tokens are dark-first at :root; light needs
			// [data-ch5-theme="light"] to flip the --ff-* palette.
			const isDark = context.globals.theme === "dark"
			const root = document.documentElement
			root.classList.toggle("dark", isDark)
			root.classList.toggle("light", !isDark)
			root.dataset.ch5Theme = isDark ? "dark" : "light"
			root.style.colorScheme = isDark ? "dark" : "light"
			return (
				<div className="bg-background text-foreground p-4">
					<Story />
				</div>
			)
		},
	],
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		layout: "centered",
	},
}

export default preview
