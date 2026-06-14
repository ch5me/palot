import {
	Context,
	ContextCacheUsage,
	ContextContent,
	ContextContentBody,
	ContextContentFooter,
	ContextContentHeader,
	ContextInputUsage,
	ContextOutputUsage,
	ContextReasoningUsage,
	ContextTrigger,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const usage = {
	inputTokens: 182_400,
	inputTokenDetails: {
		cacheReadTokens: 72_000,
		cacheWriteTokens: undefined,
		noCacheTokens: 110_400,
	},
	outputTokens: 12_800,
	outputTokenDetails: {
		reasoningTokens: 8_600,
		textTokens: 4_200,
	},
	reasoningTokens: 8_600,
	cachedInputTokens: 72_000,
	totalTokens: 203_800,
}

const meta = {
	title: "AI Elements/Status/Context",
	component: Context,
	render: () => (
		<div className="w-[420px] p-8">
			<Context
				defaultOpen
				maxTokens={262_144}
				modelId="openai/gpt-5-codex"
				usage={usage}
				usedTokens={203_800}
			>
				<ContextTrigger />
				<ContextContent>
					<ContextContentHeader />
					<ContextContentBody className="space-y-2">
						<ContextInputUsage />
						<ContextOutputUsage />
						<ContextReasoningUsage />
						<ContextCacheUsage />
					</ContextContentBody>
					<ContextContentFooter />
				</ContextContent>
			</Context>
		</div>
	),
} satisfies Meta<typeof Context>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		maxTokens: 262_144,
		usedTokens: 203_800,
		usage,
	},
}
