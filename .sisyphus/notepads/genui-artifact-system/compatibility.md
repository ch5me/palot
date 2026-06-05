# Compatibility rules <!-- oc:id=sec_aa -->

- v1 stays fence-first and renderer-only.
- existing ` ```genui ` and legacy ` ```dag ` parsing remain source-compatible.
- artifact creation should derive from resolved fence segments, not require new server protocol or tool names.
- legacy alias support remains:
  - `dag` fence -> `dag-sparkline`
  - registry aliases still resolve through `resolveGenUiEntry()`
- future explicit artifact tool path remains open, but does not block v1.
- side-panel and widget surfaces should consume the same artifact record shape so current DAG-only rollout does not special-case DAG forever.