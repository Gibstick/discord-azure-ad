import { assert } from "chai";
import moment from "moment";

import * as crypto from "../src/crypto";
import { isExpired, isVerificationMessage, VerificationMessage } from "../src/message";

describe("verification tests", () => {
  it("verification", () => {
    const key = crypto.generateKey();
    const origMsg: VerificationMessage = {
      expiryTs: 123,
      discord: {
        userId: "123",
        guildId: "456",
      },
    };

    assert.isTrue(isVerificationMessage(origMsg));

    const encMsg = crypto.encrypt(origMsg, key);
    const msg = crypto.decrypt(encMsg, key);
    assert.deepEqual(crypto.decrypt(encMsg, key), origMsg);
    assert.isTrue(isVerificationMessage(msg));
  });

  it("isVerificationMessage", () => {
    const msg: VerificationMessage = {
      expiryTs: 123,
      discord: {
        userId: "123",
        guildId: "456",
      },
    };
    assert.isTrue(isVerificationMessage(msg));

    assert.isFalse(isVerificationMessage({ foo: "bar" }));
    assert.isFalse(isVerificationMessage({ ...msg, expiryTs: "foo" }));
    assert.isFalse(isVerificationMessage({ ...msg, discord: {} }));
  });

  it("expiry", () => {
    const expiredMsg: VerificationMessage = {
      expiryTs: 123,
      discord: {
        userId: "123",
        guildId: "456",
      },
    };
    assert.isTrue(isExpired(expiredMsg));

    const msg: VerificationMessage = {
      expiryTs: moment().unix() + 10000,
      discord: {
        userId: "123",
        guildId: "456",
      },
    };
    assert.isFalse(isExpired(msg));
  });
});
