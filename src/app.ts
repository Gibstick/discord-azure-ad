import express from "express";
import * as msal from "@azure/msal-node";
import dotenv from "dotenv";
import session from "express-session";
import createMemoryStore from "memorystore";

/**
 * Returns the value of environment variable `name`.
 * Throws Error if undefined.
 * @param name - name of environment variable.
 */
const env = (name: string): string => {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Missing environment variable: ${name}.`);
  }
  return value;
};

dotenv.config();

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
const port = 3000;

const MemoryStore = createMemoryStore(session);
app.use(
  session({
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
    secret: "", // TODO: secret
    saveUninitialized: false,
    cookie: {
      sameSite: "lax", // FIXME: sameSite strict doesn't work??
      httpOnly: true,
      maxAge: 60 * 60 * 1000, // 1 hour sessions
    },
    resave: false,
    rolling: true,
  }),
);

app.set("view engine", "ejs");

app.get("/", async (req: express.Request, res: express.Response) => {
  console.log(req.session);

  const authUrlRequest: msal.AuthorizationUrlRequest = {
    scopes: ["user.read"],
    redirectUri: "http://localhost:3000/redirect", // TODO: Configurable redirect
    prompt: "select_account",
  };
  const authCodeUrl = msClientApp.getAuthCodeUrl(authUrlRequest);

  res.render("index", {
    loginLink: await authCodeUrl,
    foo: "Bar",
    azureADVerified: req.session?.azureADVerified,
    discordVerified: req.session?.discordVerified,
  });
});

app.get("/redirect", (req: express.Request, res: express.Response) => {
  console.log(req.query);
  // Why don't we use the implicit flow here? Microsoft has scary-sounding
  // documentation [1] about how bad the implicit grant flow is, and how it's
  // broken because of browsers blocking third party cookies. Since we need only
  // need a single point-in-time verification of a user, these concerns aren't
  // that relevant, but it doesn't mean Microsoft won't eventually force everyone
  // to migrate to the Auth Code + PKCE flow instead. The extra latency of doing
  // the auth code grant doesn't matter to us so let's just do that.
  // [1]: https://docs.microsoft.com/en-ca/azure/active-directory/develop/v2-oauth2-implicit-grant-flow

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
    .then((response) => {
      req.session.azureADVerified = true;
      res.redirect("/");
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send(error);
    });
});

app.listen(port, () => {});
