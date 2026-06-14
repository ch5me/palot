import { SchemaDisplay } from "@ch5me/elf-ui/components/ai-elements/schema-display"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Data/SchemaDisplay",
	component: SchemaDisplay,
	render: () => (
		<div className="w-[620px] p-8">
			<SchemaDisplay
				description="Create browser-lane proof for a visible session surface."
				method="POST"
				parameters={[
					{
						description: "Session identifier",
						location: "path",
						name: "sessionId",
						required: true,
						type: "string",
					},
				]}
				path="/api/sessions/{sessionId}/proof"
				requestBody={[
					{
						description: "Storybook story IDs to capture",
						items: { name: "storyId", type: "string" },
						name: "stories",
						required: true,
						type: "array",
					},
				]}
				responseBody={[
					{ name: "ok", required: true, type: "boolean" },
					{ name: "proofDir", required: true, type: "string" },
				]}
			/>
		</div>
	),
} satisfies Meta<typeof SchemaDisplay>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		method: "POST",
		path: "/api/sessions/{sessionId}/proof",
	},
}
