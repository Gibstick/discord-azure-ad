import app from "./app";
import client from "./bot";

import { env } from "./env";

app.listen(3000, () => {});
client.login(env("BOT_TOKEN"));
