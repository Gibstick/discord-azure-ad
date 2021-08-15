import dotenv from "dotenv";

import CreateApp, { ServerConfig } from "./app";
import CreateBot from "./bot";
import VerifyEventEmitter from "./event";
import { env } from "./env";
import { generateKey } from "./crypto";

dotenv.config();

const ee = new VerifyEventEmitter();

const secretKey = generateKey();
const verifiedRoleName = "UW Verified"; // TODO: don't hardcode this

const serverConfig: ServerConfig = {
  ee,
  secretKey,
  sessionSecret: process.env["DISCORD_AAD_SESSION_SECRET"],
  ms: {
    clientId: env("DISCORD_AAD_CLIENT_ID"),
    clientSecret: env("DISCORD_AAD_CLIENT_SECRET"),
    allowedTenantId: env("DISCORD_AAD_ALLOWED_TENANT"),
  },
};

const app = CreateApp(serverConfig);
const bot = CreateBot({ ee, secretKey, verifiedRoleName });

app.listen(3000, () => {});
bot.login(env("DISCORD_AAD_BOT_TOKEN"));
