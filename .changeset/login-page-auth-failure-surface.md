---
"@ch5me/elf-desktop": patch
---

Surface login-page auth failures instead of silently returning to idle.

- `handleSignIn` now binds the error from `window.elf.auth.signIn()` and
  transitions to the existing error screen with the actual failure
  message (network failure, server 5xx, IPC error, etc.) instead of
  resetting to idle with zero feedback.
- `pollForToken` adds an `else` branch for any error other than the two
  known sentinel strings (`sign_in_denied` / `sign_in_expired`) so a
  dropped network mid-poll no longer leaves the user stuck on the
  pending screen with a dead verification code.

Fixes the silent-failure UX in `LoginPage` (CH5COMPAC4C-244).