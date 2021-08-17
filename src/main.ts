import dotenv from "dotenv";
import bunyan from "bunyan";

import CreateApp, { ServerConfig } from "./app";
import CreateBot from "./bot";
import VerifyEventEmitter from "./event";
import { env } from "./env";
import { generateKey, keyFromString } from "./crypto";

dotenv.config();
const log = bunyan.createLogger({ name: "main" });

const ee = new VerifyEventEmitter();

let secretKey: Uint8Array;
const secretFromEnv = process.env["DISCORD_AAD_VERIFICATION_SECRET"];
if (secretFromEnv) {
  secretKey = keyFromString(secretFromEnv);
  log.info("Deriving verification secret key from environment variable.");
} else {
  secretKey = generateKey();
  log.info("Generating random verification secret key.");
}

const verifiedRoleName = env("DISCORD_AAD_VERIFIED_ROLE_NAME");

const serverConfig: ServerConfig = {
  ee,
  secretKey,
  sessionSecret: process.env["DISCORD_AAD_SESSION_SECRET"],
  orgName: env("DISCORD_AAD_ORG_NAME"),
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
