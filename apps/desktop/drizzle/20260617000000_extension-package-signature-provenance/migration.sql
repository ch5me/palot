ALTER TABLE `extension_packages` ADD COLUMN `publisher_key_id` text;--> statement-breakpoint
ALTER TABLE `extension_packages` ADD COLUMN `signature_algorithm` text;--> statement-breakpoint
ALTER TABLE `extension_packages` ADD COLUMN `signature_b64` text;--> statement-breakpoint
ALTER TABLE `extension_packages` ADD COLUMN `signed_manifest_json` text;
