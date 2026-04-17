export type ScoreResult = "EXACT" | "CLOSE" | "WRONG" | "SKIP";

export function pointsForResult(
  result: ScoreResult,
  revealsUsed: number
): number {
  const reveals = Math.max(0, revealsUsed);
  if (result === "EXACT") return Math.max(2, 10 - 2 * reveals);
  if (result === "CLOSE") return Math.max(1, 7 - 2 * reveals);
  return 0;
}
