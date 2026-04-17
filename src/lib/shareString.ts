export function buildShareString(
  setName: string,
  results: Array<{ correct: boolean }>,
  percentage: number
): string {
  const cells = results.map((r) => (r.correct ? "🐈" : "🐟"));
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 5) {
    rows.push(cells.slice(i, i + 5).join(""));
  }
  const correct = results.filter((r) => r.correct).length;
  const header = `Catfishing — ${setName} ${percentage}% (${correct}/${results.length})`;
  return [header, ...rows].join("\n");
}
