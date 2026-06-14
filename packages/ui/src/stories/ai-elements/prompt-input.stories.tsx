import {
	PromptInput,
	PromptInputBody,
	PromptInputButton,
	PromptInputFooter,
	PromptInputHeader,
	PromptInputProvider,
	PromptInputSelect,
	PromptInputSelectContent,
	PromptInputSelectItem,
	PromptInputSelectTrigger,
	PromptInputSelectValue,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@ch5me/elf-ui/components/ai-elements/prompt-input"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { BrainCircuitIcon, PaperclipIcon, SearchIcon, SparklesIcon } from "lucide-react"

const meta = {
	title: "AI Elements/Input/PromptInput",
	component: PromptInput,
	render: () => (
		<div className="w-[720px] p-6">
			<PromptInputProvider initialInput="Summarize the failing Storybook render and propose the smallest source fix.">
				<PromptInput onSubmit={() => undefined}>
					<PromptInputHeader>
						<PromptInputButton tooltip="Attach evidence">
							<PaperclipIcon className="size-4" />
						</PromptInputButton>
						<PromptInputButton tooltip="Search workspace">
							<SearchIcon className="size-4" />
						</PromptInputButton>
					</PromptInputHeader>
					<PromptInputBody>
						<PromptInputTextarea />
					</PromptInputBody>
					<PromptInputFooter>
						<PromptInputTools>
							<PromptInputSelect defaultValue="debug">
								<PromptInputSelectTrigger>
									<PromptInputSelectValue />
								</PromptInputSelectTrigger>
								<PromptInputSelectContent>
									<PromptInputSelectItem value="debug">
										<BrainCircuitIcon className="mr-2 size-4" />
										Debug
									</PromptInputSelectItem>
									<PromptInputSelectItem value="draft">
										<SparklesIcon className="mr-2 size-4" />
										Draft
									</PromptInputSelectItem>
								</PromptInputSelectContent>
							</PromptInputSelect>
						</PromptInputTools>
						<PromptInputSubmit status="ready" />
					</PromptInputFooter>
				</PromptInput>
			</PromptInputProvider>
		</div>
	),
} satisfies Meta<typeof PromptInput>

export default meta

type Story = StoryObj

export const Default: Story = {}
