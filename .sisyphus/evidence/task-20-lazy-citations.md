# Task 20 — Lazy citation resolution under heavy load <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Prevent large grounded answers from synchronously resolving every citation on first render. Resolution should happen on demand or bounded background prefetch so the side panel and chat remain responsive.

## Policy <!-- oc:id=sec_ac -->
### Default render path <!-- oc:id=sec_ad -->
- Parse citation markers while streaming.
- Render citation chips immediately with cheap metadata only: `documentId`, label, state, optional page hint.
- Do not synchronously run full locator resolution for every chip during message mount.

### Resolution triggers <!-- oc:id=sec_ae -->
Allow full resolution only on:
- click
- hover prefetch for nearby/visible chip
- keyboard focus on chip
- bounded idle-time prefetch for the first small visible set

## Hard limits <!-- oc:id=sec_af -->
### Per-message prefetch budget <!-- oc:id=sec_ag -->
- pre-resolve at most first 3-5 visible citations for likely interaction
- cap background concurrency to low single digits
- cancel or pause prefetch when user scrolls/types/navigates

### Offscreen handling <!-- oc:id=sec_ah -->
- offscreen citations stay unresolved until they enter viewport or are interacted with
- collapsed long messages should not resolve hidden citations

## Cache policy <!-- oc:id=sec_ai -->
### What to cache <!-- oc:id=sec_aj -->
Cache resolved locator result keyed by:
- `locatorId` or serialized locator hash
- document extraction version / corpus version
- optional viewer/text-layer version when needed for overlay compatibility

### Cache invalidation <!-- oc:id=sec_ak -->
Invalidate on:
- document re-ingest or extraction version change
- document deletion/staleness
- locator contract version incompatibility

## Large message behavior <!-- oc:id=sec_al -->
### Mount path <!-- oc:id=sec_am -->
For messages with many citations:
1. parse stream tokens <!-- oc:id=item_aa -->
1. render text + chips <!-- oc:id=item_ab -->
1. hydrate only visible chip metadata <!-- oc:id=item_ac -->
1. lazily resolve exact jump targets on demand <!-- oc:id=item_ad -->

### User-visible cues <!-- oc:id=sec_an -->
- unresolved-but-not-broken chips should look normal and become interactive once clicked
- optionally show subtle loading state only after interaction, not on initial mount
- degraded states remain explicit after resolution attempt completes

## Relationship to viewer performance <!-- oc:id=sec_ao -->
- citation click should resolve target first, then ask viewer to jump
- viewer should not pre-open or pre-highlight all cited pages
- repeated clicks to same locator should hit cache and avoid repeat work

## Failure prevention <!-- oc:id=sec_ap -->
### Forbidden behavior <!-- oc:id=sec_aq -->
- resolving every citation in a 50+ citation answer before first paint
- blocking chat scroll on precomputation
- eager opening of multiple documents/pages to warm citations
- silently dropping unresolved chips to reduce work

### Acceptable behavior <!-- oc:id=sec_ar -->
- delayed first interaction on a never-before-resolved citation with visible spinner
- page fallback from cached degraded result
- bounded idle prefetch of likely-nearby citations

## Suggested implementation shape <!-- oc:id=sec_as -->
- parser emits cheap `GroundedCitationRef`
- resolver service exposes async `resolveCitation(ref, options)`
- UI layer keeps per-chip status atom/cache
- optional viewport observer drives low-budget prefetch for visible citations only

## QA mapping <!-- oc:id=sec_at -->
Scenario: message with many citations
- open heavy grounded answer
- verify chips render before exact targets resolve
- interact with one chip
- confirm only that chip and bounded nearby set resolve
- confirm repeated interaction is cache hit

## Acceptance check <!-- oc:id=sec_au -->
- lazy resolution policy specified: yes
- bounded prefetch/concurrency specified: yes
- cache/invalidation rules specified: yes
- eager overload path explicitly forbidden: yes