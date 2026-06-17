## Task 6 Browser Manual Proof

- Date: 2026-06-14
- Runtime: browser-mode dev via `bun run dev`
- Services observed: `server` on `30206`, `web` on `20883`
- Browser control path: local Google Chrome via AppleScript + live DOM inspection
- Screenshot: `.sisyphus/evidence/task-6-browser-proof.png`
- Browser lane tooling status: unavailable for this session (`browser_status` returned `unbound_session`), so proof used the real local runtime surface instead of the bound browser lane

### Environment proof

- `bun run svc:status` showed `server`, `web`, and `storybook` running before the browser checks
- `http://127.0.0.1:20883` returned Vite HTML successfully
- OpenCode project lookup on `http://127.0.0.1:4096/project` included `/Users/hassoncs/src/ch5/palot`
- Scoped session lookup on `http://127.0.0.1:4096/session` with `x-opencode-directory: /Users/hassoncs/src/ch5/palot` showed real Palot sessions, including `ses_13795b8e7ffeyZLz6rmfFEv2Yg` (`Palette layout redesign`) and `ses_13720cba3ffe9aBe7846oh7p7V` (`manual proof matrix (@sisyphus-junior subagent)`)

### Browser-mode proof steps

1. Opened `http://127.0.0.1:20883/#/project/palot/session/ses_13795b8e7ffeyZLz6rmfFEv2Yg` in Chrome.
2. Confirmed live session shell rendered with header pills `Doc closed` and `Utility closed`.
3. Confirmed utility lane tab rail existed at the far right with real tabs titled `Browser`, `Files`, `Terminal`, `Editor`, `Plugins`, `Bridges`, `Contacts / CRM`, `Voice`, `Oracle Roster`, `Claude Code`.
4. Confirmed document lane rendered independently below the utility lane area and initially showed `Studio / Office` content for this session.
5. Clicked utility tab `Files` via live DOM/Chrome automation.
6. Confirmed utility content switched to Files while the document lane stayed on `Studio / Office`.
7. Opened command palette and clicked `PDF Review` from the `Surfaces` section.
8. Confirmed document lane switched from `Studio / Office` to `PDF Review` while utility lane stayed on `Files`.
9. Opened command palette and clicked `Disable PDF Review Surface` while `PDF Review` was active.
10. Confirmed document lane fell back from `pdf-review` to `studio` instead of leaving an empty broken pane.
11. Forced session route change to `#/project/palot/session/ses_13720cba3ffe9aBe7846oh7p7V`.
12. Confirmed session switch preserved a valid document lane (`Doc · studio`) and utility lane stayed closed.

### What the live browser runtime proved

- Three-pane composition is real in browser mode: center chat/task area, independent utility lane, independent document lane.
- Utility lane coexistence is real: `Files` rendered while document lane simultaneously rendered `Studio / Office`, then later `PDF Review`.
- Document surface switching is real: `Studio / Office` -> `PDF Review` happened on the live runtime, not only in Storybook/tests.
- Unavailable-surface fallback is real: disabling active `PDF Review` immediately fell back to `Studio / Office`, and the header pill changed from `Doc · pdf-review` to `Doc · studio`.
- Session switch restore path is partially proved: switching to another live Palot session preserved a valid doc lane state (`studio`) instead of landing in an empty or broken document pane.

### Exact browser observations captured from the live DOM

- Initial live session text included `Doc closed`, `Utility closed`, `Studio / Office`, and browser utility content `Profile waiting`.
- After switching utility to Files, live text included `Files`, `Directory listing is only available in Electron mode`, and still included `Studio / Office` document content.
- After opening PDF Review, live text included `Doc · pdf-review`, `PDF Review`, `Shared locator contract v1`, and `Next slices`, while the utility tab list still showed `Files` as selected.
- After disabling PDF Review, live text included `Doc · studio`, `Studio / Office`, and no longer included `PDF Review` or `Shared locator contract v1`.
- After forced session switch, live route changed to `#/project/palot/session/ses_13720cba3ffe9aBe7846oh7p7V` and the page still showed `Doc · studio` with `Files` utility content.

### Browser-mode limitations / honest caveats

- Bound browser lane tooling was unavailable, so this proof used OS-level automation against the real Chrome window plus DOM reads.
- The browser screenshot is whole-screen evidence; the exact state details are additionally captured in the textual observations above because screenshot-only proof is not sufficient.
- The live Palot session already had `Studio / Office` active on load, so the browser proof established switching and fallback behavior from a real existing state rather than from a blank brand-new session.
