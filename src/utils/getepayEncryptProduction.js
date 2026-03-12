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
    
    // Handle case where IV might be Terminal ID (not Base64)
    // In this case, we use MD5 hash of Terminal ID as IV
    if (isProduction && !this._isValidBase64(iv)) {
      console.log('⚠️  IV is not Base64, using MD5 hash of Terminal ID as IV');
      // MD5 produces 32 hex chars = 16 bytes (perfect for AES-CBC)
      this.md5Iv = crypto.createHash('md5').update(iv).digest('hex');
    }
  }

  /**
   * Check if string is valid Base64
   */
  _isValidBase64(str) {
    try {
      const buffer = Buffer.from(str, 'base64');
      return Buffer.from(buffer).toString('base64') === str;
    } catch {
      return false;
    }
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
   * Production Encryption - AES/CBC with EAS (Easy Encryption Scheme)
   * Uses Base64 encoded IV and Key OR Terminal ID as IV (fallback)
   */
  _encryptCBC(plainText) {
    try {
      let iv, key;
      
      // Check if IV is Base64 or needs MD5 hashing
      if (this.md5Iv) {
        // Use MD5 hash of Terminal ID as IV (32 hex chars = 16 bytes)
        iv = Buffer.from(this.md5Iv, 'hex');
        key = Buffer.from(this.key, 'base64');
      } else {
        // Use Base64 decoded IV and Key
        iv = Buffer.from(this.iv, 'base64');
        key = Buffer.from(this.key, 'base64');
      }
      
      // Validate IV length (must be 16 bytes for AES-CBC)
      if (iv.length !== 16) {
        console.error('❌ Invalid IV length:', iv.length, 'Expected: 16 bytes');
        throw new Error(`Invalid IV length: ${iv.length}. Must be 16 bytes.`);
      }
      
      // Validate Key length (must be 32 bytes for AES-256-CBC)
      if (key.length !== 32) {
        console.error('❌ Invalid Key length:', key.length, 'Expected: 32 bytes');
        throw new Error(`Invalid Key length: ${key.length}. Must be 32 bytes.`);
      }
      
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      cipher.setAutoPadding(true);
      
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return encrypted.toUpperCase();
    } catch (error) {
      console.error('❌ Production encryption error:', error.message);
      console.error('IV provided:', this.iv);
      console.error('Key provided:', this.key);
      throw error;
    }
  }

  /**
   * Production Decryption - AES/CBC
   */
  _decryptCBC(cipherText) {
    try {
      let iv, key;
      
      // Check if IV is Base64 or needs MD5 hashing
      if (this.md5Iv) {
        iv = Buffer.from(this.md5Iv, 'hex');
        key = Buffer.from(this.key, 'base64');
      } else {
        iv = Buffer.from(this.iv, 'base64');
        key = Buffer.from(this.key, 'base64');
      }
      
      // Validate lengths
      if (iv.length !== 16) {
        throw new Error(`Invalid IV length: ${iv.length}. Must be 16 bytes.`);
      }
      
      if (key.length !== 32) {
        throw new Error(`Invalid Key length: ${key.length}. Must be 32 bytes.`);
      }
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      decipher.setAutoPadding(true);
      
      let decrypted = decipher.update(cipherText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('❌ Production decryption error:', error.message);
      throw error;
    }
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
