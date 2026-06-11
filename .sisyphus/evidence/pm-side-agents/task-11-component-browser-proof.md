# Task 11 browser proof <!-- oc:id=sec_aa -->

Date: 2026-06-11
Route: `http://localhost:20883/#/project-manager`
Worktree: `/Users/hassoncs/src/ch5/palot`
Proof operator: agent-browser via dedicated Chrome CDP port `9800`

## Browser binding proof <!-- oc:id=sec_ab -->
- Browser binary: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Root PID: `26255`
- User data dir: `/Users/hassoncs/.browser-profiles/ai-browser-pm-side-agents-proof`
- CDP port: `9800`
- `lsof -nP -iTCP:9800 -sTCP:LISTEN`: Chrome listening on `127.0.0.1:9800`
- Initial `/json/list`: dedicated profile with `chrome://newtab/` page plus extension background pages, then navigated to PM route on same CDP target

## Service status <!-- oc:id=sec_ac -->
- `bun run svc:status`: `server` running on `30206`, `web` running on `20883`, `desktop` down

## Dense Console default-route proof <!-- oc:id=sec_ad -->
- Opened PM route directly. `agent-browser --cdp 9800 open http://localhost:20883/#/project-manager --json` returned title `Elf` and URL `http://localhost:20883/#/project-manager`
- Default visible content was Dense Console, not Side Agents or Lineage
- Dense Console header/counters observed live:
  - `UPDATED 1s`
  - `BOXES 3`
  - `SESSIONS 67`
  - `WORK 6`
  - `READY 0`
  - `NEEDS 2`
  - `ASK 0`
  - `SCHEMA 1`
  - `FOLLOWUPS 0`
- Dense Console sections observed:
  - `NEEDS YOU` with `No decisions waiting`
  - `SESSIONS 67 LIVE`
  - `AGENTS 0`
  - `COMPLETIONS 1`
  - `NEEDS CHRIS 2`
  - `READY FRONTIER 0P 0E`
  - `FOLLOWUPS 0`
  - `BOXES 3`
- Dense Console provenance/footer observed: `ch5pm daemon /pm/state via firefly` and `PM snapshot`

## Side Agents tab proof <!-- oc:id=sec_ae -->
- Clicked `Side Agents` tab from live PM route
- Side Agents rendered all required section groups:
  - `LOOP`
  - `BOXES`
  - `DECISIONS`
  - `ACTIONS`
  - `QUEUE`
  - `REGISTRY`
- Top status/banner state observed:
  - `SIDE AGENTS`
  - `DEGRADED`
  - source/freshness badges present: `SRC:LIVE`, `SRC:DETECTED`, `FRESH:FRESH`, `AGE:0S`, `REASONS:0/2/0`
  - provenance badge summary present: `PROV:2/1/0`
  - degraded banner text present: `TERMINAL-JOBS-NEED-RECONCILE:38 · DISPATCH-QUEUE-HEALTH-DEGRADED`
- Loop card observed:
  - `RUNNING / HEALTH`
  - `SOURCE:HEALTH`
  - `SEEN:0S`
  - `interval 180s`
  - `passes 16`
  - `last run 1m · 2026-06-11T10:15:49.090Z`
  - `last digest 4m · 2026-06-11T10:12:49.086Z`
- Boxes card observed:
  - `2 LIVE`
  - `REGISTRY:3`
  - `laptop` box: `68 SESSIONS`, `MODEL-PASS:NONE`, `IDLE:41`, `HEALTHY:11`, `WEDGED:5`, `ABORTED:3`, `DECISION-NEEDED:3`, `LOOPING:3`, `STALE-SKIP:2`
  - laptop warning visible: `model pass failed: model pass timed out after 120000ms`
  - `macmini` box: `25 SESSIONS`, `MODEL-PASS:RAN`, `IDLE:19`, `DECISION-NEEDED:3`, `HEALTHY:3`
- Decisions card observed:
  - header `42 LIVE / PRESENT`
  - rows show provenance badges like `SRC:ATTENTION` and `SRC:MODEL-PASS`
  - visible decision-needed items include `pm-CH5COMPAC4C-347`, `Cloudflare Memory and CH5 definition lookup`, `LAUNCH: Folio staging+prod redeploy + peer wiring`, `pm-CH5COMPAC4C-318`, `pm-CLOUD000-51`, `pm-CH5COMPAC4C-296`
  - visible non-attention/model-pass health rows include `pm-CLOUD000-100` and `pm-CLOUD000-44` with model error text
- Actions card observed:
  - header `200 RECENT`
  - rows include `escalate-cap-exceeded`, `surface`, `resume`, `unwedge`
  - status pills visible: `OK`, `FAILED`
- Queue card observed:
  - header `83 JOBS / 0 CLAIMS`
  - queue source badges visible: `SRC:DETECTED`, `FRESH:FRESH`, `AGE:0S`, `REASONS:2`, `REGISTRY:6`
  - queue group labels visible: `FAILED`, `OTHER`
  - queue examples visible: `CLOUD000-48 timed-out` plus several `succeeded` rows
- Registry card observed:
  - header `11 KNOWN`
  - summary badges `LIVE:3`, `DETECTED:6`, `STATIC:2`
  - provenance/doc badges visible on rows: `SRC:DETECTED`, `CHARTER:DURABLE-CHARTER`, `LINK:DOC`, plus `CHARTER:UNKNOWN` and `no doc authority` where expected
  - static rows visible for `MergeQueue` and `Frontier Curator`

## Issues observed <!-- oc:id=sec_af -->
- Default PM route worked and defaulted to Dense Console. No route failure.
- Side Agents worked with loud degraded state instead of silently passing stale/missing queue health.
- Counts drifted during proof: Dense Console showed `SESSIONS 67`; Side Agents box card later showed `laptop 68 SESSIONS`. Live state appears to refresh independently across tabs. Treat as expected live drift, not proof failure.
- Side Agents tab does not expose obvious selected-state attributes (`aria-selected` absent on `Dense Console` / `Side Agents` / `Lineage` tab nodes). Visual behavior still switched panes correctly.

## Artifacts <!-- oc:id=sec_ag -->
- Screenshot: `.sisyphus/evidence/pm-side-agents/pm-route-dense-console.png`
- Screenshot: `.sisyphus/evidence/pm-side-agents/pm-route-side-agents.png`