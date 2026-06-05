# Browser Lane Evidence <!-- oc:id=sec_aa -->

Capture helpers:

- `scripts/browser-lane/capture-proof --lane default --kind stream --url http://127.0.0.1:3901`
- `scripts/browser-lane/capture-websocket-ready --lane default --url http://127.0.0.1:3901`
- `scripts/browser-lane/capture-cdp-version --lane default --url http://127.0.0.1:9229/json/version`

Conventions:

- Save all artifacts under `.sisyphus/evidence/browser-lanes/`.
- Use `<lane>-<kind>.txt` or task-specific filenames from plan QA steps.
- Failed calls should still write artifacts with error payloads.