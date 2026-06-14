import { Toaster } from "@ch5me/elf-ui/components/sonner"
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
	tags: ["autodocs"],
} satisfies Meta<typeof SonnerPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
