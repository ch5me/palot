declare module "monaco-editor/esm/vs/editor/editor.worker?worker" {
	const WorkerFactory: {
		new (): Worker
	}
	export default WorkerFactory
}

// vite `?url` asset import for the oniguruma WASM (TextMate grammar runtime).
declare module "vscode-oniguruma/release/onig.wasm?url" {
	const url: string
	export default url
}

declare module "monaco-editor/esm/vs/language/json/json.worker?worker" {
	const WorkerFactory: {
		new (): Worker
	}
	export default WorkerFactory
}

declare module "monaco-editor/esm/vs/language/css/css.worker?worker" {
	const WorkerFactory: {
		new (): Worker
	}
	export default WorkerFactory
}

declare module "monaco-editor/esm/vs/language/html/html.worker?worker" {
	const WorkerFactory: {
		new (): Worker
	}
	export default WorkerFactory
}

declare module "monaco-editor/esm/vs/language/typescript/ts.worker?worker" {
	const WorkerFactory: {
		new (): Worker
	}
	export default WorkerFactory
}
