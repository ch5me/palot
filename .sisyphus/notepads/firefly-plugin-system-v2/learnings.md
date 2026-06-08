## 2026-06-07T23:00:00Z Task: foundation
Committed V2 foundation in 4 scoped commits:
- manifest + descriptor
- capability taxonomy
- tool projection + 9-state machine
- palot bridge first-party manifest exemplar

Key learnings:
- current apps/desktop biome setup only checks a small config file set via script; use `bun run lint` as repo-grounded lint signal, not direct per-file biome targeting.
- firefly-plugin namespace now exists under apps/desktop/src/shared/firefly-plugin/ and is safe place for shared V2 contracts.
- reserved command ids in manifest use short ids, not dotted host-style ids; plugin business tools use full namespaced ids.
- contribution family contracts should stay host-vocabulary-first: panels/widgets own placement contracts and escape-hatch eligibility; commands/themes stay chrome-safe, with theme preview/apply remaining host-owned.
