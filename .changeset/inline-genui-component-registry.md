---
"@ch5me/elf-desktop": minor
---

Generalize inline DAG rendering into a reusable GenUI component registry.

- New `renderer/genui/` registry maps a component name (e.g.
  `dag-sparkline`) to a React component plus a prop validator. The
  assistant can now render any registered component inline by emitting a
  ` ```genui ` fence: `{ "component": "<name>", "props": { ... } }`.
- `TextWithGenUi` replaces `TextWithDag` at every assistant-text render
  site, dispatching fences through the registry. The legacy ` ```dag `
  fence still works as a back-compat alias for `dag-sparkline`.
- The model is told which components it can render via an always-on
  catalog derived from the registry (`buildGenUiCatalog`), injected once
  per session and stripped from the displayed user bubble. Plan mode adds
  an extra nudge to render the plan as a `dag-sparkline`.
- The first registered component is the unified `DagSparkline` from
  `@ch5me/dag-sparkline`, which now self-themes (no manual token setup).