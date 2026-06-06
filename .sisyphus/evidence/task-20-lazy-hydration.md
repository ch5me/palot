# Task 20 Lazy Hydration <!-- oc:id=sec_aa -->

Current runtime proof:

- `mcp_search` returns compact candidate summaries only
- `mcp_describe` returns exact schema for one selected tool
- payload includes `hydration = selected-tool-only`

This documents that browse/search paths stay compact until an explicit describe request asks for one tool contract.