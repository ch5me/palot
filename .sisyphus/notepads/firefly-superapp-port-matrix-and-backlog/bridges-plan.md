# Bridges / Integrations Plan <!-- oc:id=sec_aa -->

## Meaning <!-- oc:id=sec_ab -->

In the old superapp, Bridges was the integration hub: the place where external tools and systems could be linked into the app experience.

## Current Palot seams to reuse <!-- oc:id=sec_ac -->

- Plugins surface already inventories OpenCode-native seams: skills, commands, MCP posture.
- Provider settings already model external auth / connection posture.
- Onboarding already knows about MCP and command/skill counts.

## Decision <!-- oc:id=sec_ad -->

Bridges should become the higher-level integration hub, while Plugins remains the lower-level OpenCode-native inventory.

## Information architecture <!-- oc:id=sec_ae -->

- Plugins = technical runtime inventory
  - skills
  - commands
  - MCP posture
  - provider/plugin auth posture
- Bridges = user-facing integration hub
  - connected systems posture
  - launch points into provider settings / plugin inventory
  - later: vendor-specific connectors, sync targets, and cross-system workflows

## First shell shape <!-- oc:id=sec_af -->

- Add a `bridges` Firefly surface as a side-panel proof shell.
- Reuse counts and summaries from plugin/provider seams instead of inventing new backend logic.
- Position it as the integrations overview layer above Plugins.

## Deferred <!-- oc:id=sec_ag -->

- dedicated connector install flows
- vendor-specific bridge logic
- sync orchestration
- external apps marketplace semantics