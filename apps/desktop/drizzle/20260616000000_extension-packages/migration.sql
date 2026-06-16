CREATE TABLE `extension_packages` (
	`id` text PRIMARY KEY,
	`external_id` text NOT NULL,
	`publisher` text,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`display_name` text,
	`registry_source` text NOT NULL,
	`vsix_path` text,
	`unpacked_path` text NOT NULL,
	`signature_state` text DEFAULT 'unsigned' NOT NULL,
	`scan_state` text DEFAULT 'pending' NOT NULL,
	`themes_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `extension_installations` (
	`id` text PRIMARY KEY,
	`package_id` text NOT NULL,
	`lifecycle_state` text DEFAULT 'installed' NOT NULL,
	`trust_tier` text DEFAULT 'unsigned-third-party' NOT NULL,
	`scope` text DEFAULT 'app' NOT NULL,
	`applied_theme_id` text,
	`installed_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_extension_installations_package_id_extension_packages_id_fk` FOREIGN KEY (`package_id`) REFERENCES `extension_packages`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_ext_packages_external_id` ON `extension_packages` (`external_id`);
--> statement-breakpoint
CREATE INDEX `idx_ext_installs_package_id` ON `extension_installations` (`package_id`);
--> statement-breakpoint
CREATE INDEX `idx_ext_installs_lifecycle` ON `extension_installations` (`lifecycle_state`);
