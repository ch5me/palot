# Local Agents Policy <!-- oc:id=sec_aa -->

## Dev Services <!-- oc:id=sec_ab -->

All long-running local services in this repo must be launched through root `devmux` commands.

- Use `bun run dev`, `bun run dev:web`, `bun run dev:server`, `bun run dev:desktop`, or `bun run dev:desktop:wayland`.
- Do not start `vite`, `electron-vite`, Bun servers, or other foreground dev processes directly unless you are actively editing that service definition.
- If you need logs, use `bun run svc:attach -- <service>`.
- If you need status, use `bun run svc:status`.
- `packages/ui` no longer owns a local Storybook. Generic UI stories live in `~/src/ch5/ch5-packages` main/effects Storybooks.
- When adding new services, add them to `devmux.config.json` first, then add a root wrapper script in `package.json`, then document the service here.
