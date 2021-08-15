import { Snowflake } from "discord-api-types";

import EventEmitter from "events";

const eventName = "verifyEvent";

class VerifyEventEmitter {
  e = new EventEmitter();

  // registerHandler registers a handler that will receive a user's user ID and
  // guild ID when a verification is successful.
  registerHandler(fn: (userId: Snowflake, guildId: Snowflake) => void): void {
    this.e.on(eventName, fn);
  }

  // emitVerification notifices all handlers of a sucessful verification event.
  emitVerification(userId: Snowflake, guildId: Snowflake): void {
    this.e.emit(eventName, userId, guildId);
  }
}

export default VerifyEventEmitter;
