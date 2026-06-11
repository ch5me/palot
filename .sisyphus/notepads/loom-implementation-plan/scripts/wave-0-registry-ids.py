#!/usr/bin/env python3
"""Phase 0 surgical edits to firefly-surface-registry.tsx."""
import re
import sys

PATH = 'apps/desktop/src/renderer/firefly-surface-registry.tsx'
with open(PATH) as f:
    src = f.read()

# Add `manifestId:` after each `id: '<x>',` line. Use the Surface's id as the suffix.
def add_manifest_id(m):
    full_line = m.group(0)
    sid = m.group(1)
    indent = m.group('indent')
    return full_line + f"\n{indent}manifestId: 'firefly.built-in.surface.{sid}',"

pattern = re.compile(
    r"^(?P<indent>\t\t)id: '(?P<sid>[a-z\-]+)',$",
    re.MULTILINE,
)
new_src, n = pattern.subn(add_manifest_id, src)
print(f'updated {n} entries', file=sys.stderr)

# Append FIREFLY_SURFACE_IDS + labels + defaults before the FIREFLY_SURFACE_REGISTRY_BY_ID export
sidecar_export = """
/**
 * Single source of truth for the 18 side-panel surface ids.
 * Used to derive SidePanelTabId, palotSidePanelTabSchema, and the JSON sidecar
 * the runtime plugin reads (apps/desktop/src/renderer/firefly-surface-registry-ids.json).
 */
export const FIREFLY_SURFACE_IDS = FIREFLY_SURFACE_REGISTRY.map((surface) => surface.id) as readonly SidePanelTabId[]

export const FIREFLY_SURFACE_DEFAULT_ON = Object.fromEntries(
\tFIREFLY_SURFACE_REGISTRY.map((surface) => [surface.id, surface.defaultOn]),
) as Readonly<Record<SidePanelTabId, boolean>>

export const FIREFLY_SURFACE_LABELS = Object.fromEntries(
\tFIREFLY_SURFACE_REGISTRY.map((surface) => [surface.id, surface.title]),
) as Readonly<Record<SidePanelTabId, string>>
"""

marker = 'export const FIREFLY_SURFACE_REGISTRY_BY_ID'
if marker not in new_src:
    print('marker not found!', file=sys.stderr)
    sys.exit(1)
new_src = new_src.replace(marker, sidecar_export.lstrip() + '\n' + marker, 1)

with open(PATH, 'w') as f:
    f.write(new_src)
print('done')
