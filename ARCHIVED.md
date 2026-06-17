# ARCHIVED — superseded by firefly-cloud

**This standalone `palot` repository is archived and no longer the live home for this code.**

The full palot codebase has been imported into the CH5 monorepo
**`firefly-cloud`** (canonical home: `git.ch5.me/ch5/firefly-cloud`), where it
is actively developed and shipped as the ELF desktop app and its supporting
services. The import is complete and verified:

| Was in palot                         | Now lives in firefly-cloud                 |
| ------------------------------------ | ------------------------------------------ |
| `apps/desktop`                       | `apps/elf-desktop`                         |
| ELF server                           | `services/elf-server`                      |
| `packages/ui` (Elf UI)               | `packages/elf-ui`                          |
| configconv                           | `packages/configconv` + `packages/configconv-cli` |
| MCP runtime shared                   | `packages/mcp-runtime-shared`              |
| ELF tooling scripts                  | `scripts/elf/`                             |

The last palot commit reflected in firefly-cloud is `55ed88bbd` (the
`CH5COMPAC4C-799` re-import base), which is the current tip of palot
`hq/main` — there are **no newer palot commits left unimported**.

## What to do instead

- **All new ELF / desktop / Elf-UI work happens in `firefly-cloud`.** Do not open
  PRs, branches, or issues against this repo.
- This repo is retained **read-only** to preserve the upstream-fork history
  (forked from [`ItsWendell/palot`](https://github.com/ItsWendell/palot)). It is
  not deleted for that reason.

If you landed here looking for the live code, go to `firefly-cloud`.
