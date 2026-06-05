# Task 21 — Desktop-only schema leak audit <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Identify fields or concepts that would contaminate shared PDF review contracts with desktop-renderer specifics.

## Leak candidates to reject from shared schema <!-- oc:id=sec_ac -->
- viewport pixel rects or CSS box coordinates
- DOM node ids / text-layer span ids
- Electron IPC channel names or preload API handles
- side-panel tab ids and command-palette command ids
- chat composer insertion state, menu anchor positions, hover booleans
- current scrollTop, viewport width/height, or zoom UI state as durable grounding fields
- browser event payloads (`MouseEvent`, `Selection`, etc.)

## Allowed shared equivalents <!-- oc:id=sec_ad -->
- document-space rects in stable units (`pdf-points`)
- logical `documentId`, page, quote, context selectors
- logical degraded state enums
- durable source/provenance references

## Review verdict <!-- oc:id=sec_ae -->
No required shared contract from T5/T8/T15/T18 needs a desktop-only field.
Known desktop concepts belong in adapters only.

## If a leak appears later <!-- oc:id=sec_af -->
- relocate it into desktop viewer adapter types
- or version it as explicit optional extension with platform scope note
- never make portable consumers depend on it

## Acceptance check <!-- oc:id=sec_ag -->
- desktop-only behavior leaks identified explicitly: yes
- relocation/versioned-exception rule documented: yes