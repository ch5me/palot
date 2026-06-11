# Task 23 — VS Code Extension Import Architecture <!-- oc:id=sec_aa -->

> Wave 4, Task 23 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## 1. Architectural stance <!-- oc:id=sec_ab -->

V2 imports VS Code extensions via a **classifier + transpiler pipeline** that produces native firefly-client plugins. V2 does NOT:
- install a runtime `vscode` shim
- ship a hidden VS Code sidecar
- run VS Code's extension host
- promise to support every VS Code API

The contract target is the open `vscode.d.ts` (MIT) plus the open Eclipse Theia extension API as a reference. Imported extensions must pass through a classifier that uses these contracts as the input; the output is a native V2 manifest that participates in the same runtime as built-in and local-dev plugins.

## 2. Classifier rubric (5 axes) <!-- oc:id=sec_ac -->

Each axis is scored from purely static inputs: `extension/package.json`, the `extension` folder layout, the AST of any `main`/`browser` entrypoint, and the resolved dependency graph.

| Axis | What it inspects | Score range |
|---|---|---|
| A. Manifest shape | presence/absence of `main`, `browser`, `extensionDependencies`, `contributes.*` keys | -3 to +3 |
| B. Contribution surface | which `contributes.*` keys are declared (themes, languages, grammars, snippets, keybindings, commands, views, customEditors, debuggers, etc.) | -4 to +4 |
| C. Activation breadth | `activationEvents` list and which `vscode.*` API calls the source makes | -3 to +1 |
| D. Runtime API usage | AST scan of `main`/`browser` JS for `vscode.*` namespace touches and the namespaces used | -3 to +2 |
| E. Bundled assets | presence of native `.node` binaries, language-server jars, headless browser bundles, telemetry SDKs, etc. | -3 to +1 |

Sum the per-axis scores:

| Sum | Tier | Verdict |
|---|---|---|
| >= +6 | **GREEN** | Pure-declarative or thin; transpiler can rewrite as native firefly-client plugin with no behavior loss |
| +1 to +5 | **YELLOW** | Tractable with shim; canonical patterns, e.g. LSP clients, webview panels, command handlers, custom text editors |
| -4 to 0 | **ORANGE** | Heavy but well-defined: webview-heavy panels, language servers via LSP, SCM providers; transpile where possible, otherwise passthrough to a real implementation of that subsystem |
| <= -5 | **RED** | Host-coupled: debug adapters, notebook controllers, comments, brand-new chat/LM/MCP APIs, deep TextEditor manipulation, native modules; reject by default with a structured reason code |

## 3. Tier output table <!-- oc:id=sec_ad -->

| Tier | Plugin manifest produced? | Transpile output | Runtime support | UX for rejected extensions |
|---|---|---|---|---|
| GREEN | yes (full) | native | full V2 runtime | n/a |
| YELLOW | yes (full) | native + shim adapter for one or two APIs | full V2 runtime | n/a |
| ORANGE | yes (full) | native + subsystem passthrough | partial V2 runtime (LSP, webview, SCM work; debug/notebook/etc. do not) | install-time notice about subsystem coverage |
| RED | no (intentionally) | none | none | structured rejection with `errorCode: import_unsupported_extension` and a human-readable reason referencing the offending axis |

Cross-checks (always run regardless of tier):
1. `engines.vscode` range vs. our adopted `vscode.d.ts` snapshot. If newer, flag as API drift risk. <!-- oc:id=item_aa -->
1. `extensionDependencies` against Microsoft built-ins; recurse classification through each dep; effective tier = min(self, deps). <!-- oc:id=item_ab -->
1. Per-axis reason code emitted to the operator log; the agent can read it via `plugins.describe` for failed imports. <!-- oc:id=item_ac -->
1. Webview CSP / asset URI usage if `main` touches `acquireVsCodeApi()` or `webview.asWebviewUri`; importer must implement equivalent resource URI rewriting. <!-- oc:id=item_ad -->

## 4. Reject reasons <!-- oc:id=sec_ae -->

The classifier emits one rejection record per RED extension. The record shape is:

```jsonc
{
  "pluginId": "<publisher>/<name>@<version>",
  "tier": "RED",
  "score": -7,
  "axisScores": {
    "A": -2, "B": -3, "C": -1, "D": 0, "E": -1
  },
  "blockingAxes": ["B", "E"],
  "blockingReasons": [
    "axis B: declares debuggers (contributes.debuggers)",
    "axis E: bundles native .node binaries for use in node API",
    "axis B: declares customEditors (contributes.customEditors)"
  ],
  "mitigationsAvailableInV2Plus1": [
    "install as a sidecar debug adapter and surface via browser:lane-control",
    "rewrite custom editor as panel iframe using firefly-client webview contract"
  ]
}
```

This record is what `plugins.describe` returns for any RED extension the operator tried to install. The agent can reason about it.

## 5. Transpile architecture <!-- oc:id=sec_af -->

Pipeline:

```
.vsix (.zip with extension.vsixmanifest wrapper)
   -> unzip to extension/ folder
   -> Zod parse extension/package.json
   -> per-axis scoring (classifier above)
   -> tier decision
   -> if GREEN/YELLOW/ORANGE:
        -> AST scan of extension/{main,browser}*.js
        -> map vscode.* calls to native equivalents (or shim where needed)
        -> emit firefly-client manifest + rewriter pass
        -> run under firefly-client runtime; mark transpiled origin in manifest.signature
   -> if RED: emit rejection record, do not install
```

Transpiler keeps:
- identity (publisher/name) but re-roots into `firefly-client.<publisher>.<name>` namespace
- version
- declared capabilities (translated from `engines.vscode` and detected API usage to V2 capability set)
- contributions list (translated, see below)
- declarative shapes (themes, keybindings, snippets, grammars) without code modification

Transpiler rewrites:
- `import { ... } from 'vscode'` -> generated host API surface
- `acquireVsCodeApi()` -> `acquireElfApi()`
- `vscode.window.showInformationMessage(...)` -> host adapter call
- `vscode.workspace.fs.readFile(...)` -> broker-mediated `fs:read`
- `vscode.workspace.openTextDocument(...)` -> rejection (no editor document model in V2)
- `vscode.debug.*` -> rejection (no DAP in V2)
- `vscode.languages.registerHoverProvider(...)` -> rejection (LSP in ORANGE only)

## 6. Locked non-goals <!-- oc:id=sec_ag -->

- no runtime `vscode` package
- no hidden VS Code sidecar
- no extension host emulation
- no V2.x.x APIs (chatParticipants, languageModelTools, mcpServerDefinitionProviders are RED)
- no notebook controllers
- no comments
- no source-control providers
- no debug adapter protocol

These are written into the classifier's RED-axis rules so they cannot drift.

## 7. Self-test against known extensions <!-- oc:id=sec_ah -->

- `vscode.git` (Microsoft first-party): RED (depends on `vscode.git-base`, native bindings, deep TextEditor).
- `vscode.markdown-language-features`: ORANGE (declarative languages + completion provider).
- `catppuccin.catppuccin-vsc`: GREEN (themes only).
- `PKief.material-icon-theme`: GREEN (icons only).
- `dbaeumer.vscode-eslint`: RED (LSP client + workspace fs + native modules).
- `styled-components.vscode-styled-components`: ORANGE (language server).
- `ms-python.python`: RED (notebook, debug, native bindings).
- `eamodio.gitlens`: ORANGE (declarative commands + custom editor views).

These confirm the rubric produces useful tier assignments; a deeper corpus evaluation is part of `f1-plan-compliance.md` audit pass.