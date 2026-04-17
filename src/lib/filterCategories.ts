const ADMIN_PREFIXES = [
  "Articles with",
  "Pages using",
  "CS1",
  "Webarchive",
  "Use dmy dates",
  "Use mdy dates",
  "Short description",
  "Wikipedia articles",
  "All articles",
  "Commons category",
  "All Wikipedia",
  "Articles containing",
  "Articles lacking",
];

const STOPWORDS = new Set([
  "the",
  "of",
  "in",
  "and",
  "a",
  "an",
  "to",
  "for",
  "on",
  "at",
  "by",
  "is",
]);

export function filterCategories(
  categories: string[],
  articleTitle: string
): string[] {
  const lowerTitle = articleTitle.toLowerCase();
  const titleWords = new Set(
    lowerTitle.split(/[^a-z0-9]+/).filter((w) => w && !STOPWORDS.has(w))
  );

  return categories.filter((cat) => {
    if (ADMIN_PREFIXES.some((p) => cat.startsWith(p))) return false;
    const catLower = cat.toLowerCase();
    if (catLower.includes(lowerTitle)) return false;
    const catWords = catLower
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOPWORDS.has(w));
    if (catWords.some((w) => titleWords.has(w))) return false;
    return true;
  });
}
