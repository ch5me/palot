ALTER TABLE `extension_packages` ADD COLUMN `plugin_manifest_json` text;--> statement-breakpoint
ALTER TABLE `extension_packages` ADD COLUMN `required_capabilities_json` text;
