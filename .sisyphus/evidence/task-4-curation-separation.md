# Task 4 Curation Separation <!-- oc:id=sec_aa -->

Source: `apps/desktop/src/renderer/lib/mcp-connections.ts`

## Separate layers <!-- oc:id=sec_ab -->

- Upstream registry data: `McpCatalogRegistryEntry`
- Downstream curated data: `McpCuratedMetadata`
- Joined view: `McpCatalogJoinedEntry`

## Source-of-truth rule <!-- oc:id=sec_ac -->

`McpCatalogJoinedEntry` keeps `registry` and `curated` as separate fields with `sourceOrder: registry_first`.
This prevents curated ranking/copy from mutating upstream registry payloads.

## Product implication <!-- oc:id=sec_ad -->

UI can enrich cards with curated rationale/tags without treating recommendation order as upstream truth.