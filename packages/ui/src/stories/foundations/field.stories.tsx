import {
	Checkbox,
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldTitle,
	Input,
	RadioGroup,
	RadioGroupItem,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/Field",
	component: Field,
	render: () => (
		<FieldSet className="w-[420px] rounded-lg border bg-card p-5 text-card-foreground">
			<FieldLegend>Browser lane setup</FieldLegend>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="lane-name">Lane name</FieldLabel>
					<Input id="lane-name" defaultValue="research-lane" />
					<FieldDescription>Visible in the side panel and action log.</FieldDescription>
				</Field>
				<Field orientation="horizontal">
					<Checkbox defaultChecked />
					<FieldContent>
						<FieldTitle>Capture screenshots</FieldTitle>
						<FieldDescription>Save desktop and mobile proof after render.</FieldDescription>
					</FieldContent>
				</Field>
				<FieldSeparator>Mode</FieldSeparator>
				<RadioGroup defaultValue="managed">
					<Field orientation="horizontal">
						<RadioGroupItem value="managed" />
						<FieldContent>
							<FieldTitle>Managed lane</FieldTitle>
							<FieldDescription>Use Palot-managed Chrome runtime.</FieldDescription>
						</FieldContent>
					</Field>
					<Field orientation="horizontal" data-invalid="true">
						<RadioGroupItem value="manual" aria-invalid />
						<FieldContent>
							<FieldTitle>Manual lane</FieldTitle>
							<FieldError>Manual lane is unavailable in this workspace.</FieldError>
						</FieldContent>
					</Field>
				</RadioGroup>
			</FieldGroup>
		</FieldSet>
	),
} satisfies Meta<typeof Field>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
