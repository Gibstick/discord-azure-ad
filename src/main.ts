import app from "./app";
import CreateBot from "./bot";

import { env } from "./env";

app.listen(3000, () => {});

const bot = CreateBot();
bot.login(env("BOT_TOKEN"));
