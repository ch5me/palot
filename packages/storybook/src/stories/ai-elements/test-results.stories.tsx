import {
	Test,
	TestDuration,
	TestError,
	TestErrorMessage,
	TestErrorStack,
	TestName,
	TestResults,
	TestResultsContent,
	TestResultsDuration,
	TestResultsHeader,
	TestResultsProgress,
	TestResultsSummary,
	TestStatus,
	TestSuite,
	TestSuiteContent,
	TestSuiteName,
	TestSuiteStats,
} from "@ch5me/elf-ui/components/ai-elements/test-results"
import type { Meta, StoryObj } from "@storybook/react-vite"

const summary = {
	duration: 1840,
	failed: 1,
	passed: 8,
	skipped: 1,
	total: 10,
}

const meta = {
	title: "AI Elements/Diagnostics/TestResults",
	component: TestResults,
	render: () => (
		<div className="w-[760px] p-8">
			<TestResults summary={summary}>
				<TestResultsHeader>
					<TestResultsSummary />
					<TestResultsDuration />
				</TestResultsHeader>
				<TestResultsContent>
					<TestResultsProgress />
					<TestSuite defaultOpen name="storybook coverage" status="failed">
						<TestSuiteName>
							storybook coverage
							<TestSuiteStats failed={1} passed={2} skipped={1} />
						</TestSuiteName>
						<TestSuiteContent>
							<Test duration={320} name="renders code block story" status="passed" />
							<Test duration={284} name="captures mobile screenshot" status="passed" />
							<Test name="captures desktop screenshot" status="failed">
								<TestStatus />
								<div className="flex-1">
									<TestName />
									<TestError>
										<TestErrorMessage>Expected visible node count above zero.</TestErrorMessage>
										<TestErrorStack>at verifyStory(render-proof.ts:42:18)</TestErrorStack>
									</TestError>
								</div>
								<TestDuration>811ms</TestDuration>
							</Test>
						</TestSuiteContent>
					</TestSuite>
				</TestResultsContent>
			</TestResults>
		</div>
	),
} satisfies Meta<typeof TestResults>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		summary,
	},
}
