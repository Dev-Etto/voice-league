import type { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  SlashCommandOptionsOnlyBuilder, 
  SlashCommandSubcommandsOnlyBuilder 
} from "discord.js";
import type { WatchdogEngine } from "../engine/watchdog.ts";

export interface DiscordCommand {
  data: 
    | SlashCommandBuilder 
    | SlashCommandOptionsOnlyBuilder 
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: ChatInputCommandInteraction, watchdog: WatchdogEngine) => Promise<unknown>;
}
