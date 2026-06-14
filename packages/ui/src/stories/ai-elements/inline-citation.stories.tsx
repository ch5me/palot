import {
	InlineCitation,
	InlineCitationCard,
	InlineCitationCardBody,
	InlineCitationCardTrigger,
	InlineCitationCarousel,
	InlineCitationCarouselContent,
	InlineCitationCarouselHeader,
	InlineCitationCarouselIndex,
	InlineCitationCarouselItem,
	InlineCitationCarouselNext,
	InlineCitationCarouselPrev,
	InlineCitationQuote,
	InlineCitationSource,
	InlineCitationText,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const sources = [
	"https://docs.example.com/ch5/storybook-coverage",
	"https://docs.example.com/ch5/component-scope",
]

const meta = {
	title: "AI Elements/Citations/InlineCitation",
	component: InlineCitation,
	render: () => (
		<div className="w-[720px] p-8 text-sm leading-7">
			<InlineCitation>
				<InlineCitationText>
					CH5 coverage treats local component files as the scan source, while imported package
					components are trusted to carry upstream stories.
				</InlineCitationText>
				<InlineCitationCard defaultOpen>
					<InlineCitationCardTrigger sources={sources} />
					<InlineCitationCardBody>
						<InlineCitationCarousel>
							<InlineCitationCarouselHeader>
								<InlineCitationCarouselPrev />
								<InlineCitationCarouselIndex />
								<InlineCitationCarouselNext />
							</InlineCitationCarouselHeader>
							<InlineCitationCarouselContent>
								<InlineCitationCarouselItem>
									<InlineCitationSource
										description="Defines the local-only scan scope and the documented exception path for pure pass-through wrappers."
										title="Storybook coverage tracker"
										url={sources[0]}
									/>
									<InlineCitationQuote>
										Check items only after Storybook render proof and CH5 coverage agree.
									</InlineCitationQuote>
								</InlineCitationCarouselItem>
								<InlineCitationCarouselItem>
									<InlineCitationSource
										description="Imported libraries keep their own story and test coverage in their owning package."
										title="Component scope rule"
										url={sources[1]}
									/>
									<InlineCitationQuote>
										Do not duplicate upstream component stories in Palot.
									</InlineCitationQuote>
								</InlineCitationCarouselItem>
							</InlineCitationCarouselContent>
						</InlineCitationCarousel>
					</InlineCitationCardBody>
				</InlineCitationCard>
			</InlineCitation>
		</div>
	),
} satisfies Meta<typeof InlineCitation>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
