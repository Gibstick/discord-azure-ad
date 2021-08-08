import { Message, Collection, CommandInteraction } from "discord.js";

declare module "discord.js" {
  export interface Client {
    commands: Collection<string, Command>;
  }

  export interface Command {
    name: string;
    description: string;
    execute: (interaction: CommandInteraction, args?: string[]) => Promise<any>;
  }
}

export {};
