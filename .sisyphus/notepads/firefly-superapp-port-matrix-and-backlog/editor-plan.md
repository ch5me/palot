# Editor Shell Plan <!-- oc:id=sec_aa -->

## Current reusable seams <!-- oc:id=sec_ab -->

- Files surface already loads directory entries and real file contents.
- Language detection and JSON prettifying already exist in `renderer/lib/language.ts`.
- Existing code presentation components in chat/tool cards prove read-only code display patterns without needing Monaco immediately.
- `findFiles()` already exists in the OpenCode backend wrapper for project-scoped file search.

## Decision <!-- oc:id=sec_ac -->

Editor should complement the Files surface, not replace it.

## First shell shape <!-- oc:id=sec_ad -->

- Add an `editor` Firefly surface as a side-panel proof shell first.
- Reuse the same local file-read seam and file list/search affordance patterns already proven in Files.
- Start as read-only code inspection with search + selection + syntax-aware preview framing.
- Defer Monaco until we know the editor surface needs true editing, cursor state, or LSP-like behavior.

## Why not Monaco yet <!-- oc:id=sec_ae -->

- No Monaco dependency exists today.
- Monaco adds non-trivial bundling and worker setup cost.
- The current backlog benefits more from proving editor placement and workflow relation to Files than from committing to heavy editor infrastructure.

## Relationship to Files <!-- oc:id=sec_af -->

- Files remains the browsing surface.
- Editor becomes the focused reading surface for selected file content.
- If later needed, Files can hand off to Editor for larger code viewing, while Editor can remain the place where Monaco eventually lands.