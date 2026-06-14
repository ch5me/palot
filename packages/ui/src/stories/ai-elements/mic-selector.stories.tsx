import {
	MicSelector,
	MicSelectorContent,
	MicSelectorEmpty,
	MicSelectorInput,
	MicSelectorItem,
	MicSelectorLabel,
	MicSelectorList,
	MicSelectorTrigger,
	MicSelectorValue,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const devices = [
	{
		deviceId: "studio-array",
		groupId: "story",
		kind: "audioinput",
		label: "Studio Array (12ab:34cd)",
		toJSON: () => ({}),
	},
	{
		deviceId: "headset",
		groupId: "story",
		kind: "audioinput",
		label: "Operator Headset (98ef:7654)",
		toJSON: () => ({}),
	},
] satisfies MediaDeviceInfo[]

if (typeof navigator !== "undefined") {
	try {
		Object.defineProperty(navigator, "mediaDevices", {
			configurable: true,
			value: {
				addEventListener: () => undefined,
				enumerateDevices: async () => devices,
				getUserMedia: async () => new MediaStream(),
				removeEventListener: () => undefined,
			},
		})
	} catch {
		// Storybook may already provide a non-configurable mediaDevices object.
	}
}

const meta = {
	title: "AI Elements/Voice/MicSelector",
	component: MicSelector,
	render: () => (
		<div className="w-[360px] p-8">
			<MicSelector defaultOpen defaultValue="studio-array">
				<MicSelectorTrigger className="w-full">
					<MicSelectorValue />
				</MicSelectorTrigger>
				<MicSelectorContent>
					<MicSelectorInput />
					<MicSelectorList>
						{(availableDevices) =>
							availableDevices.map((device) => (
								<MicSelectorItem key={device.deviceId} value={device.deviceId}>
									<MicSelectorLabel device={device} />
								</MicSelectorItem>
							))
						}
					</MicSelectorList>
					<MicSelectorEmpty />
				</MicSelectorContent>
			</MicSelector>
		</div>
	),
} satisfies Meta<typeof MicSelector>

export default meta

type Story = StoryObj

export const Default: Story = {}
