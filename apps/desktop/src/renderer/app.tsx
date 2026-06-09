import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { Provider as JotaiProvider } from "jotai"
import { useAtomValue } from "jotai"
import { DevSurfaceProvider } from "@ch5me/react-dev-surface"
import { isDevSurfaceAtom } from "./atoms/dev-surface"
import { appStore } from "./atoms/store"
import { queryClient } from "./lib/query-client"
import { router } from "./router"

function DevSurfaceGate({ children }: { children: React.ReactNode }) {
	const enabled = useAtomValue(isDevSurfaceAtom)
	if (!enabled || !import.meta.env.DEV) return <>{children}</>
	return <DevSurfaceProvider>{children}</DevSurfaceProvider>
}

export function App() {
	return (
		<JotaiProvider store={appStore}>
			<QueryClientProvider client={queryClient}>
				<DevSurfaceGate>
					<RouterProvider router={router} />
				</DevSurfaceGate>
			</QueryClientProvider>
		</JotaiProvider>
	)
}
