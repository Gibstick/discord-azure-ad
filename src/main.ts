import CreateApp from "./app";
import CreateBot from "./bot";

import { env } from "./env";

const app = CreateApp();
const bot = CreateBot();

app.listen(3000, () => {});
bot.login(env("BOT_TOKEN"));
