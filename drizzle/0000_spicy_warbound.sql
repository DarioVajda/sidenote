CREATE TABLE `papers` (
	`id` text PRIMARY KEY NOT NULL,
	`original_title` text NOT NULL,
	`custom_title` text,
	`description` text,
	`abstract` text,
	`authors` text DEFAULT '[]' NOT NULL,
	`year` integer,
	`venue` text,
	`source_url` text,
	`arxiv_id` text,
	`pdf_path` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`reading_status` text DEFAULT 'to_read' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pdf_references` (
	`id` text PRIMARY KEY NOT NULL,
	`paper_id` text NOT NULL,
	`label` text NOT NULL,
	`page` integer NOT NULL,
	`x1` real NOT NULL,
	`y1` real NOT NULL,
	`x2` real NOT NULL,
	`y2` real NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
