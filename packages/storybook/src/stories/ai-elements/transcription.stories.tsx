import {
	Transcription,
	TranscriptionSegment,
} from "@ch5me/elf-ui/components/ai-elements/transcription"
import type { Meta, StoryObj } from "@storybook/react-vite"

const segments = [
	{ startSecond: 0, endSecond: 2.4, text: "Inspect local component APIs." },
	{ startSecond: 2.4, endSecond: 5.8, text: "Skip imported package pass-throughs." },
	{ startSecond: 5.8, endSecond: 9.3, text: "Render Storybook proof before checking boxes." },
	{ startSecond: 9.3, endSecond: 12.1, text: "Save CH5 coverage evidence." },
]

const meta = {
	title: "AI Elements/Voice/Transcription",
	component: Transcription,
	render: () => (
		<div className="w-[620px] p-8">
			<div className="rounded-lg border bg-background p-4">
				<Transcription currentTime={6.4} onSeek={() => undefined} segments={segments}>
					{(segment, index) => (
						<TranscriptionSegment index={index} key={segment.startSecond} segment={segment} />
					)}
				</Transcription>
			</div>
		</div>
	),
} satisfies Meta<typeof Transcription>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		children: (segment, index) => (
			<TranscriptionSegment index={index} key={segment.startSecond} segment={segment} />
		),
		currentTime: 6.4,
		segments,
	},
}
