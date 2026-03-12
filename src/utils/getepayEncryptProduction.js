const crypto = require("crypto");

/**
 * Production-grade encryption/decryption for GetEpay Payment Gateway
 * Supports both AES/GCM (UAT) and AES/CBC (Production)
 */

class GetEpayEncryption {
  constructor(iv, key, isProduction = false) {
    this.iv = iv;
    this.key = key;
    this.isProduction = isProduction; // Production uses AES/CBC, UAT uses AES/GCM
  }

  /**
   * Encrypt data based on environment
   * Production: AES/CBC with Base64 encoding
   * UAT: AES/GCM with custom PBKDF2 derivation
   */
  async encrypt(plainText) {
    if (this.isProduction) {
      return this._encryptCBC(plainText);
    } else {
      return this._encryptGCM(plainText);
    }
  }

  /**
   * Decrypt data based on environment
   */
  async decrypt(cipherText) {
    if (this.isProduction) {
      return this._decryptCBC(cipherText);
    } else {
      return this._decryptGCM(cipherText);
    }
  }

  /**
   * Production Encryption - AES/CBC
   * Uses simple IV and Key from environment
   */
  _encryptCBC(plainText) {
    const iv = Buffer.from(this.iv, 'base64');
    const key = Buffer.from(this.key, 'base64');
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted.toUpperCase();
  }

  /**
   * Production Decryption - AES/CBC
   */
  _decryptCBC(cipherText) {
    const iv = Buffer.from(this.iv, 'base64');
    const key = Buffer.from(this.key, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(cipherText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * UAT Encryption - AES/GCM with PBKDF2 key derivation
   * Follows GetEpay's custom encryption protocol
   */
  async _encryptGCM(plainText) {
    // Derive master key
    const combined = this.key + this.iv;
    const hash = crypto.createHash("sha256").update(combined).digest();
    const mKey = this._bytesToBase64(hash);

    // Generate random salt and IV
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);

    // Derive encryption key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(
      mKey,
      salt,
      65535,
      32,
      "sha512"
    );

    // Encrypt using AES-256-GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    // Combine salt + iv + encrypted + tag and return as base64
    return this._bytesToBase64(Buffer.concat([salt, iv, encrypted, tag]));
  }

  /**
   * UAT Decryption - AES/GCM
   */
  async _decryptGCM(cipherText) {
    // Derive master key
    const combined = this.key + this.iv;
    const hash = crypto.createHash("sha256").update(combined).digest();
    const mKey = this._bytesToBase64(hash);

    // Parse the combined buffer
    const data = Buffer.from(cipherText, "base64");
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const tag = data.slice(data.length - 16);
    const encrypted = data.slice(28, data.length - 16);

    // Derive decryption key
    const derivedKey = crypto.pbkdf2Sync(
      mKey,
      salt,
      65535,
      32,
      "sha512"
    );

    // Decrypt using AES-256-GCM
    const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final("utf8");
  }

  /**
   * Helper: Convert Buffer to Base64
   */
  _bytesToBase64(bytes) {
    return bytes.toString("base64");
  }

  /**
   * Helper: Convert Base64 to Buffer
   */
  _base64ToBytes(base64) {
    return Buffer.from(base64, "base64");
  }
}

module.exports = GetEpayEncryption;
