import { SpeechInput } from "@ch5me/elf-ui/components/ai-elements/speech-input"
import type { Meta, StoryObj } from "@storybook/react-vite"

class MockSpeechRecognition extends EventTarget {
	continuous = false
	interimResults = false
	lang = "en-US"
	onend = null
	onerror = null
	onresult = null
	onstart = null

	start() {
		this.dispatchEvent(new Event("start"))
	}

	stop() {
		this.dispatchEvent(new Event("end"))
	}
}

if (typeof window !== "undefined") {
	window.SpeechRecognition = MockSpeechRecognition
	window.webkitSpeechRecognition = MockSpeechRecognition
}

const meta = {
	title: "AI Elements/Voice/SpeechInput",
	component: SpeechInput,
	render: () => (
		<div className="flex items-center gap-4 p-8">
			<SpeechInput
				aria-label="Start dictation"
				onTranscriptionChange={() => undefined}
				size="icon"
			/>
			<div>
				<p className="font-medium text-sm">Dictation ready</p>
				<p className="text-muted-foreground text-xs">
					Speech recognition mode with local Storybook mock.
				</p>
			</div>
		</div>
	),
} satisfies Meta<typeof SpeechInput>

export default meta

type Story = StoryObj

export const Default: Story = {}
