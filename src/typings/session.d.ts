import { VerificationMessage } from "../message";

declare module "express-session" {
  interface SessionData {
    verificationMessage?: VerificationMessage;
  }
}

export {};
