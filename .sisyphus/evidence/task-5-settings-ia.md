# Task 5 Settings IA <!-- oc:id=sec_aa -->

Decision: MCP connections get a first-class settings route.

## Placement <!-- oc:id=sec_ab -->

- route: `/settings/connections`
- tab id: `connections`
- primary surface: settings connections

## Rationale <!-- oc:id=sec_ac -->

- Provider settings already handle credential/setup workflows, so Connections belongs beside Providers in Settings.
- MCP setup is persistent account/config work, not transient per-session posture.
- A dedicated settings route avoids burying install/auth/setup under the read-only plugins surface.