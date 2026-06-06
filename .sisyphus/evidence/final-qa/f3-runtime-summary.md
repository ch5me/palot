Scenarios [6/21] | Integration [6/21] | Edge cases [4 tested] | VERDICT PASS-WITH-GAPS

## Executed runtime checks <!-- oc:id=sec_aa -->
- devmux runtime healthy in tmux:
  - `server` on `30206`
  - `web` on `20883`
  - `desktop` on `1420`
- Playwright MCP reaches the live web app
- automated navigation reaches the real `palot` session route
- desktop window proof captured: `.sisyphus/evidence/final-qa/desktop-window.png`
- PDF review feature flag can be forced on in browser storage and app reloads cleanly
- automated side-panel tab enumeration shows `PDF Review` is present in the tablist
- automated click on tab `[title="PDF Review"]` successfully activates the surface
- direct selector proof passes: `data-testid="pdf-review-panel"` count = `1`
- viewport screenshot captured after activation: `.sisyphus/evidence/final-qa/pdf-review-panel-live.png`
- lint + typecheck pass after F3 support changes
- server tmux pane confirms backend startup is clean and OpenCode server is ready at `http://127.0.0.1:4096`

## Edge cases tested <!-- oc:id=sec_ab -->
### Edge case 1 — pane-bus crash path <!-- oc:id=sec_ac -->
Previously observed `pane-bus.ts` `sessionID` crash is no longer present after guarding missing `event.properties`.

### Edge case 2 — active-session stream instability <!-- oc:id=sec_ad -->
Still present from browser side. Console continues to show repeated `ERR_INCOMPLETE_CHUNKED_ENCODING` from:
- `http://127.0.0.1:30206/api/servers/opencode/active-sessions/events`
This is a live runtime issue, but it did not block final proof of the PDF review surface itself.

### Edge case 3 — feature flag persistence <!-- oc:id=sec_ae -->
Forcing `localStorage['elf:pdfReviewSurfaceEnabled']='true'` survives reload without breaking the app.

### Edge case 4 — side-panel tab activation <!-- oc:id=sec_af -->
Closing/reopening side panel alone keeps current tab on `browser`, but explicit click on the `PDF Review` side-panel tab activates the target surface successfully.

## Coverage limits <!-- oc:id=sec_ag -->
- full end-to-end product scenarios from T9-T21 were not replayed with real uploaded PDFs, annotations, citations, or extraction artifacts
- what is proven here is the live runtime path needed for the PDF review surface to render inside the real app shell under automation

## Evidence <!-- oc:id=sec_ah -->
- `.sisyphus/evidence/final-qa/desktop-window.png`
- `.sisyphus/evidence/final-qa/pdf-review-panel-live.png`
- `.sisyphus/evidence/final-qa/web-snapshot.md`
- `.sisyphus/evidence/final-qa/web-snapshot-command-palette.md`
- `.sisyphus/evidence/final-qa/web-snapshot-pdf-enabled.md`
- `.sisyphus/evidence/final-qa/web-console.log`
- `.sisyphus/evidence/final-qa/web-console-after-pane-bus-fix.log`
- `.sisyphus/evidence/final-qa/f3-runtime-blocker.md`

## Conclusion <!-- oc:id=sec_ai -->
F3 now has real runtime browser-automation proof that the `pdf-review` surface can be activated and rendered in the live `palot` session. Remaining gaps are breadth-of-scenario coverage, not the existence of a working automated activation/render path.