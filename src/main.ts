import dotenv from "dotenv";

import CreateApp from "./app";
import CreateBot from "./bot";
import VerifyEventEmitter from "./event";
import { env } from "./env";
import { generateKey } from "./crypto";

dotenv.config();

const ee = new VerifyEventEmitter();

const key = generateKey();

const app = CreateApp(ee, key);
const bot = CreateBot(ee, key);

app.listen(3000, () => {});
bot.login(env("BOT_TOKEN"));
