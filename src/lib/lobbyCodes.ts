import { randomInt } from "node:crypto";

// Uppercase letters only, excluding I and O to dodge confusion with 1/0.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LEN = 6;
const CODE_RE = /^[A-HJ-NP-Z]{6}$/i;

export function generateLobbyCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

export function isValidLobbyCode(s: unknown): s is string {
  return typeof s === "string" && CODE_RE.test(s);
}

export function normalizeLobbyCode(s: string): string {
  return s.trim().toUpperCase();
}
