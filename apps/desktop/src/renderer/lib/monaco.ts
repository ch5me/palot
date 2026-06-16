import * as monaco from "monaco-editor"
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker"
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker"
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker"
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker"

/**
 * TextMate grammar runtime (L4). The concrete `registerGrammar` implementation
 * the P2 data-contributions projection left as a typed boundary now lives in
 * `textmate-runtime.ts`. The editor surface registers installed-extension
 * grammars by calling `registerTextMateGrammars({ monaco, registrations,
 * loadGrammarContent })` with the catalog's projected grammars
 * (`toMonacoGrammarRegistration`) and a content loader that reads grammar JSON
 * from the content-addressed package store over IPC.
 */
export { registerTextMateGrammars, createTextMateRegistry, lastScope } from "./textmate-runtime"

let initialized = false

export function initMonaco(): typeof monaco {
	if (initialized) {
		return monaco
	}
	initialized = true

	;(self as typeof self & { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
		getWorker(_moduleId: string, label: string) {
			switch (label) {
				case "json":
					return new jsonWorker()
				case "css":
				case "scss":
				case "less":
					return new cssWorker()
				case "html":
				case "handlebars":
				case "razor":
					return new htmlWorker()
				case "typescript":
				case "javascript":
					return new tsWorker()
				default:
					return new editorWorker()
			}
		},
	}

	registerDart(monaco)
	defineTheme(monaco)
	return monaco
}

export function languageForPath(filePath: string): string {
	const extension = filePath.split(".").pop()?.toLowerCase() ?? ""
	const map: Record<string, string> = {
		ts: "typescript",
		tsx: "typescript",
		mts: "typescript",
		cts: "typescript",
		js: "javascript",
		jsx: "javascript",
		mjs: "javascript",
		cjs: "javascript",
		json: "json",
		jsonc: "json",
		css: "css",
		scss: "scss",
		less: "less",
		html: "html",
		htm: "html",
		vue: "html",
		svelte: "html",
		md: "markdown",
		markdown: "markdown",
		yaml: "yaml",
		yml: "yaml",
		toml: "ini",
		ini: "ini",
		env: "ini",
		sh: "shell",
		bash: "shell",
		zsh: "shell",
		rs: "rust",
		py: "python",
		go: "go",
		rb: "ruby",
		php: "php",
		java: "java",
		kt: "kotlin",
		swift: "swift",
		c: "c",
		h: "c",
		cpp: "cpp",
		cc: "cpp",
		hpp: "cpp",
		cs: "csharp",
		sql: "sql",
		lua: "lua",
		xml: "xml",
		dockerfile: "dockerfile",
		dart: "dart",
	}
	return map[extension] ?? "plaintext"
}

function registerDart(instance: typeof monaco) {
	if (instance.languages.getLanguages().some((language) => language.id === "dart")) {
		return
	}
	instance.languages.register({ id: "dart", extensions: [".dart"], aliases: ["Dart", "dart"] })
	instance.languages.setLanguageConfiguration("dart", {
		comments: { lineComment: "//", blockComment: ["/*", "*/"] },
		brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
		autoClosingPairs: [
			{ open: "{", close: "}" },
			{ open: "[", close: "]" },
			{ open: "(", close: ")" },
			{ open: "'", close: "'", notIn: ["string", "comment"] },
			{ open: '"', close: '"', notIn: ["string", "comment"] },
		],
	})
	instance.languages.setMonarchTokensProvider("dart", {
		keywords: [
			"abstract",
			"as",
			"assert",
			"async",
			"await",
			"break",
			"case",
			"catch",
			"class",
			"const",
			"continue",
			"default",
			"do",
			"else",
			"enum",
			"export",
			"extends",
			"external",
			"factory",
			"false",
			"final",
			"finally",
			"for",
			"if",
			"implements",
			"import",
			"in",
			"is",
			"late",
			"mixin",
			"new",
			"null",
			"on",
			"return",
			"static",
			"super",
			"switch",
			"this",
			"throw",
			"true",
			"try",
			"var",
			"void",
			"while",
			"with",
		],
		typeKeywords: ["int", "double", "num", "bool", "String", "List", "Map", "Set", "Future", "Stream", "Widget", "BuildContext"],
		operators: ["=", ">", "<", "!", "~", "?", ":", "==", "<=", ">=", "!=", "&&", "||", "++", "--", "+", "-", "*", "/", "&", "|", "^", "%", "<<", ">>", "+=", "-=", "*=", "/=", "??", "?.", "=>", "..."],
		symbols: /[=><!~?:&|+\-*/^%]+/,
		tokenizer: {
			root: [
				[/@[a-zA-Z_$][\w$]*/, "annotation"],
				[/[a-zA-Z_$][\w$]*/, { cases: { "@keywords": "keyword", "@typeKeywords": "type", "@default": "identifier" } }],
				[/[A-Z][\w$]*/, "type"],
				{ include: "@whitespace" },
				[/[{}()[\]]/, "@brackets"],
				[/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],
				[/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
				[/0[xX][0-9a-fA-F]+/, "number.hex"],
				[/\d+/, "number"],
				[/"([^"\\]|\\.)*$/, "string.invalid"],
				[/'([^'\\]|\\.)*$/, "string.invalid"],
				[/"/, "string", "@string_double"],
				[/'/, "string", "@string_single"],
			],
			whitespace: [
				[/[ \t\r\n]+/, ""],
				[/\/\*/, "comment", "@comment"],
				[/\/\/.*$/, "comment"],
			],
			comment: [
				[/[^/*]+/, "comment"],
				[/\*\//, "comment", "@pop"],
				[/[/*]/, "comment"],
			],
			string_double: [
				[/[^\\"$]+/, "string"],
				[/\$\{/, { token: "delimiter.bracket", next: "@interp" }],
				[/\$[a-zA-Z_$][\w$]*/, "variable"],
				[/"/, "string", "@pop"],
			],
			string_single: [
				[/[^\\'$]+/, "string"],
				[/\$\{/, { token: "delimiter.bracket", next: "@interp" }],
				[/\$[a-zA-Z_$][\w$]*/, "variable"],
				[/'/, "string", "@pop"],
			],
			interp: [
				[/[^}]+/, "variable"],
				[/\}/, { token: "delimiter.bracket", next: "@pop" }],
			],
		},
	})
}

function defineTheme(instance: typeof monaco) {
	instance.editor.defineTheme("elf-dark", {
		base: "vs-dark",
		inherit: true,
		rules: [
			{ token: "comment", foreground: "5c6370", fontStyle: "italic" },
			{ token: "keyword", foreground: "c678dd" },
			{ token: "type", foreground: "e5c07b" },
			{ token: "string", foreground: "98c379" },
			{ token: "annotation", foreground: "56b6c2" },
			{ token: "number", foreground: "d19a66" },
			{ token: "operator", foreground: "e06c75" },
			{ token: "variable", foreground: "56b6c2" },
		],
		colors: {
			"editor.background": "#0a0a0c",
			"editor.foreground": "#c8ccd4",
			"editorLineNumber.foreground": "#3a3a42",
			"editorLineNumber.activeForeground": "#8a8a96",
			"editor.selectionBackground": "#2a2a35",
			"editor.lineHighlightBackground": "#15151a",
			"editorCursor.foreground": "#e8732c",
			"editorIndentGuide.background1": "#1c1c22",
			"editorGutter.background": "#0a0a0c",
			"scrollbarSlider.background": "#2a2a3580",
		},
	})
}
