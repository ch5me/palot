import { type RefObject, useEffect } from "react"

/**
 * Invokes `callback` when a pointer interaction starts outside the element
 * referenced by `ref`. Listens for both `mousedown` and `touchstart`.
 */
function useOutsideClick(
	ref: RefObject<HTMLElement | null>,
	callback: (event: MouseEvent | TouchEvent) => void,
) {
	useEffect(() => {
		const listener = (event: MouseEvent | TouchEvent) => {
			if (!ref.current || ref.current.contains(event.target as Node)) {
				return
			}
			callback(event)
		}

		document.addEventListener("mousedown", listener)
		document.addEventListener("touchstart", listener)

		return () => {
			document.removeEventListener("mousedown", listener)
			document.removeEventListener("touchstart", listener)
		}
	}, [ref, callback])
}

export { useOutsideClick }
