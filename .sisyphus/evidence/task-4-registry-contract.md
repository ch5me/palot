# Task 4 Registry Contract <!-- oc:id=sec_aa -->

Source: `apps/desktop/src/renderer/lib/mcp-connections.ts`

## Upstream registry model <!-- oc:id=sec_ab -->

`McpCatalogRegistryEntry` keeps upstream registry data separate from curated metadata.
It now includes registry versioning and normalized transport/auth/tool-count fields.

## Cache strategy <!-- oc:id=sec_ac -->

`McpCatalogCachePolicy` defines:

- API base URL: `https://registry.modelcontextprotocol.io/`
- refresh TTL
- stale TTL
- negative TTL
- strategy: cursor page cache
- fallback mode: serve stale on fetch failure

## Pagination and freshness <!-- oc:id=sec_ad -->

`McpCatalogPageCursor`, `McpCatalogCacheEnvelope`, `McpCatalogPage`, and `McpCatalogSearchResult` model:

- cursor-based paging
- cache timestamps
- stale/fresh/offline-cache freshness state
- stale-cache fallback during registry outages