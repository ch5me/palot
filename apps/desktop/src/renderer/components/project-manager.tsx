import { PmLiveDashboard } from "./pm-live-dashboard"

export function ProjectManager() {
	return (
		<div className="h-full overflow-auto px-0 pb-6 pt-8 sm:px-6">
			<div className="mx-auto w-full max-w-7xl">
				<PmLiveDashboard />
			</div>
		</div>
	)
}
