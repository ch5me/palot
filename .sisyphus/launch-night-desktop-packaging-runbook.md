# Launch-night desktop packaging runbook <!-- oc:id=sec_aa -->

Date: 2026-06-10
Repo: `palot`
Worktree used: `/Users/hassoncs/worktrees/ch5/palot/launch-night-surface`

## Scope <!-- oc:id=sec_ab -->

Use this when replaying Firefly Client (`palot`) launch-night desktop packaging against staging or production Firefly Cloud peers.

Palot has no hosted web deploy surface tonight.
Deliverable is a desktop artifact built with env pointed at correct peer services.

## Canonical topology source <!-- oc:id=sec_ac -->

Read first:
- `/Users/hassoncs/src/ch5/ch5-company/docs/company/service-topology-env-contract.md`
- `/Users/hassoncs/src/ch5/firefly-cloud/packages/runtime-config/data/environment-targets.json`

Launch-night canonical peers:

### Staging <!-- oc:id=sec_ad -->
- auth app origin: `https://staging.app.elf.dance`
- api origin: `https://api.staging.elf.dance`
- memory endpoint: `https://staging.mem.ch5.me`
- billing UI: `https://staging.app.elf.dance/billing`

### Production <!-- oc:id=sec_ae -->
- auth app origin: `https://app.elf.dance`
- api origin: `https://api.elf.dance`
- memory endpoint: `https://mem.ch5.me`
- billing UI: `https://app.elf.dance/billing`

## Code assumptions this runbook expects <!-- oc:id=sec_af -->

These files must not contain cross-service hardcoded fallbacks anymore:
- `apps/desktop/src/main/services/auth/device-auth-client.ts`
- `apps/desktop/src/main/services/auth/sign-in-to-editor-handler.ts`
- `apps/desktop/src/main/services/cloud/firefly-runtime-client.ts`

Required env inputs:
- `FIREFLY_AUTH_HOST` or `VITE_FIREFLY_AUTH_HOST`
- `FIREFLY_API_URL` or `VITE_FIREFLY_API_URL`

Optional proof env used during launch night:
- `FIREFLY_MEMORY_ENDPOINT`
- `FIREFLY_BILLING_URL`

## Preflight <!-- oc:id=sec_ag -->

From repo root:

```bash
GIT_MASTER=1 git status --short --branch
bun install
bun test apps/desktop/src/main/services/cloud/firefly-runtime-client.test.ts
```

Notes:
- `bun run check-types` may be noisy because repo verification plumbing is not fully clean in this slice.
- If `electron-builder` is not on PATH, use `bun x electron-builder`.

## Staging packaging <!-- oc:id=sec_ah -->

Log directory:

```bash
mkdir -p .launch-night-logs
```

Run with nohup:

```bash
nohup env \
  FIREFLY_AUTH_HOST="https://staging.app.elf.dance" \
  VITE_FIREFLY_AUTH_HOST="https://staging.app.elf.dance" \
  FIREFLY_API_URL="https://api.staging.elf.dance" \
  VITE_FIREFLY_API_URL="https://api.staging.elf.dance" \
  FIREFLY_MEMORY_ENDPOINT="https://staging.mem.ch5.me" \
  FIREFLY_BILLING_URL="https://staging.app.elf.dance/billing" \
  PATH="$PWD/node_modules/.bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  bash -lc 'cd apps/desktop && bun run build && bun x electron-builder --mac --arm64 --config electron-builder.yml --publish never' \
  > .launch-night-logs/staging-package-mac-arm64.log 2>&1 &
```

Bounded poll:

```bash
python3 - <<'PY'
from pathlib import Path
p=Path('.launch-night-logs/staging-package-mac-arm64.log')
lines=p.read_text(errors='replace').splitlines() if p.exists() else ['LOG_MISSING']
print('\n'.join(lines[max(0, len(lines)-120):]))
PY
```

Success indicators in log:
- `building target=macOS zip arch=arm64`
- `building target=DMG arch=arm64`
- no active `electron-builder --mac --arm64` process remains

Artifacts:
- `apps/desktop/release/Elf-0.11.0-mac-arm64.zip`
- `apps/desktop/release/Elf-0.11.0-mac-arm64.dmg`

Hash proof:

```bash
python3 - <<'PY'
import hashlib
from pathlib import Path
for rel in ['apps/desktop/release/Elf-0.11.0-mac-arm64.zip','apps/desktop/release/Elf-0.11.0-mac-arm64.dmg']:
    p=Path(rel)
    h=hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            h.update(chunk)
    print(rel, h.hexdigest())
PY
```

## Production packaging <!-- oc:id=sec_ai -->

Run with prod peers:

```bash
nohup env \
  FIREFLY_AUTH_HOST="https://app.elf.dance" \
  VITE_FIREFLY_AUTH_HOST="https://app.elf.dance" \
  FIREFLY_API_URL="https://api.elf.dance" \
  VITE_FIREFLY_API_URL="https://api.elf.dance" \
  FIREFLY_MEMORY_ENDPOINT="https://mem.ch5.me" \
  FIREFLY_BILLING_URL="https://app.elf.dance/billing" \
  PATH="$PWD/node_modules/.bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  bash -lc 'cd apps/desktop && bun run build && bun x electron-builder --mac --arm64 --config electron-builder.yml --publish never' \
  > .launch-night-logs/prod-package-mac-arm64.log 2>&1 &
```

Poll the same way against `.launch-night-logs/prod-package-mac-arm64.log`.

## Plane update checklist <!-- oc:id=sec_aj -->

Comment on the active ticket with:
- worktree path
- HEAD SHA
- env values used for staging and prod
- exact artifact paths
- SHA256 values
- log paths
- known verification gaps

If scope is auth/env-convergence only, prefer `CLOUD000-102`.
If scope includes live end-to-end staging auth proof, prefer `CLOUD000-64`.
For this launch-night packaging run, `CLOUD000-102` is primary and `CLOUD000-64` gets pointer comment.

## Known launch-night caveats <!-- oc:id=sec_ak -->

- Palot does not have a hosted web deploy surface tonight.
- `electron-builder` may also emit x64 sibling artifacts during mac packaging.
- `bun run check-types` may fail for repo-global unrelated reasons; capture exact failure text instead of pretending clean verification.
- Keep logs under `.launch-night-logs/` and do not commit transient packaging output under `apps/desktop/release/`.