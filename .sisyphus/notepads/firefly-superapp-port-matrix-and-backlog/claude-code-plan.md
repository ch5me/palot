# Claude Code Surface Plan <!-- oc:id=sec_aa -->

## Current Elf seams <!-- oc:id=sec_ab -->

- Onboarding already has first-class Claude Code migration detection, preview, execution, and backup/restore flows.
- Setup settings already expose migration history and restore paths.
- There is no separate Claude-Code-specific runtime or interactive session substrate in Elf

## Decision <!-- oc:id=sec_ac -->

Claude Code should start as a compatibility/import lane, not a real interactive surface.

## Why <!-- oc:id=sec_ad -->

- The concrete value already present in Elf is migration + compatibility, not a second live agent workflow.
- Creating a separate interactive Claude Code lane would compete with OpenCode, which current Firefly rules explicitly avoid.
- The migration/onboarding/settings seams are already enough to make Claude Code visible as a product lane.

## First shell shape <!-- oc:id=sec_ae -->

- Add a `claude` Firefly side-panel proof shell.
- Summarize the Claude Code migration story, what gets imported, and where restore/setup flows live.
- Point users to Setup / onboarding-style compatibility actions rather than inventing a second runtime.

## Deferred <!-- oc:id=sec_af -->

- live Claude Code session runtime inside Elf
- dual-agent orchestration surface distinct from OpenCode
- Claude-specific domain/backend beyond migration and compatibility