# Local managed verification

Overlay harness output captured at `.sisyphus/evidence/final-qa/browser-overlay-capture.html`.

This session did not complete a full live local agent/browser run; no end-to-end browser automation proof yet.

Current status:
- dev services running (`bun run svc:status`)
- overlay static capture proof exists
- real dispatcher exists for navigate/open/tabs only
- no verified live OpenCode plugin load path or real tool call from an agent into a lane in this repo yet

Blockers for true T19 proof:
1. No wired runtime path from spawned OpenCode server to load `apps/desktop/.opencode/plugins/palot-bridge.js` automatically in the managed desktop flow.
2. No executable harness in repo yet that opens a session, invokes Palot plugin tools through a real OpenCode agent, and captures the browser panel output.
3. Click/type/scroll dispatcher paths still placeholders; only navigate/open/tabs have real dispatch.

Static overlay artifact excerpt follows:

```html
<div class="pointer-events-none absolute inset-0 z-10 overflow-hidden"><div class="absolute left-3 top-3 rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">Click · left</div><div class="absolute right-3 top-[4.25rem] rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700">Drift detected</div><div class="absolute left-0 top-0 h-4 w-4 rounded-full border-2 border-foreground bg-background/90 shadow transition-transform duration-150 opacity-100 scale-110" style="transform:translate3d(130px, 170px, 0)"></div><div class="absolute left-0 top-0 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/40 bg-foreground/5" style="transform:translate3d(130px, 170px, 0)"></div><div class="absolute bottom-3 left-3 max-h-28 w-64 overflow-auto rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur"><div class="truncate">1. move</div><div class="truncate">2. Click · left</div></div></div>
```
