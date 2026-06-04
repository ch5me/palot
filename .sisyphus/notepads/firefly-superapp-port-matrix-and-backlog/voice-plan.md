# Voice Plan <!-- oc:id=sec_aa -->

## Current repo reality <!-- oc:id=sec_ab -->

- No voice runtime or microphone backend exists in the desktop app.
- The shared UI package already has a generic `voice-selector` component that can support future voice choice UX.
- There is no existing speech, recording, transcription, or TTS service seam in renderer or main process.

## Decision <!-- oc:id=sec_ac -->

Voice should start as an input-only proof shell.

## Why <!-- oc:id=sec_ad -->

- There is no speech backend to justify a fuller workflow now.
- The first question is whether voice belongs in the shell at all, not which provider/runtime to standardize on.
- A lightweight proof surface can preserve the seam without pretending recording/transcription already exists.

## First shell shape <!-- oc:id=sec_ae -->

- Add a `voice` Firefly side-panel surface.
- Show future voice input intent, likely devices/voice-choice placeholders, and the explicit defer note for recording/transcription.
- Reuse shared voice UI primitives only when needed for shell proof, not for a fake runtime.

## Domain logic decision <!-- oc:id=sec_af -->

Do not port `src/lib/voice.ts` yet.

Reason:
- No corresponding backend or runtime exists in Elf
- Porting domain logic now would be speculative.
- Real voice work should start only when a concrete recording / STT / TTS lane is chosen.