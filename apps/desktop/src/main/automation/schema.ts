/**
 * Drizzle ORM schema for automation tables and extension package tables.
 *
 * Automation tables store scheduling state and run history.
 * Automation config lives on disk as JSON + prompt.md files;
 * SQLite only holds timing and execution state.
 *
 * Extension tables (§7.1) store immutable package bytes provenance
 * (ExtensionPackage) and mutable installation state (ExtensionInstallation).
 */

import { index, int, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const automations = sqliteTable("automations", {
	id: text("id").primaryKey(),
	nextRunAt: int("next_run_at"),
	lastRunAt: int("last_run_at"),
	runCount: int("run_count").notNull().default(0),
	consecutiveFailures: int("consecutive_failures").notNull().default(0),
	createdAt: int("created_at").notNull(),
	updatedAt: int("updated_at").notNull(),
})

// ---------------------------------------------------------------------------
// Extension package tables (Firefly Plugin Marketplace §7.1)
// ---------------------------------------------------------------------------

/**
 * ExtensionPackage — immutable record per unique VSIX sha256.
 *
 * Created once per content-addressed unpack and never mutated.
 * `vsixPath` is the original VSIX file path (may be null for remote downloads
 * after the file is cleaned up). `unpackedPath` is the content-addressed
 * directory under userData.
 */
export const extensionPackages = sqliteTable(
	"extension_packages",
	{
		/** Content-addressed SHA-256 of the VSIX bytes (primary key). */
		id: text("id").primaryKey(),
		/** Canonical `publisher.name` external id (e.g. "zhuangtongfa.material-theme"). */
		externalId: text("external_id").notNull(),
		/** Publisher as declared in package.json. */
		publisher: text("publisher"),
		/** Extension name from package.json. */
		name: text("name").notNull(),
		/** Version from package.json. */
		version: text("version").notNull(),
		/** Display name from package.json. */
		displayName: text("display_name"),
		/** Source registry: "open-vsx" | "manual-vsix". */
		registrySource: text("registry_source").notNull(),
		/** Absolute path to the original VSIX (may be null after cleanup). */
		vsixPath: text("vsix_path"),
		/** Absolute path to the content-addressed unpacked dir. */
		unpackedPath: text("unpacked_path").notNull(),
		/** Signature state: "unsigned" | "verified" | "unverified". */
		signatureState: text("signature_state").notNull().default("unsigned"),
		/** Scan state: "pending" | "clean" | "quarantined". */
		scanState: text("scan_state").notNull().default("pending"),
		/** Serialized contributes.themes array (JSON string) for theme packages. */
		themesJson: text("themes_json"),
		createdAt: int("created_at").notNull(),
	},
	(table) => [
		index("idx_ext_packages_external_id").on(table.externalId),
	],
)

/**
 * ExtensionInstallation — mutable installation state per package.
 *
 * Multiple installations may reference the same package id (e.g. re-installs).
 * The active installation is the most recent row with lifecycleState != "removed".
 */
export const extensionInstallations = sqliteTable(
	"extension_installations",
	{
		id: text("id").primaryKey(),
		/** FK → extensionPackages.id */
		packageId: text("package_id")
			.notNull()
			.references(() => extensionPackages.id, { onDelete: "cascade" }),
		/** Lifecycle: "installed" | "disabled" | "removed". */
		lifecycleState: text("lifecycle_state").notNull().default("installed"),
		/** Trust tier: "local-dev" | "signed-third-party" | "unsigned-third-party". */
		trustTier: text("trust_tier").notNull().default("unsigned-third-party"),
		/** Install scope: "app" | "profile" | "workspace". */
		scope: text("scope").notNull().default("app"),
		/** Currently applied theme short-id (null if no theme applied). */
		appliedThemeId: text("applied_theme_id"),
		installedAt: int("installed_at").notNull(),
		updatedAt: int("updated_at").notNull(),
	},
	(table) => [
		index("idx_ext_installs_package_id").on(table.packageId),
		index("idx_ext_installs_lifecycle").on(table.lifecycleState),
	],
)

export const automationRuns = sqliteTable(
	"automation_runs",
	{
		id: text("id").primaryKey(),
		automationId: text("automation_id")
			.notNull()
			.references(() => automations.id, { onDelete: "cascade" }),
		workspace: text("workspace").notNull(),
		status: text("status").notNull(),
		attempt: int("attempt").notNull().default(1),
		sessionId: text("session_id"),
		worktreePath: text("worktree_path"),
		startedAt: int("started_at"),
		completedAt: int("completed_at"),
		timeoutAt: int("timeout_at"),
		resultTitle: text("result_title"),
		resultSummary: text("result_summary"),
		resultHasActionable: int("result_has_actionable", { mode: "boolean" }),
		resultBranch: text("result_branch"),
		resultPrUrl: text("result_pr_url"),
		errorMessage: text("error_message"),
		archivedReason: text("archived_reason"),
		archivedAssistantMessage: text("archived_assistant_message"),
		readAt: int("read_at"),
		createdAt: int("created_at").notNull(),
		updatedAt: int("updated_at").notNull(),
	},
	(table) => [
		index("idx_runs_automation").on(table.automationId),
		index("idx_runs_status").on(table.status),
		index("idx_runs_created").on(table.createdAt),
	],
)
