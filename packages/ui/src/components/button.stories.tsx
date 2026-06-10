import { Button } from "@ch5me/elf-ui/components/button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Plus } from "lucide-react"

const meta = {
	title: "Components/Button",
	component: Button,
	args: {
		children: "Button",
		variant: "default",
		size: "default",
		disabled: false,
	},
	argTypes: {
		variant: {
			control: "select",
			options: ["default", "outline", "secondary", "ghost", "destructive", "link"],
		},
		size: {
			control: "select",
			options: ["xs", "sm", "default", "lg", "icon-xs", "icon-sm", "icon", "icon-lg"],
		},
	},
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

const variants = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const
const sizes = ["xs", "sm", "default", "lg"] as const
const iconSizes = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const

export const Variants: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-col gap-2">
			{variants.map((variant) => (
				<div key={variant} className="flex items-center gap-2">
					{sizes.map((size) => (
						<Button key={size} variant={variant} size={size}>
							{variant}
						</Button>
					))}
					{iconSizes.map((size) => (
						<Button key={size} variant={variant} size={size} aria-label={`${variant} icon`}>
							<Plus />
						</Button>
					))}
					<Button variant={variant} size="sm" disabled>
						disabled
					</Button>
				</div>
			))}
		</div>
	),
}
