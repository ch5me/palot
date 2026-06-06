# Task 21 Approval Metadata <!-- oc:id=sec_aa -->

Runtime `mcp_call` payload now carries:

- `approval: required`
- `mutability: write`
- `provenance.serverId`
- `provenance.toolName`
- `provenance.argsShape`

This keeps approval and provenance visible before execution instead of treating write-capable tools like safe reads.