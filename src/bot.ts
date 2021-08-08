import { Client, Collection, Intents, Command } from "discord.js";

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

client.once("ready", () => {
  console.log("Ready!");
});

const commands: Command[] = [
  {
    name: "ping",
    description: "Replies with pong!",
    async execute(interaction) {
      console.log(new Date().toUTCString());
      console.log(interaction.createdAt.toUTCString());
      const delta = Date.now() - interaction.createdTimestamp;
      await interaction.reply(`:ping_pong: ${delta}`);
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
    await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
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

export default client;
