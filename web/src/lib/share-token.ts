// HMAC-based share link signing
// Prevents enumeration of consultation IDs on the public share page

import { createHmac } from "crypto";

function getShareSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for share signing");
  return secret;
}

/** Generate HMAC-SHA256 signature for a consultation ID */
export function signShareId(consultationId: string): string {
  return createHmac("sha256", getShareSecret())
    .update(`share:${consultationId}`)
    .digest("hex")
    .slice(0, 16); // 16 hex chars = 64 bits, sufficient for anti-enumeration
}

/** Verify a share signature */
export function verifyShareSig(consultationId: string, sig: string): boolean {
  const expected = signShareId(consultationId);
  // Constant-time comparison
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Build a signed share URL */
export function buildShareUrl(consultationId: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const sig = signShareId(consultationId);
  return `${base}/share/${consultationId}?sig=${sig}`;
}
