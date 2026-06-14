import { Toaster } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect } from "react"
import { toast } from "sonner"

function SonnerPreview() {
	useEffect(() => {
		toast.success("Storybook proof captured", {
			description: "CH5 coverage can map this local Toaster wrapper.",
			duration: Number.POSITIVE_INFINITY,
			id: "storybook-proof",
		})

		return () => {
			toast.dismiss("storybook-proof")
		}
	}, [])

	return (
		<div className="min-h-[220px] w-[420px] rounded-lg border bg-card p-6 text-sm text-card-foreground">
			Toast surface mounted.
			<Toaster position="top-center" />
		</div>
	)
}

const meta = {
	title: "Foundations/Feedback/Sonner",
	component: SonnerPreview,
} satisfies Meta<typeof SonnerPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
