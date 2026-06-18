# Forgejo Workflows

Palot CI/release authority lives in `.forgejo/workflows/`. GitHub is a mirror;
there are no active `.github/workflows` files.

Workflow map:

- `ci.yml`: lint, no-elf-ui-shim guard, typecheck, build.
- `build.yml`: manual Electron build/package matrix.
- `release.yml`: main/manual release path, version changesets, package artifacts,
  tag, create Forgejo release, upload release assets through Forgejo API.
- `changeset-check.yml`: PR warning when user-facing work lacks a changeset.
- `security.yml`: dependency audit for high/critical vulnerabilities.
- `turbo-remote-cache-proof.yml`: remote-cache proof for the server build path.

CodeQL exception: GitHub CodeQL upload depends on GitHub code-scanning APIs and
`github/codeql-action/*`, so it is not active on Forgejo. Until Forgejo has a
CodeQL-compatible SARIF/code-scanning surface, Palot uses the Forgejo dependency
audit workflow as the active security gate.
