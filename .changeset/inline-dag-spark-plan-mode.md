---
"@ch5me/elf-desktop": minor
---

Add plan mode + inline DAG rendering to the chat:

- New `Plan` toggle in the prompt toolbar. When enabled, the first user
  message in a session is auto-paired with a DAG-build system block
  that asks the agent to emit a ` ```dag ` JSON fence.
- Text responses are now rendered through a new `TextWithDag` component
  that parses ` ```dag ` fences out of assistant text and renders
  them as interactive inline DAG sparkline cards.
- A new `dag` tool case in `ChatToolCall` parses the same `{ nodes,
  edges }` shape from a tool-call payload and renders the graph the
  same way (so the agent can also produce a DAG via a tool call when
  one is defined server-side).
- Wires `@ch5me/dag-sparkline` as a workspace dependency (the SVG DAG
  sparkline component from the ch5-packages monorepo).