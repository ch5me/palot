import { PricingCard } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const plans = [
	{
		id: "solo",
		name: "Solo",
		description: "for local prototypes",
		monthlyPrice: 19,
		yearlyPrice: 190,
		features: ["One active workspace", "Local Storybook proof", "Manual coverage scans"],
	},
	{
		id: "team",
		name: "Team",
		description: "for shared component systems",
		monthlyPrice: 79,
		yearlyPrice: 790,
		features: ["Unlimited stories", "Desktop and mobile screenshots", "Coverage trend history"],
	},
]

const meta = {
	title: "Animate/Commerce/PricingCard",
	component: PricingCard,
	render: () => (
		<div className="w-[440px] p-6">
			<PricingCard
				title="Coverage plan"
				plans={plans}
				yearlyBadge="save 20%"
				defaultBillingCycle="yearly"
				defaultPlanId="team"
				showSeatSelector
				seatLabel="Reviewers"
				seatHint="included in screenshot review"
				defaultSeatCount={3}
			/>
		</div>
	),
} satisfies Meta<typeof PricingCard>

export default meta

type Story = StoryObj

export const Default: Story = {}
