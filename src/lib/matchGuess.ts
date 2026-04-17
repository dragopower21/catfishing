import { distance } from "fastest-levenshtein";

export type MatchVerdict = "EXACT" | "CLOSE" | "WRONG";

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "in",
  "and",
  "to",
  "for",
  "on",
  "at",
  "by",
  "is",
  "it",
  "or",
]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function significantWords(s: string): string[] {
  return s
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export function matchGuess(
  guess: string,
  article: { title: string; aliases: string[] }
): MatchVerdict {
  const g = normalize(guess);
  if (!g) return "WRONG";

  const candidates = [article.title, ...article.aliases]
    .map(normalize)
    .filter((c) => c.length > 0);

  if (candidates.includes(g)) return "EXACT";

  // Substring containment either way (e.g. "mount everest" vs "everest")
  for (const c of candidates) {
    if (c.length >= 4 && g.length >= 4) {
      if (c.includes(g) || g.includes(c)) return "CLOSE";
    }
  }

  // Levenshtein — generous
  for (const c of candidates) {
    const threshold =
      c.length <= 5 ? 1 : c.length <= 9 ? 2 : Math.ceil(c.length * 0.3);
    if (distance(g, c) <= threshold) return "CLOSE";
  }

  // Whole-word overlap: any significant word of the guess matches any
  // significant word of a candidate (exact or within Levenshtein 1).
  const gWords = significantWords(g);
  for (const c of candidates) {
    const cWords = significantWords(c);
    if (cWords.length === 0 || gWords.length === 0) continue;
    for (const gw of gWords) {
      for (const cw of cWords) {
        if (gw === cw) return "CLOSE";
        if (gw.length >= 4 && cw.length >= 4 && distance(gw, cw) <= 1) {
          return "CLOSE";
        }
      }
    }
  }

  return "WRONG";
}
