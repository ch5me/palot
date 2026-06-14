import { Image as GeneratedImage } from "@ch5me/elf-ui/components/ai-elements/image"
import type { Meta, StoryObj } from "@storybook/react-vite"

const proofSvg =
	"PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgdmlld0JveD0iMCAwIDY0MCAzNjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0MCIgaGVpZ2h0PSIzNjAiIHJ4PSIyNCIgZmlsbD0iIzE4MTYyMCIvPjxjaXJjbGUgY3g9IjUwOCIgY3k9Ijk2IiByPSI2NCIgZmlsbD0iI0ZERSU4QSIvPjxwYXRoIGQ9Ik04MCAyNzBMMjEwIDE0MEwzMjAgMjQwTDM5MCAxNzBMNTYwIDI3MEg4MFoiIGZpbGw9IiM2RUQzQ0YiLz48dGV4dCB4PSI4MCIgeT0iNzQiIGZpbGw9IiNGOUZBRkIiIGZvbnQtZmFtaWx5PSJ1aS1tb25vc3BhY2UsU0ZNb25vLVJlZ3VsYXIsTWVubG8sbW9ub3NwYWNlIiBmb250LXNpemU9IjI4Ij5jaDUgcmVuZGVyIHByb29mPC90ZXh0Pjwvc3ZnPg=="

const imageArgs = {
	base64: proofSvg,
	mediaType: "image/svg+xml",
	uint8Array: new Uint8Array(),
}

const meta = {
	title: "AI Elements/Media/Image",
	component: GeneratedImage,
	render: () => (
		<div className="w-[520px] p-8">
			<GeneratedImage
				alt="Generated render proof landscape"
				className="border bg-card shadow-sm"
				{...imageArgs}
			/>
		</div>
	),
} satisfies Meta<typeof GeneratedImage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: imageArgs,
}
