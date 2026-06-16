/**
 * Firefly Plugin Marketplace — TextMate grammar runtime (P2/L4 last-mile)
 *
 * The concrete `registerGrammar` implementation the data-contributions
 * projection left as a typed boundary: load `vscode-oniguruma` WASM, build a
 * `vscode-textmate` Registry, and bridge each grammar into Monaco as a
 * TokensProvider so installed language extensions get real TextMate
 * highlighting (not just Monarch).
 *
 * Grammar JSON/PLIST bytes are supplied by the caller (`loadGrammarContent`) —
 * in Electron that reads from the content-addressed package store; this module
 * stays transport-agnostic. The oniguruma WASM is bundled via vite `?url`.
 *
 * NOTE: end-to-end tokenization is verified by opening a file of a grammar's
 * language in the running app (Monaco tokenization needs the real WASM + editor).
 * The pure scope→token mapping (`lastScope`) is unit-tested here; the registry
 * wiring is exercised at runtime.
 */

import type * as monaco from "monaco-editor"
import { INITIAL, parseRawGrammar, Registry, type IGrammar, type StateStack } from "vscode-textmate"
import { createOnigScanner, createOnigString, loadWASM } from "vscode-oniguruma"
import onigWasmUrl from "vscode-oniguruma/release/onig.wasm?url"
import type { MonacoGrammarRegistration } from "../../shared/firefly-plugin/data-contributions-projection"

/** The raw grammar source the caller loads for a registration. */
export interface GrammarSource {
	/** Grammar file contents (TextMate JSON or PLIST). */
	readonly content: string
	/** Original file path — used by `parseRawGrammar` to pick the parser. */
	readonly path: string
}

export type GrammarContentLoader = (registration: MonacoGrammarRegistration) => Promise<GrammarSource | null>

/**
 * The most specific TextMate scope on a token becomes its Monaco token class.
 * Monaco theme rules match on a prefix (`keyword` matches `keyword.control.ts`),
 * so the deepest scope gives the best coloring with the existing theme rules.
 * Pure + unit-tested.
 */
export function lastScope(scopes: readonly string[]): string {
	return scopes.length > 0 ? scopes[scopes.length - 1]! : ""
}

let onigLibPromise: Promise<{ createOnigScanner: typeof createOnigScanner; createOnigString: typeof createOnigString }> | null =
	null

/** Load the oniguruma WASM once and expose it as a vscode-textmate onigLib. */
function getOnigLib() {
	if (!onigLibPromise) {
		onigLibPromise = fetch(onigWasmUrl)
			.then((res) => res.arrayBuffer())
			.then((buffer) => loadWASM(buffer))
			.then(() => ({ createOnigScanner, createOnigString }))
	}
	return onigLibPromise
}

/** Monaco IState wrapping a vscode-textmate rule stack. */
class TextMateState implements monaco.languages.IState {
	constructor(readonly ruleStack: StateStack) {}
	clone(): monaco.languages.IState {
		return new TextMateState(this.ruleStack)
	}
	equals(other: monaco.languages.IState): boolean {
		return other instanceof TextMateState && other.ruleStack === this.ruleStack
	}
}

function createTokensProvider(grammar: IGrammar): monaco.languages.TokensProvider {
	return {
		getInitialState: () => new TextMateState(INITIAL),
		tokenize: (line, state) => {
			const result = grammar.tokenizeLine(line, (state as TextMateState).ruleStack)
			return {
				tokens: result.tokens.map((token) => ({
					startIndex: token.startIndex,
					scopes: lastScope(token.scopes),
				})),
				endState: new TextMateState(result.ruleStack),
			}
		},
	}
}

/**
 * Build a Registry whose grammars are loaded on demand from `loadGrammarContent`.
 * Exposed for callers that want to load grammars without registering them.
 */
export function createTextMateRegistry(
	registrations: readonly MonacoGrammarRegistration[],
	loadGrammarContent: GrammarContentLoader,
): Registry {
	const byScope = new Map(registrations.map((r) => [r.scopeName, r]))
	return new Registry({
		onigLib: getOnigLib(),
		loadGrammar: async (scopeName) => {
			const registration = byScope.get(scopeName)
			if (!registration) return null
			const source = await loadGrammarContent(registration)
			if (!source) return null
			return parseRawGrammar(source.content, source.path)
		},
	})
}

/**
 * Register every grammar that targets a Monaco language as a TextMate
 * TokensProvider. Grammars with no `language` (injection-only) are loaded into
 * the registry but not bound to a language. Returns the count registered.
 *
 * Fail-soft per grammar: a grammar that fails to load is skipped with a warning
 * so one broken extension grammar can't break highlighting for the rest.
 */
export async function registerTextMateGrammars(deps: {
	monaco: typeof monaco
	registrations: readonly MonacoGrammarRegistration[]
	loadGrammarContent: GrammarContentLoader
	onError?: (scopeName: string, error: unknown) => void
}): Promise<number> {
	const registry = createTextMateRegistry(deps.registrations, deps.loadGrammarContent)
	let registered = 0
	for (const registration of deps.registrations) {
		if (!registration.language) continue
		try {
			const grammar = await registry.loadGrammar(registration.scopeName)
			if (!grammar) continue
			deps.monaco.languages.setTokensProvider(registration.language, createTokensProvider(grammar))
			registered += 1
		} catch (error) {
			deps.onError?.(registration.scopeName, error)
		}
	}
	return registered
}
