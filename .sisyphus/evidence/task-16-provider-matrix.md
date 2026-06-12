# Task 16: Runtime, Provider, and Service Inventory <!-- oc:id=sec_aa -->

## Provider / Service Ownership Matrix <!-- oc:id=sec_ab -->

| Provider/Service | Scope | Current Owner | Target Integration Model in Palot |
|---|---|---|---|
| **tRPC Client** (`@ch5me/folio-client`) | API communication | Folio Web | **Adapter-owned**: Palot hosts a single memoized client instance via React Context, injected into Folio surfaces to prevent duplicate network connections. |
| **Better Auth** (`@ch5me/folio-auth`) | Session management | Folio API | **Folio-owned (bridge period)**: Palot respects `insight_session_token` cookie. Long-term: unified Firefly RS256/JWKS auth at host level. |
| **Drizzle ORM / SQLite/D1** | Data persistence | Folio API | **Folio-owned**: Palot never touches Folio DB directly; all mutations flow through the tRPC adapter. |
| **Yjs / Hocuspocus** | Real-time editor sync | Folio Web/API | **Folio-owned**: Sync lifecycle stays bound to the active document `page` surface in Palot. |
| **BlockNote Editor** | Document rendering | Folio Web | **Folio-owned**: Rendered inside Palot's `page` surface via the component contract. |
| **Local Cache** (`local-cache.ts`) | Offline document state | Folio Web | **Folio-owned**: Initialized and torn down alongside the active page surface lifecycle. |

## Hidden Singleton Collision Risks <!-- oc:id=sec_ac -->
1. **tRPC Client Instantiation**: Folio surfaces rooted under `~/src/ch5/folio-db/apps/web/src/components/Sidebar.tsx`, `~/src/ch5/folio-db/apps/web/src/components/WorkspaceHome.tsx`, and `~/src/ch5/folio-db/apps/web/src/databases/DatabasePage.tsx` all depend on the same client layer. If embedded as separate Palot surfaces without a shared host context, this creates redundant WebSocket/HTTP connections. **Mitigation**: Palot must provide a single, memoized Folio client instance via a host-provided React Context or Jotai atom. <!-- oc:id=item_aa -->
1. **Auth Redirect Loops**: Folio's `useSession` hook manages its own auth redirects. In Palot, auth should be elevated to the host level. Folio surfaces should receive auth state as props or read from a host-provided atom, disabling internal redirect logic that would break the Palot shell. <!-- oc:id=item_ab -->

## Acceptance Criteria <!-- oc:id=sec_ad -->
- [x] Every major provider/service is ownership-classified.
- [x] Hidden singleton collision risks (tRPC client, auth redirects) are explicitly called out with mitigation strategy.