import {
	AnimatedCollection,
	AnimatedCollectionCaption,
	AnimatedCollectionItem,
	AnimatedCollectionItemContent,
	AnimatedCollectionItemMedia,
	AnimatedCollectionList,
	AnimatedCollectionViewToggle,
	type AnimatedCollectionView,
} from "@ch5me/elf-ui/components/animate/animated-collection"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Grid2X2Icon, Layers3Icon, ListIcon } from "lucide-react"
import { useState } from "react"

const tile = (from: string, to: string, label: string) =>
	`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 360'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='${from.replace("#", "%23")}'/%3E%3Cstop offset='1' stop-color='${to.replace("#", "%23")}'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='360' height='360' fill='url(%23g)'/%3E%3Ccircle cx='285' cy='86' r='58' fill='rgba(255,255,255,.22)'/%3E%3Cpath d='M0 275 C90 220 190 320 360 245 L360 360 L0 360 Z' fill='rgba(255,255,255,.18)'/%3E%3Ctext x='28' y='306' font-family='sans-serif' font-size='34' font-weight='700' fill='white'%3E${label}%3C/text%3E%3C/svg%3E`

const items = [
	{ id: "shell", title: "Shell audit", subtitle: "nav and chrome proof", src: tile("#0f766e", "#2563eb", "Shell") },
	{ id: "voice", title: "Voice tools", subtitle: "mic and selector states", src: tile("#9f1239", "#f97316", "Voice") },
	{ id: "motion", title: "Motion kit", subtitle: "animated layouts", src: tile("#312e81", "#a855f7", "Motion") },
]

function AnimatedCollectionExample() {
	const [view, setView] = useState<AnimatedCollectionView>("card")

	return (
		<div className="w-[560px] p-6">
			<AnimatedCollection view={view}>
				<AnimatedCollectionViewToggle
					value={view}
					onValueChange={setView}
					options={[
						{ value: "list", label: "List", icon: <ListIcon /> },
						{ value: "card", label: "Cards", icon: <Grid2X2Icon /> },
						{ value: "pack", label: "Pack", icon: <Layers3Icon /> },
					]}
				/>
				<AnimatedCollectionList>
					{items.map((item, index) => (
						<AnimatedCollectionItem key={item.id} index={index}>
							<AnimatedCollectionItemMedia>
								<img src={item.src} alt="" />
							</AnimatedCollectionItemMedia>
							<AnimatedCollectionItemContent>
								<div className="min-w-0">
									<div className="truncate font-medium">{item.title}</div>
									<div className="text-muted-foreground text-sm">{item.subtitle}</div>
								</div>
							</AnimatedCollectionItemContent>
						</AnimatedCollectionItem>
					))}
				</AnimatedCollectionList>
				<AnimatedCollectionCaption className="text-sm text-muted-foreground">
					Coverage packet ready for review
				</AnimatedCollectionCaption>
			</AnimatedCollection>
		</div>
	)
}

const meta = {
	title: "Animate/Layouts/AnimatedCollection",
	component: AnimatedCollection,
	render: () => <AnimatedCollectionExample />,
} satisfies Meta<typeof AnimatedCollection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
