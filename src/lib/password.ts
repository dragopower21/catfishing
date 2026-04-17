import {
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

// PBKDF2 with SHA-256. Not as slow as Argon2 but ships with Node and
// is fine for this game's threat model (friends, no PII, names are the
// only thing being protected).
const ITERATIONS = 210_000;
const KEYLEN = 32;
const DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(
  password: string,
  stored: string | null | undefined
): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  try {
    const salt = Buffer.from(parts[2], "hex");
    const expected = Buffer.from(parts[3], "hex");
    const actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function validatePasswordInput(input: unknown): string | null {
  if (typeof input !== "string") return null;
  if (input.length < 4 || input.length > 200) return null;
  return input;
}

export function validateDisplayNameInput(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length < 2 || trimmed.length > 30) return null;
  // Printable ASCII + spaces only; no control chars.
  if (!/^[\x20-\x7E]+$/.test(trimmed)) return null;
  return trimmed;
}
