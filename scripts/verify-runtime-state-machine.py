#!/usr/bin/env python3
"""Verify the OpenCode runtime state machine document.

Checks that the state machine doc contains all required runtime modes,
required states, and that cited source file paths exist on disk.

Usage:
    python3 scripts/verify-runtime-state-machine.py \
        --doc docs/opencode-runtime-state-machine.md \
        --required-mode bundled-local \
        --required-mode existing-local \
        --required-mode remote-http \
        --required-state bundled-missing \
        --required-state bundled-broken-repairable \
        --required-state remote-offline \
        --required-state legacy-upgrade \
        --check-paths
"""

import argparse
import os
import re
import sys
from pathlib import Path


def parse_markdown_tables(content: str) -> dict[str, list[dict[str, str]]]:
    """Parse markdown tables grouped by the preceding ## heading.

    Returns a dict mapping section name to a list of row dicts.
    Each row dict maps column header to cell value.
    """
    sections: dict[str, list[dict[str, str]]] = {}
    current_section = "__preamble__"
    current_rows: list[list[str]] = []
    current_headers: list[str] = []

    for line in content.splitlines():
        heading_match = re.match(r"^##\s+(.+)", line)
        if heading_match:
            if current_headers and current_rows:
                _flush_table(sections, current_section, current_headers, current_rows)
            current_section = heading_match.group(1).strip()
            current_headers = []
            current_rows = []
            continue

        stripped = line.strip()
        if not stripped.startswith("|"):
            if current_headers and current_rows:
                _flush_table(sections, current_section, current_headers, current_rows)
                current_headers = []
                current_rows = []
            continue

        cells = [c.strip() for c in stripped.split("|")[1:-1]]
        if not cells:
            continue

        if all(re.match(r"^[-:]+$", c) for c in cells):
            continue

        if not current_headers:
            current_headers = cells
        else:
            current_rows.append(cells)

    if current_headers and current_rows:
        _flush_table(sections, current_section, current_headers, current_rows)

    return sections


def _flush_table(
    sections: dict[str, list[dict[str, str]]],
    section: str,
    headers: list[str],
    rows: list[list[str]],
) -> None:
    parsed = []
    for row in rows:
        entry = {}
        for i, header in enumerate(headers):
            entry[header] = row[i].strip() if i < len(row) else ""
        parsed.append(entry)

    if section not in sections:
        sections[section] = []
    sections[section].extend(parsed)


def extract_backtick_ids(text: str) -> set[str]:
    """Extract all backtick-quoted identifiers from text."""
    return set(re.findall(r"`([^`]+)`", text))


def extract_mode_ids(sections: dict[str, list[dict[str, str]]]) -> set[str]:
    """Extract mode IDs from the Runtime modes table."""
    modes = set()
    for section_name, rows in sections.items():
        if "mode" in section_name.lower() and "runtime" in section_name.lower():
            for row in rows:
                for value in row.values():
                    ids = re.findall(r"`([^`]+)`", value)
                    modes.update(ids)
    return modes


def extract_state_ids(sections: dict[str, list[dict[str, str]]]) -> set[str]:
    """Extract state IDs from onboarding and persistent settings tables."""
    states = set()
    state_section_keywords = ["state", "onboarding", "persistent", "settings"]
    for section_name, rows in sections.items():
        lower = section_name.lower()
        if not any(kw in lower for kw in state_section_keywords):
            continue
        for row in rows:
            for value in row.values():
                ids = re.findall(r"`([^`]+)`", value)
                for candidate in ids:
                    if re.match(r"^[a-z][a-z0-9-]*$", candidate):
                        states.add(candidate)
    return states


def extract_onboarding_state_ids(
    sections: dict[str, list[dict[str, str]]],
) -> set[str]:
    """Extract state IDs from onboarding states table only."""
    states = set()
    for section_name, rows in sections.items():
        lower = section_name.lower()
        if "onboarding" not in lower:
            continue
        for row in rows:
            for value in row.values():
                ids = re.findall(r"`([^`]+)`", value)
                for candidate in ids:
                    if re.match(r"^[a-z][a-z0-9-]*$", candidate):
                        states.add(candidate)
    return states


def extract_transition_states(sections: dict[str, list[dict[str, str]]]) -> set[str]:
    """Extract state IDs referenced in transition tables."""
    states = set()
    for section_name, rows in sections.items():
        if "transition" not in section_name.lower():
            continue
        for row in rows:
            for key in ("From", "To"):
                if key in row:
                    val = row[key].strip()
                    if re.match(r"^[a-z][a-z0-9-]*$", val):
                        states.add(val)
    return states


def extract_cited_paths(sections: dict[str, list[dict[str, str]]]) -> list[str]:
    """Extract file paths from the Source file references table."""
    paths = []
    path_prefixes = ("apps/", "packages/", "docs/", "scripts/", "src/")
    for section_name, rows in sections.items():
        if "reference" not in section_name.lower() and "source" not in section_name.lower():
            continue
        for row in rows:
            for value in row.values():
                for prefix in path_prefixes:
                    if value.startswith(prefix):
                        paths.append(value)
                        break
    return paths


def verify_required_modes(
    found_modes: set[str], required: list[str]
) -> list[str]:
    """Check that all required modes are present."""
    errors = []
    for mode in required:
        if mode not in found_modes:
            errors.append(f"Missing required mode: {mode}")
    return errors


def verify_required_states(
    found_states: set[str], required: list[str]
) -> list[str]:
    """Check that all required states are present."""
    errors = []
    for state in required:
        if state not in found_states:
            errors.append(f"Missing required state: {state}")
    return errors


def verify_paths(repo_root: Path, paths: list[str]) -> list[str]:
    """Check that all cited file paths exist on disk."""
    errors = []
    for p in paths:
        full = repo_root / p
        if not full.exists():
            errors.append(f"Cited path does not exist: {p}")
    return errors


def verify_transition_coverage(
    defined_states: set[str], transition_states: set[str]
) -> list[str]:
    """Check that every defined state appears in at least one transition."""
    errors = []
    for state in defined_states:
        if state not in transition_states:
            errors.append(
                f"State '{state}' is defined but has no transitions"
            )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify the OpenCode runtime state machine document."
    )
    parser.add_argument(
        "--doc",
        required=True,
        help="Path to the state machine markdown document.",
    )
    parser.add_argument(
        "--required-mode",
        action="append",
        default=[],
        help="Required runtime mode ID (repeatable).",
    )
    parser.add_argument(
        "--required-state",
        action="append",
        default=[],
        help="Required state ID (repeatable).",
    )
    parser.add_argument(
        "--check-paths",
        action="store_true",
        help="Verify that cited source file paths exist on disk.",
    )
    parser.add_argument(
        "--repo-root",
        default=None,
        help="Repo root for path checks (defaults to parent of scripts/).",
    )
    args = parser.parse_args()

    doc_path = Path(args.doc)
    if not doc_path.exists():
        print(f"ERROR: Document not found: {doc_path}", file=sys.stderr)
        return 1

    content = doc_path.read_text(encoding="utf-8")
    sections = parse_markdown_tables(content)

    found_modes = extract_mode_ids(sections)
    found_states = extract_state_ids(sections)
    onboarding_states = extract_onboarding_state_ids(sections)
    transition_states = extract_transition_states(sections)

    all_errors: list[str] = []

    all_errors.extend(verify_required_modes(found_modes, args.required_mode))
    all_errors.extend(verify_required_states(found_states, args.required_state))
    all_errors.extend(
        verify_transition_coverage(onboarding_states, transition_states)
    )

    if args.check_paths:
        if args.repo_root:
            repo_root = Path(args.repo_root)
        else:
            repo_root = doc_path.resolve().parent.parent
        cited_paths = extract_cited_paths(sections)
        all_errors.extend(verify_paths(repo_root, cited_paths))

    found_mode_list = sorted(found_modes)
    found_state_list = sorted(found_states)
    print(f"Found {len(found_mode_list)} mode(s): {', '.join(found_mode_list) or '(none)'}")
    print(f"Found {len(found_state_list)} state(s): {', '.join(found_state_list) or '(none)'}")
    print(f"Found {len(transition_states)} state(s) referenced in transitions")

    if all_errors:
        print(f"\nFAILED with {len(all_errors)} error(s):")
        for err in all_errors:
            print(f"  - {err}")
        return 1

    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
