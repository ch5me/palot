import { PricingCard, type PricingCardPlan } from "@ch5me/elf-ui/components/animate/pricing-card"
import type { Meta, StoryObj } from "@storybook/react-vite"

const plans: PricingCardPlan[] = [
	{
		id: "basic",
		name: "Basic",
		description: "For individuals",
		monthlyPrice: 9,
		yearlyPrice: 90,
		features: ["1 project", "Community support", "Basic analytics"],
	},
	{
		id: "pro",
		name: "Pro",
		description: "For small teams",
		monthlyPrice: 29,
		yearlyPrice: 290,
		features: ["Unlimited projects", "Priority support", "Advanced analytics", "Custom domains"],
	},
	{
		id: "scale",
		name: "Scale",
		description: "For growing companies",
		monthlyPrice: 79,
		yearlyPrice: 790,
		features: ["Everything in Pro", "SSO & audit logs", "Dedicated support", "99.9% uptime SLA"],
	},
]

const meta = {
	title: "Animate/PricingCard",
	component: PricingCard,
	args: {
		plans,
		title: "Select a plan",
		currency: "USD",
		yearlyBadge: "20% off",
		defaultBillingCycle: "monthly",
		defaultPlanId: "pro",
		showSeatSelector: true,
		seatLabel: "Seats",
		seatHint: "Billed per seat",
		minSeatCount: 1,
		defaultSeatCount: 3,
	},
	argTypes: {
		defaultBillingCycle: {
			control: "inline-radio",
			options: ["monthly", "yearly"],
		},
		currency: {
			control: "select",
			options: ["USD", "EUR", "GBP", "JPY"],
		},
		minSeatCount: { control: { type: "number", min: 1 } },
		defaultSeatCount: { control: { type: "number", min: 1 } },
		plans: { control: false },
		onBillingCycleChange: { control: false },
		onPlanChange: { control: false },
		onSeatCountChange: { control: false },
	},
} satisfies Meta<typeof PricingCard>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Configurations: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-wrap items-start gap-6">
			<PricingCard className="max-w-sm" plans={plans} />
			<PricingCard
				className="max-w-sm"
				plans={plans}
				title="Choose your plan"
				yearlyBadge="20% off"
				defaultBillingCycle="yearly"
				defaultPlanId="scale"
				showSeatSelector
				seatLabel="Members"
				seatHint="Billed per member"
				minSeatCount={2}
				defaultSeatCount={5}
			/>
		</div>
	),
}
