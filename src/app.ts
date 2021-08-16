import { randomBytes } from "node:crypto";

import express from "express";
import * as msal from "@azure/msal-node";
import session from "express-session";
import createMemoryStore from "memorystore";
import bunyan from "bunyan";

import VerifyEventEmitter from "./event";
import { decrypt } from "./crypto";
import { isExpired, isVerificationMessage, VerificationMessage } from "./message";

/** Configuration for the server. */
export interface ServerConfig {
  /** An event emitter that can be used to register handlers for verification events. */
  ee: VerifyEventEmitter;
  /** A secret key used for NaCl's box interface, for encryption. */
  secretKey: Uint8Array;
  /** A secret key used for express-session. */
  sessionSecret: string | null | undefined;
  ms: {
    clientId: string;
    clientSecret: string;
    allowedTenantId: string;
  };
}

const CreateApp = (config: ServerConfig) => {
  const log = bunyan.createLogger({ name: "web" });
  const msLog = log.child({ ms: true });
  const {
    ee,
    secretKey,
    ms: { clientId, clientSecret, allowedTenantId },
  } = config;

  const msalConfig: msal.Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${allowedTenantId}/`,
      clientSecret,
    },
    system: {
      loggerOptions: {
        loggerCallback(logLevel: msal.LogLevel, message: string, _3: any) {
          let logFn;
          switch (logLevel) {
            case msal.LogLevel.Error:
              logFn = msLog.info;
              break;
            case msal.LogLevel.Warning:
              logFn = msLog.warn;
              break;
            case msal.LogLevel.Info:
              logFn = msLog.info;
              break;
            case msal.LogLevel.Verbose:
              logFn = msLog.debug;
            case msal.LogLevel.Trace:
              logFn = msLog.trace;
          }
          logFn.bind(msLog)(message);
        },
        piiLoggingEnabled: false,
        logLevel: msal.LogLevel.Info,
      },
    },
  };

  const msClientApp = new msal.ConfidentialClientApplication(msalConfig);

  const app = express();

  let { sessionSecret } = config;
  sessionSecret ??= (log.info("Using randomly generated session secret"), randomBytes(32).toString("hex"));

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
    if (!req.session.verificationMessage) {
      return res.redirect("/");
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

    const verificationMessage = req.session.verificationMessage;
    if (!verificationMessage) {
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
        const { userId, guildId } = verificationMessage.discord;
        log.info({ userId, guildId }, "Successful verification.");
        ee.emitVerification(userId, guildId);
        res.redirect("/");
      })
      .catch((error) => {
        log.error({ err: error });
        res.status(500).send(error);
      });
  });
  return app;
};

export default CreateApp;
