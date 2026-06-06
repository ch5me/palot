# Task 23 Provenance Details <!-- oc:id=sec_aa -->

Imported MCP entries now carry provenance fields:

- `source = imported`
- `importedFrom = Cursor`
- `editMode = copy_on_write`

Connections UI shows imported entries in a dedicated section with an `Adopt` action.
This makes edit behavior explicit without treating migrated definitions as hidden config-only state.