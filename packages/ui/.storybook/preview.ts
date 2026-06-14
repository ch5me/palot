import type { Decorator, Preview } from "@storybook/react"
import "../src/styles/globals.css"

// Toggle the `.dark` class on <html> so elf-ui's `dark` custom-variant
// (`&:is(.dark *)`) and dark token block resolve correctly.
const withTheme: Decorator = (Story, context) => {
	const theme = (context.globals.theme as "light" | "dark") ?? "dark"
	if (typeof document !== "undefined") {
		const root = document.documentElement
		root.classList.toggle("dark", theme === "dark")
		root.style.colorScheme = theme
	}
	return Story()
}

const preview: Preview = {
	decorators: [withTheme],
	globalTypes: {
		theme: {
			description: "Theme",
			defaultValue: "dark",
			toolbar: {
				title: "Theme",
				icon: "circlehollow",
				items: [
					{ value: "light", title: "Light", icon: "sun" },
					{ value: "dark", title: "Dark", icon: "moon" },
				],
				dynamicTitle: true,
			},
		},
	},
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		layout: "centered",
		options: {
			storySort: {
				order: ["Primitives", "Components", "AI Elements", "Marketing", "*"],
			},
		},
	},
}

export default preview
