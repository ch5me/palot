#!/usr/bin/env bash
# ci-preflight — run the gates CI runs, locally, fail-fast.
#
# Why: branch CI on GitHub is expensive (Palot's build.yml packages a 4-platform
# Electron matrix — mac x2 + Windows + Linux — at heavy runner-minute multipliers).
# Run this before you push so you only spend CI on commits already confident green.
# Mirrors the gating jobs of .github/workflows/ci.yml (lint/typecheck) + build.yml's
# build-js step.
#
# Usage:  scripts/ci-preflight.sh        (or: bun run preflight)
#
# v1 runs the FULL gate set. A future v2 will use `ch5 affected` to run only the
# packages impacted by the current git diff (see ch5-packages
# docs/ci-preflight-and-diff-selection.md).
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }

run() {
	local name="$1"; shift
	bold "▶ $name"
	local start=$SECONDS
	if "$@"; then
		green "✓ $name ($((SECONDS - start))s)"
	else
		red "✗ $name FAILED ($((SECONDS - start))s) — fix this before pushing"
		exit 1
	fi
}

bold "Palot CI preflight (mirrors GitHub CI gates)"
echo

run "install (frozen lockfile)" bun install --frozen-lockfile
run "lint (biome)"              bun run lint
run "check-types"               bun run check-types
run "build (turbo, all)"        bun run build

echo
green "✅ Palot preflight GREEN — safe to push."
