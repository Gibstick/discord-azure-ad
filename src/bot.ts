import { Client, Collection, Command, Intents } from "discord.js";
import bunyan from "bunyan";

import VerifyEventEmitter from "./event";
import { VerificationMessage } from "./message";
import moment from "moment";
import { encrypt } from "./crypto";

/** Configuration for the Discord bot. */
export interface BotConfig {
  /** An event emitter that can be used to emit verification events. */
  ee: VerifyEventEmitter;
  /** A secret key used for NaCl's box interface, for encryption. */
  secretKey: Uint8Array;
  /** Name of the role to apply to verified users. */
  verifiedRoleName: string;
  /**
   * Base URL from which the pages are being served (for now, it must be a
   * root). NO TRAILING SLASH. */
  baseUrl: string;
}

const CreateBot = (config: BotConfig): Client => {
  const log = bunyan.createLogger({ name: "bot" });
  const { ee, secretKey, verifiedRoleName, baseUrl } = config;

  const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

  client.once("ready", async () => {
    log.info("Ready!");
  });

  ee.registerHandler(async (userId, guildId) => {
    const guild = client.guilds.resolve(guildId);
    if (!guild) {
      log.warn({ guildId }, "Attempted to handle invalid Guild");
      return;
    }

    const member = guild.members.resolve(userId);
    if (!member) {
      log.warn({ userId, guildId }, "Attempted to handle invalid user");
      return;
    }

    // TODO: get the role in a smarter way.
    const roleToAssign = guild.roles.cache.find((role, _key, _collection) => {
      return role.name === verifiedRoleName;
    });

    if (!roleToAssign) {
      log.warn({ verifiedRoleName, guildId, userId }, "Verified role not found in guild");
      return;
    }

    await member.roles.add(roleToAssign, "Successful verification");
  });

  const commands: Command[] = [
    {
      name: "ping",
      description: "Replies with pong!",
      async execute(interaction) {
        const delta = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`:ping_pong: ${delta}`);
      },
    },
    {
      name: "verify",
      description: "Begin the verification process",
      async execute(interaction) {
        const guildId = interaction.guildId;
        if (!guildId) {
          return;
        }
        const userId = interaction.user.id;
        const verificationMessage: VerificationMessage = {
          expiryTs: moment().add(5, "m").unix(),
          discord: {
            guildId,
            userId,
          },
        };

        const encodedMessage = encrypt(verificationMessage, secretKey);
        // TODO: don't hardcode the link
        await interaction.reply({
          content: `${baseUrl}/start?m=` + encodedMessage,
          ephemeral: true,
        });
      },
    },
  ];

  client.commands = new Collection();
  for (const command of commands) {
    client.commands.set(command.name, command);
  }

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    if (!client.commands.has(interaction.commandName)) return;

    try {
      const command = client.commands.get(interaction.commandName);
      command?.execute(interaction);
    } catch (error) {
      log.error({ err: error, msg: "Error excecuting command", command: interaction.commandName });
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  });

  // TODO: smarter deploy
  client.on("messageCreate", async (message) => {
    if (!client.application?.owner) await client.application?.fetch();

    const ownerId = client.application?.owner?.id;

    if (message.content.toLowerCase() === "!deploy" && message.author.id === ownerId) {
      for (const guild of client.guilds.cache.values()) {
        for (const command of commands) {
          await guild.commands.create(command);
          log.info("Command created: %s", command.name);
        }
      }
    }
  });

  return client;
};

export default CreateBot;
