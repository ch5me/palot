import {
	EnvironmentVariable,
	EnvironmentVariableCopyButton,
	EnvironmentVariableGroup,
	EnvironmentVariableName,
	EnvironmentVariableRequired,
	EnvironmentVariables,
	EnvironmentVariablesContent,
	EnvironmentVariablesHeader,
	EnvironmentVariablesTitle,
	EnvironmentVariablesToggle,
	EnvironmentVariableValue,
} from "@ch5me/elf-ui/components/ai-elements/environment-variables"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Data/EnvironmentVariables",
	component: EnvironmentVariables,
	render: () => (
		<div className="w-[620px] p-8">
			<EnvironmentVariables defaultShowValues>
				<EnvironmentVariablesHeader>
					<EnvironmentVariablesTitle>Runtime Environment</EnvironmentVariablesTitle>
					<EnvironmentVariablesToggle />
				</EnvironmentVariablesHeader>
				<EnvironmentVariablesContent>
					<EnvironmentVariable name="PALOT_SERVER_URL" value="http://127.0.0.1:30206">
						<EnvironmentVariableGroup>
							<EnvironmentVariableName />
							<EnvironmentVariableRequired />
						</EnvironmentVariableGroup>
						<EnvironmentVariableGroup>
							<EnvironmentVariableValue />
							<EnvironmentVariableCopyButton copyFormat="export" />
						</EnvironmentVariableGroup>
					</EnvironmentVariable>
					<EnvironmentVariable name="OPENCODE_MODE" value="external" />
					<EnvironmentVariable name="STORYBOOK_PORT" value="20883" />
				</EnvironmentVariablesContent>
			</EnvironmentVariables>
		</div>
	),
} satisfies Meta<typeof EnvironmentVariables>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultShowValues: true,
	},
}
