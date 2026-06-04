# Monaco Defer <!-- oc:id=sec_aa -->

## Decision <!-- oc:id=sec_ab -->

Do not add Monaco yet.

## Why <!-- oc:id=sec_ac -->

- No Monaco dependency exists in `apps/desktop/package.json`.
- Monaco requires worker setup and bundling work that is not justified by the current read-only editor shell.
- Existing file-read, language-detect, and code-display seams already cover the current proof goal.

## Reopen condition <!-- oc:id=sec_ad -->

Reopen Monaco only when one of these becomes true:
- the editor surface needs true in-place editing
- selection/cursor state matters across file switches
- LSP-like navigation or richer editor affordances become the blocker

## Implication <!-- oc:id=sec_ae -->

Treat `Port Monaco/editor support from src/lib/monaco.ts if still needed` as deferred for now and continue to the next major surface.