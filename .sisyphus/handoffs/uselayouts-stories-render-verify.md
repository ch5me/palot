# Handoff: render-verify the 26 new Storybook stories in packages/ui

**Repo:** ~/src/ch5/palot, branch `main`, start from tip (≥ `e747fdf8`). `git pull --rebase` first.
**Context:** uselayouts → elf-ui port is done and pushed. 26 components ported
(`src/components/animate/` 17, `src/components/marketing/` 9), Storybook stood up
(`455513d5`), one co-located `*.stories.tsx` per component committed (`e747fdf8`).
Each story file passed `tsgo --noEmit` + biome individually, **but the render-verification
pass never ran** (session limit killed it). Stories can build green yet crash or render blank
— presence in index.json is not proof.

## Task (the only outstanding work)

1. `cd packages/ui && bunx tsgo --noEmit && bunx biome check .` — must be clean.
2. `bun run build-storybook` — must succeed; `storybook-static/index.json` must list stories
   for all 26 components + pre-existing button stories.
3. Render-verify EVERY new story: serve `storybook-static/`, headlessly screenshot each
   story iframe (`iframe.html?id=<storyId>`; add `&globals=theme:dark` — capture all in dark,
   spot-check 3–4 in light). Save to /tmp/sb-verify/. Fail = blank/near-empty frame, error
   overlay, or uncaught console error.
4. Fix failures in the STORY files (args, stage/container wrappers). If a failure traces to a
   real bug in a ported component, fix minimally in that component file and note it.
   Never touch pre-existing components (button, dialog, etc.). No `as any`/ts-ignore.
5. Kill any server you started. Re-run until all 26 render.
6. Pathspec-commit fixes (`git commit -- <paths>`) + push main.
7. Append a completion entry (newest-on-top) to
   `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-completions-log.md` covering the whole
   uselayouts port stream (commits `e231fd40`, `b3f12059`, `db81dfda`, `455513d5`,
   `e747fdf8` + your fix commit), commit + push ch5-company.

## Setup facts (don't rediscover)

- SB 9.1.20 react-vite; scripts `bun run storybook` / `bun run build-storybook` (bunx inside).
- Theme: dark-first tokens; preview decorator + toolbar flip `dark`/`light` classes — no
  per-story theme hacks.
- Dual-React trap already fixed via `resolve.dedupe` in `.storybook/main.ts` — don't undo.
- Biome now actually scans packages/ui src (fixed `b3f12059`); biome pinned 2.4.15.
- Plan/decision matrix: `.sisyphus/plans/uselayouts-ui-port.md`.

## Standing policy

Dirty tree / failed git pull is NEVER a blocker — don't sit idle asking. Other agents have
live WIP in `apps/desktop`: never `git add .`, always pathspec-commit your own files only.
If push is rejected, retry after pull --rebase of clean paths or wait briefly; report honestly.
