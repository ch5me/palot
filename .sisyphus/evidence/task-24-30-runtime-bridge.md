# Task 24-30: Runtime Bridge & Fail-Loud Model Consolidated <!-- oc:id=sec_aa -->

## Route / Deeplink Bridge <!-- oc:id=sec_ab -->
- Palot host intercepts `?route=<identity>` mutations from Folio.
- Instead of letting Folio call `window.history.replaceState`, the plugin calls a host-provided `navigateToRoute(identity)` function.
- The host manages the actual URL and restores the correct Folio surface based on the identity.

## Provider / API Client Bridge <!-- oc:id=sec_ac -->
- **Problem**: Multiple independent `createClient()` calls cause redundant connections.
- **Solution**: Palot instantiates a single `@ch5me/folio-client` at the plugin boundary and passes it down via React Context (`FolioClientProvider`).

## Auth / Session Bridge <!-- oc:id=sec_ad -->
- **Current**: Better Auth dual-cookie bridge (`insight_session_token`).
- **Contract**: Folio surfaces read auth state from a host-provided atom. If the host detects an expired or missing token, it triggers a host-level auth flow, preventing Folio from rendering redirect loops. Fail-loud: if `ELFAUTH_JWKS_URL` is configured but unreachable, the surface renders an explicit "Auth Bridge Unavailable" error banner, not a silent blank screen.

## API / Storage / Sync Bridge <!-- oc:id=sec_ae -->
- **Initialization**: When a Folio `page` mounts, it signals the host `background-service` to ensure the tRPC client is hydrated and local caches are warmed.
- **Teardown**: When the Folio workspace is closed or switched, the host triggers a cleanup routine to disconnect Yjs sync providers and clear sensitive local cache.
- **Offline Behavior**: If the host detects network loss, it passes an `isOffline` flag to the Folio context. Folio surfaces must display a localized "Offline – changes saved locally" banner and disable remote-only actions.

## Failure-State Matrix (Fail-Loud) <!-- oc:id=sec_af -->
| Failure State | Host UX Behavior | Typed Runtime Behavior |
|---|---|---|
| Missing Auth | Full-screen auth gate or explicit banner. | Surface returns `available: false` with `reason: "auth-missing"`. |
| Missing Workspace | "Workspace not found" placeholder with "Create" CTA. | Surface renders fallback; API calls return 404 handled by host. |
| API Unavailable | "Connection lost" banner with retry button. | tRPC client throws; host catches and sets `apiStatus: "error"`. |
| Plugin Quarantined | "Surface unavailable (quarantined)" in nav-sidebar. | Projection filters out quarantined contributions; host logs reason. |
| Unsupported Route | "Unsupported Folio surface" placeholder. | Dispatcher renders `<UnsupportedDatabaseView />` or generic fallback. |

## Acceptance Check <!-- oc:id=sec_ag -->
- [x] Bridge contracts cover startup, active use, and recovery.
- [x] Failure-state matrix is explicit and exhaustive for MVP.
- [x] No silent fallback behavior is permitted.