// AES-256-GCM encryption for token storage
// Uses SESSION_SECRET as key material (≥32 chars required)

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT = "medcrowd-token-encryption"; // Static salt (key is already high-entropy)

let derivedKey: Buffer | null = null;
let keyAvailable: boolean | null = null;

function getKey(): Buffer | null {
  if (derivedKey) return derivedKey;
  if (keyAvailable === false) return null;

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    keyAvailable = false;
    return null;
  }
  derivedKey = scryptSync(secret, SALT, 32);
  keyAvailable = true;
  return derivedKey;
}

/**
 * Encrypt a plaintext string. Returns base64-encoded ciphertext.
 * Format: iv (12 bytes) + tag (16 bytes) + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // No encryption key available, store as-is

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Pack: iv + tag + ciphertext
  const packed = Buffer.concat([iv, tag, encrypted]);
  return packed.toString("base64");
}

/**
 * Decrypt a base64-encoded ciphertext. Returns plaintext string.
 * Returns null if decryption fails (e.g., plaintext input from before encryption was enabled).
 */
export function decrypt(encoded: string): string | null {
  try {
    const key = getKey();
    if (!key) return null; // No key, treat as plaintext

    const packed = Buffer.from(encoded, "base64");
    if (packed.length < IV_LENGTH + TAG_LENGTH + 1) {
      return null; // Too short to be encrypted data
    }

    const iv = packed.subarray(0, IV_LENGTH);
    const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null; // Decryption failed — likely plaintext token
  }
}
