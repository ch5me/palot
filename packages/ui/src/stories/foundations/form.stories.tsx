import {
	Button,
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useForm } from "react-hook-form"

type CoverageFormValues = {
	component: string
}

function CoverageFormPreview() {
	const form = useForm<CoverageFormValues>({
		defaultValues: {
			component: "input-group",
		},
	})

	return (
		<Form {...form}>
			<form className="w-[420px] rounded-lg border bg-card p-5 text-card-foreground">
				<FormField
					control={form.control}
					name="component"
					rules={{ required: "Component name is required." }}
					render={({ field }) => (
						<FormItem>
							<FormLabel>Component</FormLabel>
							<FormControl>
								<Input placeholder="button" {...field} />
							</FormControl>
							<FormDescription>Local component name from the tracker.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button className="mt-4" type="button">
					Create story
				</Button>
			</form>
		</Form>
	)
}

const meta = {
	title: "Foundations/Forms/Form",
	component: CoverageFormPreview,
} satisfies Meta<typeof CoverageFormPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
