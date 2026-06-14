import {
	Badge,
	Button,
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemSeparator,
	ItemTitle,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { BotIcon, CheckCircle2Icon, GlobeIcon } from "lucide-react"

const meta = {
	title: "Foundations/Data Display/Item",
	component: Item,
	render: () => (
		<ItemGroup className="w-[520px]">
			<Item variant="outline">
				<ItemMedia variant="icon">
					<BotIcon aria-hidden="true" />
				</ItemMedia>
				<ItemContent>
					<ItemTitle>Coverage worker</ItemTitle>
					<ItemDescription>
						Creates local Storybook stories and updates tracker proof.
					</ItemDescription>
				</ItemContent>
				<ItemActions>
					<Badge variant="secondary">Running</Badge>
					<Button size="sm" variant="outline">
						Open
					</Button>
				</ItemActions>
			</Item>
			<ItemSeparator />
			<Item variant="muted" size="sm">
				<ItemMedia variant="icon">
					<GlobeIcon aria-hidden="true" />
				</ItemMedia>
				<ItemContent>
					<ItemTitle>Live iframe proof</ItemTitle>
					<ItemDescription>Desktop and mobile screenshots captured.</ItemDescription>
				</ItemContent>
				<ItemMedia variant="icon">
					<CheckCircle2Icon aria-hidden="true" />
				</ItemMedia>
			</Item>
		</ItemGroup>
	),
} satisfies Meta<typeof Item>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
