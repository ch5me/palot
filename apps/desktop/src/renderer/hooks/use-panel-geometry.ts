import { useEffect, useState } from "react"
import type { PanelGeometrySnapshot } from "../../preload/api"

export function usePanelGeometry(
	ref: React.RefObject<HTMLElement | null>,
): PanelGeometrySnapshot | null {
	const [geometry, setGeometry] = useState<PanelGeometrySnapshot | null>(null)

	useEffect(() => {
		const element = ref.current
		if (!element) return

		const update = () => {
			const rect = element.getBoundingClientRect()
			setGeometry({
				viewportWidth: rect.width,
				viewportHeight: rect.height,
				offsetLeft: 0,
				offsetTop: 0,
				scaleX: 1,
				scaleY: 1,
			})
		}

		update()
		const observer = new ResizeObserver(() => update())
		observer.observe(element)
		return () => observer.disconnect()
	}, [ref])

	return geometry
}
