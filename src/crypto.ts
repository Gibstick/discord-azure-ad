import { secretbox, randomBytes } from "tweetnacl";

const STRING_ENCODING = "utf-8";
const BUFFER_ENCODING = "base64url";

const newNonce = () => randomBytes(secretbox.nonceLength);

export const generateKey = () => randomBytes(secretbox.keyLength);

// encrypt a JSON-stringifiable message using the given key and return
// cihpertext + nonce.
export const encrypt = (payload: any, key: Uint8Array): string => {
  const nonce = newNonce();
  const messageBuf = Buffer.from(JSON.stringify(payload), STRING_ENCODING);
  const box = secretbox(messageBuf, nonce, key);

  const fullMessage = new Uint8Array(nonce.length + box.length);
  fullMessage.set(nonce);
  fullMessage.set(box, nonce.length);

  const base64FullMessage = Buffer.from(fullMessage).toString(BUFFER_ENCODING);
  return base64FullMessage;
};

// decrypt takes a ciphertext + nonce encoded string and returns an
// JSON-deserialized object.
export const decrypt = (messageWithNonce: string, key: Uint8Array): any => {
  const messageBuf = Buffer.from(messageWithNonce, BUFFER_ENCODING);
  const nonce = messageBuf.slice(0, secretbox.nonceLength);
  const message = messageBuf.slice(secretbox.nonceLength, messageWithNonce.length);

  const decrypted = secretbox.open(message, nonce, key);
  if (!decrypted) {
    throw new Error("Could not decrypt message.");
  }

  return JSON.parse(Buffer.from(decrypted).toString(STRING_ENCODING));
};
