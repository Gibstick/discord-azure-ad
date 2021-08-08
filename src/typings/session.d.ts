declare module "express-session" {
  interface SessionData {
    azureADVerified?: boolean;
    discordVerified?: boolean;
  }
}

export {};
