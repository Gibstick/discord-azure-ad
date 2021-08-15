import { randomBytes } from "node:crypto";

import express from "express";
import * as msal from "@azure/msal-node";
import session from "express-session";
import createMemoryStore from "memorystore";

import { env } from "./env";
import VerifyEventEmitter from "./event";
import { decrypt } from "./crypto";
import { isExpired, isVerificationMessage, VerificationMessage } from "./message";

const CreateApp = (verifyEventEmitter: VerifyEventEmitter, secretKey: Uint8Array) => {
  const msalConfig: msal.Configuration = {
    auth: {
      clientId: env("AAD_CLIENT_ID"),
      authority: `https://login.microsoftonline.com/${env("AAD_ALLOWED_TENANT")}/`,
      clientSecret: env("AAD_CLIENT_SECRET"),
    },
    system: {
      loggerOptions: {
        loggerCallback(_1: any, message: any, _3: any) {
          console.log(message);
        },
        piiLoggingEnabled: false,
        logLevel: msal.LogLevel.Info,
      },
    },
  };

  const msClientApp = new msal.ConfidentialClientApplication(msalConfig);

  const app = express();

  let sessionSecret = process.env["SESSION_SECRET"] ?? null;
  sessionSecret ??= (console.log("Using randomly generated session secret"), randomBytes(32).toString("hex"));

  const MemoryStore = createMemoryStore(session);
  app.use(
    session({
      store: new MemoryStore({
        checkPeriod: 86400000,
      }),
      secret: sessionSecret,
      saveUninitialized: false,
      cookie: {
        sameSite: "lax", // FIXME: sameSite strict doesn't work??
        httpOnly: true,
        maxAge: 15 * 60 * 1000, // 15m sessions
      },
      resave: false,
      rolling: true,
    }),
  );

  app.set("view engine", "ejs");

  app.get("/", async (_req: express.Request, res: express.Response) => {
    res.render("index", {});
  });

  app.get("/start", (req: express.Request, res: express.Response) => {
    const encodedMessage = req.query.m;
    if (typeof encodedMessage !== "string") {
      // TODO: Render error message
      res.status(400).send("Error 400: invalid message.");
      return;
    }

    let plain: VerificationMessage;
    try {
      plain = decrypt(encodedMessage, secretKey) as VerificationMessage;
    } catch (_e) {
      res.status(400).send("Error 400: invalid message.");
      return;
    }
    if (!isVerificationMessage(plain)) {
      res.status(400).send("Error 400: invalid decrypted message.");
      return;
    }

    if (isExpired(plain)) {
      res.status(400).send("Error 400: expired message.");
      return;
    }

    req.session.verificationMessage = plain;
    res.redirect("/verify");
  });

  app.get("/verify", async (req: express.Request, res: express.Response) => {
    console.log("/verify");
    if (!req.session.verificationMessage) {
      res.redirect("/");
    }

    const authUrlRequest: msal.AuthorizationUrlRequest = {
      scopes: ["user.read"],
      redirectUri: "http://localhost:3000/redirect", // TODO: Configurable redirect
      prompt: "select_account",
    };
    const authCodeUrl = msClientApp.getAuthCodeUrl(authUrlRequest);

    res.render("verify", {
      loginLink: await authCodeUrl,
    });
  });

  app.get("/redirect", (req: express.Request, res: express.Response) => {
    // Why don't we use the implicit flow here? Microsoft has scary-sounding
    // documentation [1] about how bad the implicit grant flow is, and how it's
    // broken because of browsers blocking third party cookies. Since we need only
    // need a single point-in-time verification of a user, these concerns aren't
    // that relevant, but it doesn't mean Microsoft won't eventually force everyone
    // to migrate to the Auth Code + PKCE flow instead. The extra latency of doing
    // the auth code grant doesn't matter to us so let's just do that.
    // [1]: https://docs.microsoft.com/en-ca/azure/active-directory/develop/v2-oauth2-implicit-grant-flow

    if (!req.session.verificationMessage) {
      req.session.destroy(() => {});
      res.status(400).send("Invalid session.");
      return;
    }

    const authorizationCode = req.query.code;
    if (typeof authorizationCode !== "string") {
      res
        .status(400)
        .send(
          `No authorization code returned. Error: ${req.query.error_description ?? "Unknown error"} (${
            req.query.error ?? "?"
          })`,
        );
      return;
    }

    const tokenRequest: msal.AuthorizationCodeRequest = {
      code: authorizationCode,
      scopes: ["user.read"],
      redirectUri: "http://localhost:3000/redirect", // TODO: configurable redirect
    };

    msClientApp
      .acquireTokenByCode(tokenRequest)
      .then((_response) => {
        console.log("VERIFIED");
        const discordData = req.session.verificationMessage!.discord;
        verifyEventEmitter.emitVerification(discordData.userId, discordData.guildId);
        res.redirect("/");
      })
      .catch((error) => {
        console.log(error);
        res.status(500).send(error);
      });
  });
  return app;
};

export default CreateApp;
