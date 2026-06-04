# Superapp Retirement Audit <!-- oc:id=sec_aa -->

## Outcome <!-- oc:id=sec_ab -->

Do not treat the old superapp as fully retired yet.

## Why <!-- oc:id=sec_ac -->

The shell-level port is broad, but several high-value surfaces remain proof-grade rather than production-complete:
- Browser
- Notes
- Pulse
- Memory
- Files/Terminal/Editor/Plugins/Bridges/CRM/Studio/Voice/Oracle/Claude now exist as shells, but most domain/runtime logic is still intentionally deferred.

## What is effectively retired <!-- oc:id=sec_ad -->

The old superapp no longer needs to be the place where new desktop shell work happens.
Palot is now the canonical implementation base for:
- surface registry / flags / persistence
- first shell presence for the major Firefly lanes
- onboarding/migration compatibility work
- project/session orchestration

## What still blocks full retirement <!-- oc:id=sec_ae -->

Full retirement should wait until the user-facing product behavior is good enough in Palot for the core desired lanes, especially:
- notes durability
- browser usefulness
- pulse/runtime telemetry
- memory backend contract
- any high-priority runtime behind Files/Terminal/Editor that users actually rely on

## Recommendation <!-- oc:id=sec_af -->

Retire the old repo as the place for new feature work now.
Do not claim feature-complete retirement until the remaining proof shells either become real features or are explicitly dropped.