# Task 31-36: Surface Integration Design Consolidated <!-- oc:id=sec_aa -->

## Workspace Shell Decomposition <!-- oc:id=sec_ab -->
- **Nav-Sidebar**: Folio contributes the tree data and quick actions; Palot renders the `DiscreteTabs` header and pane resizer.
- **Page**: Folio contributes the editor/database view; Palot provides the outer frame, breadcrumbs, and autosave status banner container.
- **Header Context**: Folio passes `pageTitle` and `workspaceName` up to Palot via a host callback, allowing Palot to update its native app bar without Folio owning the DOM.

## Document / Page Surface <!-- oc:id=sec_ac -->
- Route handling is mediated by the host deeplink bridge.
- Editor loading is lazy (`Suspense`), with a host-owned skeleton fallback.
- Page titles are synced to the host via `onTitleChange` callback.
- Contextual panels (comments, backlinks) are opened via `requestSidePanel('backlinks', { documentId })` host API.

## Database / View Surface <!-- oc:id=sec_ad -->
- Table view is MVP. Future views (board, calendar) use the same `page` surface contract, swapping the inner component based on the active view config.
- Row opening triggers `navigateToRoute('workspace:org/page:doc')`, proving cross-surface deep linking.
- View switching is local to the `page` component; the host is unaware of internal database view state.

## Settings / Command / Side-Panel <!-- oc:id=sec_ae -->
- Settings sections register via `kind: "settings-section"`.
- Commands register via `kind: "command"` and are merged into Palot's `Cmd+K`.
- Side-panels are requested via host API, ensuring z-index and focus management stay with Palot.

## Acceptance Check <!-- oc:id=sec_af -->
- [x] Workspace shell decomposition is executable.
- [x] Document, database, settings, and command integration paths are explicit and non-duplicative.