import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

function InputOTPPreview() {
	const [value, setValue] = useState("428901")

	return (
		<InputOTP maxLength={6} value={value} onChange={setValue}>
			<InputOTPGroup>
				<InputOTPSlot index={0} />
				<InputOTPSlot index={1} />
				<InputOTPSlot index={2} />
			</InputOTPGroup>
			<InputOTPSeparator />
			<InputOTPGroup>
				<InputOTPSlot index={3} />
				<InputOTPSlot index={4} />
				<InputOTPSlot index={5} />
			</InputOTPGroup>
		</InputOTP>
	)
}

const meta = {
	title: "Foundations/Forms/InputOTP",
	component: InputOTPPreview,
} satisfies Meta<typeof InputOTPPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
