# Local Agents Policy <!-- oc:id=sec_aa -->

## Dev Services <!-- oc:id=sec_ab -->

All long-running local services in this repo must be launched through root `devmux` commands.

- Use `bun run dev`, `bun run dev:web`, `bun run dev:server`, `bun run dev:desktop`, `bun run dev:desktop:wayland`, or `bun run dev:storybook`.
- Do not start `vite`, `electron-vite`, Storybook, Bun servers, or other foreground dev processes directly unless you are actively editing that service definition.
- If you need logs, use `bun run svc:attach -- <service>`.
- If you need status, use `bun run svc:status`.
- Storybook service lives in `devmux` as `storybook` and binds to port `11001` in main repo instances.
- When adding new services, add them to `devmux.config.json` first, then add a root wrapper script in `package.json`, then document the service here.