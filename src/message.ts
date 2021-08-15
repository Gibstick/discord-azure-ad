import { Snowflake } from "discord.js";
import moment from "moment";

const _testSnowflakeType: Snowflake = "foobar";

export type VerificationMessage = {
  expiryTs: number; // Expiration as a Unix timestamp in ms
  discord: {
    userId: Snowflake;
    guildId: Snowflake;
  };
};

export const isVerificationMessage = (m: any): m is VerificationMessage => {
  // Make sure string can be assigned to Snowflake
  return (
    typeof m.expiryTs == "number" &&
    typeof m.discord.userId === "string" &&
    typeof m.discord.guildId === "string"
  );
};

export const isExpired = (m: VerificationMessage): boolean => {
  return moment().unix() >= m.expiryTs;
};
