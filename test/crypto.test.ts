import { assert } from "chai";
import { pseudoRandomBytes } from "crypto";
import nacl from "tweetnacl";

import * as crypto from "../src/crypto";

describe("crypto tests", () => {
  it("basic", () => {
    const key = crypto.generateKey();
    assert.lengthOf(key, nacl.secretbox.keyLength);

    const plain = "plaintext message";
    const ciphertext = crypto.encrypt(plain, key);

    assert.equal(ciphertext, encodeURIComponent(ciphertext), "URL safe");
    assert.equal(crypto.decrypt(ciphertext, key), plain, "round trip");
  });

  it("negative", () => {
    const key = crypto.generateKey();
    const wrongKey = Uint8Array.from(key);
    wrongKey[0] = key[0] + 1;

    const plain = "plaintext";
    const ciphertext = crypto.encrypt(plain, key);

    assert.throws(() => crypto.decrypt(ciphertext, wrongKey), /decrypt/);

    const garbage = pseudoRandomBytes(25).toString();
    assert.throws(() => crypto.decrypt(garbage, wrongKey));
    assert.throws(() => crypto.decrypt(garbage, key));

    const tampered = ciphertext.slice(1) + "a";
    assert.throws(() => crypto.decrypt(tampered, key));
    assert.throws(() => crypto.decrypt(tampered, wrongKey));
  });

  it("kdf", () => {
    const keyMaterial = "foobar";
    const key1 = crypto.keyFromString(keyMaterial);
    const key2 = crypto.keyFromString(keyMaterial);

    const plain = "hello world";

    assert.equal(crypto.decrypt(crypto.encrypt(plain, key1), key2), plain);
  });
});
