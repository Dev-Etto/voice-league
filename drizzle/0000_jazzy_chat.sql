CREATE TABLE `players` (
	`discord_id` text NOT NULL,
	`puuid` text PRIMARY KEY NOT NULL,
	`game_name` text NOT NULL,
	`tag_line` text NOT NULL,
	`last_game_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
