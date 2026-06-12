# Component Contract

`contributes.components` is Loom Wave 6 contract surface.

## Manifest shape

Each component contribution must declare:

- `id`: canonical component id used in Loom tree and GenUI fence payloads.
- `apiVersion`: integer contract version.
- `category`: `diagram` | `decision` | `form` | `viewer` | `layout` | `custom`.
- `props`: Zod schema for component props.
- `events`: map of event names to Zod schemas.
- `state`: map of local state field names to Zod schemas.
- `supports_append`: whether Wave 5 append patches can target component text fields.
- `example`: `{ component, props }` example payload.
- `capabilityGates`: capability tokens required before host marks component available.
- `hostVocabulary`: host-owned `slots` and `zones` vocabulary.
- `conflictPolicy`: `agent-wins` | `human-wins` | `merge` | `ask`.

## Host guarantees

- Host owns container, activation lifecycle, persistence, and availability reasons.
- Host projects built-in and third-party manifests through same descriptor + catalog path.
- Host never lets a component mutate chrome directly.
- Host renders built-in components through GenUI registry and may gate third-party renderers behind feature flags.

## Current first-party built-ins

- `decision_card`
- `dag-sparkline`
- `status_thinking_card`

## Current third-party exemplar

- `acme.loyalty_progress_bar`

## Feature flags

- `loom.v2Components`
- `loom.v2.acmeComponents`
