const crypto = require("crypto");

function base64ToBytes(base64) {
  return Buffer.from(base64, "base64");
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

class GcmPgEncryption {
  constructor(iv, ivKey) {
    this.iv = iv;
    this.ivKey = ivKey;
    this.mKey = null;
  }

  async init() {
    const combined = this.ivKey + this.iv;
    const hash = crypto.createHash("sha256").update(combined).digest();
    this.mKey = bytesToBase64(hash);
  }

  async encrypt(plainText) {
    if (!this.mKey) await this.init();

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);

    const key = crypto.pbkdf2Sync(
      this.mKey,
      salt,
      65535,
      32,
      "sha512"
    );

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, encrypted, tag]).toString("base64");
  }

  async decrypt(cipherText) {
    if (!this.mKey) await this.init();

    const data = Buffer.from(cipherText, "base64");

    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const tag = data.slice(data.length - 16);
    const encrypted = data.slice(28, data.length - 16);

    const key = crypto.pbkdf2Sync(
      this.mKey,
      salt,
      65535,
      32,
      "sha512"
    );

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final("utf8");
  }
}

module.exports = GcmPgEncryption;
