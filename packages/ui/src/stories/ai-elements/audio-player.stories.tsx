import {
	AudioPlayer,
	AudioPlayerControlBar,
	AudioPlayerDurationDisplay,
	AudioPlayerElement,
	AudioPlayerMuteButton,
	AudioPlayerPlayButton,
	AudioPlayerSeekBackwardButton,
	AudioPlayerSeekForwardButton,
	AudioPlayerTimeDisplay,
	AudioPlayerTimeRange,
	AudioPlayerVolumeRange,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const silentAudio =
	"data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="

const meta = {
	title: "AI Elements/Voice/AudioPlayer",
	component: AudioPlayer,
	render: () => (
		<div className="w-[680px] rounded-lg border bg-card p-4">
			<AudioPlayer>
				<AudioPlayerElement src={silentAudio} />
				<AudioPlayerControlBar>
					<AudioPlayerPlayButton />
					<AudioPlayerSeekBackwardButton />
					<AudioPlayerSeekForwardButton />
					<AudioPlayerTimeDisplay />
					<AudioPlayerTimeRange className="min-w-48" />
					<AudioPlayerDurationDisplay />
					<AudioPlayerMuteButton />
					<AudioPlayerVolumeRange className="max-w-24" />
				</AudioPlayerControlBar>
			</AudioPlayer>
		</div>
	),
} satisfies Meta<typeof AudioPlayer>

export default meta

type Story = StoryObj

export const Default: Story = {}
