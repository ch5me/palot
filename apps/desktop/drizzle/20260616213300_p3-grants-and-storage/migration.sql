CREATE TABLE `extension_capability_grants` (
	`id` text PRIMARY KEY,
	`plugin_id` text NOT NULL,
	`scope` text NOT NULL,
	`scope_id` text,
	`capability` text NOT NULL,
	`grant_state` text NOT NULL,
	`granted_by` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE TABLE `plugin_storage_entries` (
	`id` text PRIMARY KEY,
	`plugin_id` text NOT NULL,
	`scope` text NOT NULL,
	`scope_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`is_secret` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ext_grants_plugin` ON `extension_capability_grants` (`plugin_id`);--> statement-breakpoint
CREATE INDEX `idx_ext_grants_plugin_scope` ON `extension_capability_grants` (`plugin_id`,`scope`);--> statement-breakpoint
CREATE INDEX `idx_plugin_storage_plugin_scope` ON `plugin_storage_entries` (`plugin_id`,`scope`,`scope_id`);
