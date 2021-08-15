import { Client, Collection, Command, Intents } from "discord.js";

import VerifyEventEmitter from "./event";
import { env } from "./env";
import { VerificationMessage } from "./message";
import moment from "moment";
import { decrypt, encrypt } from "./crypto";

const CreateBot = (verifyEventEmitter: VerifyEventEmitter, secretKey: Uint8Array): Client => {
  const roleName = env("VERIFIED_ROLE_NAME");
  const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

  client.once("ready", async () => {
    console.log("Ready!");
    for (const guild of client.guilds.cache.values()) {
      for (const command of commands) {
        const created = await guild.commands.create(command);
        console.log("Created command", command.name);
      }
    }
  });

  verifyEventEmitter.registerHandler(async (userId, guildId) => {
    const guild = client.guilds.resolve(guildId);
    if (!guild) {
      console.warn(`Attempted to handle invalid Guild ID ${guildId}`);
      return;
    }

    const member = guild.members.resolve(userId);
    if (!member) {
      console.warn(`Attempted to handle invalid user ID ${userId}`);
      return;
    }

    // TODO: get the role in a smarter way.
    const roleToAssign = guild.roles.cache.find((role, _key, _collection) => {
      return role.name === roleName;
    });

    if (!roleToAssign) {
      console.warn(`Role ${roleName} not found in guild ${guildId}`);
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
          expiryTs: moment().add(15, "m").unix(),
          discord: {
            guildId,
            userId,
          },
        };

        const encodedMessage = encrypt(verificationMessage, secretKey);
        // TODO: don't hardcode the link
        await interaction.reply({
          content: "http://localhost:3000/start?m=" + encodedMessage,
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
      console.error(error);
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
          const created = await guild.commands.create(command);
          console.log("Created command", command.name);
        }
      }
    }
  });

  return client;
};

export default CreateBot;
