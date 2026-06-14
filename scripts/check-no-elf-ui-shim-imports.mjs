#!/usr/bin/env node
/**
 * Guard: fail if anything re-introduces the burned-down `@ch5me/elf-ui` shim
 * surface. The 133 pass-through component shims were deleted on 2026-06-14;
 * UI now comes directly from `@ch5me/ch5-ui-web` / `@ch5me/agent-ui-web`.
 *
 * elf-ui only exposes `./styles/globals.css` now, so `@ch5me/elf-ui/components/*`,
 * `/hooks/*`, and `/lib/*` no longer resolve — re-importing them would fail at
 * build/typecheck anyway, but this gives a clear, early, intentional error.
 *
 * Usage: node scripts/check-no-elf-ui-shim-imports.mjs
 * Exit 0 = clean, 1 = violations found.
 */
import { execFileSync } from "node:child_process"

const FORBIDDEN = "@ch5me/elf-ui/(components|hooks|lib)/"

let matches = ""
try {
	// ripgrep is available in CI bun images and locally; fall back to git grep.
	matches = execFileSync(
		"rg",
		["-n", "--no-heading", FORBIDDEN, "apps", "packages"],
		{ encoding: "utf8" },
	)
} catch (err) {
	// rg exits 1 when there are no matches — that's success for us.
	if (err.status === 1) matches = ""
	else {
		try {
			matches = execFileSync(
				"git",
				["grep", "-nE", FORBIDDEN, "--", "apps", "packages"],
				{ encoding: "utf8" },
			)
		} catch (gitErr) {
			if (gitErr.status === 1) matches = ""
			else throw gitErr
		}
	}
}

if (matches.trim()) {
	console.error(
		"✗ Forbidden elf-ui shim imports found. UI lives in @ch5me/ch5-ui-web /\n" +
			"  @ch5me/agent-ui-web — import from those directly, not @ch5me/elf-ui/*.\n",
	)
	console.error(matches)
	process.exit(1)
}

console.log("✓ no @ch5me/elf-ui shim imports (components/hooks/lib)")
