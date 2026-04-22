export type WikipediaSuggestion = {
  title: string;
  description: string;
  url: string;
  categoryCount?: number | null;
};

export type FetchedArticle = {
  title: string;
  url: string;
  pageId: number;
  categories: string[];
  aliases: string[];
  summary: string | null;
  thumbnailUrl: string | null;
  pageViews: number | null;
  difficultyScore: number | null;
};

/**
 * Map yearly Wikipedia pageviews to a 1–10 difficulty score where 1 is
 * the easiest (everyone knows it) and 10 is the hardest (obscure).
 * Log scale because pageview counts span many orders of magnitude.
 *
 * Anchor points:
 *   100M views / year (iconic, e.g. Wikipedia itself)      → 1
 *   1M views   / year (well-known globally)                → 4
 *   10K views  / year (niche / specialist)                 → 7
 *   100 views  / year (truly obscure)                      → 10
 */
export function computeDifficultyFromPageViews(
  views: number | null | undefined
): number | null {
  if (typeof views !== "number" || !Number.isFinite(views) || views < 0) {
    return null;
  }
  const logViews = Math.log10(Math.max(1, views));
  const raw = 1 + (8 - logViews) * 1.5;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

/**
 * Sum of last 12 full months of pageviews from the Wikimedia REST API.
 * Returns null on any failure — callers should treat null as "unknown".
 */
export async function fetchPageViewsYearly(
  title: string
): Promise<number | null> {
  try {
    const now = new Date();
    // First of current month (exclusive upper bound of last full month).
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = new Date(end);
    start.setMonth(start.getMonth() - 12);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}0100`;

    const safe = encodeURIComponent(title.replace(/ /g, "_"));
    const url =
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/` +
      `en.wikipedia.org/all-access/user/${safe}/monthly/${fmt(start)}/${fmt(end)}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "catfishing-clone/1.0 (education)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: Array<{ views?: number }>;
    };
    const total = (data.items ?? []).reduce(
      (s, i) => s + (typeof i.views === "number" ? i.views : 0),
      0
    );
    return total;
  } catch {
    return null;
  }
}

export function titleFromUrl(url: string): string | null {
  const m = url.match(/\/wiki\/([^?#]+)/);
  if (!m) return null;
  return decodeURIComponent(m[1]).replace(/_/g, " ");
}

export async function searchWikipedia(
  query: string
): Promise<WikipediaSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    action: "opensearch",
    search: trimmed,
    limit: "10",
    namespace: "0",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": "catfishing-clone/1.0 (education)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Wikipedia search failed: ${res.status}`);

  const data = (await res.json()) as [
    string,
    string[],
    string[],
    string[]
  ];
  const [, titles, descriptions, urls] = data;
  return titles.map((title, i) => ({
    title,
    description: descriptions[i] ?? "",
    url: urls[i] ?? "",
  }));
}

type ApiPage = {
  pageid: number;
  title: string;
  fullurl?: string;
  missing?: string;
  categories?: Array<{ title: string }>;
  redirects?: Array<{ title?: string; from?: string; to?: string; pageid?: number }>;
};

type ApiQuery = {
  query?: {
    pages?: Record<string, ApiPage>;
    redirects?: Array<{ from: string; to: string }>;
  };
  error?: { info?: string };
};

type SummaryResponse = {
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  type?: string;
};

async function fetchSummary(title: string): Promise<{
  extract: string | null;
  thumbnail: string | null;
}> {
  try {
    const safe = encodeURIComponent(title.replace(/ /g, "_"));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${safe}`,
      {
        headers: { "User-Agent": "catfishing-clone/1.0 (education)" },
        cache: "no-store",
      }
    );
    if (!res.ok) return { extract: null, thumbnail: null };
    const data = (await res.json()) as SummaryResponse;
    return {
      extract: data.extract ?? null,
      thumbnail: data.thumbnail?.source ?? data.originalimage?.source ?? null,
    };
  } catch {
    return { extract: null, thumbnail: null };
  }
}

async function fetchFirstArticleImage(
  pageId: number
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query",
      pageids: String(pageId),
      prop: "pageimages",
      piprop: "thumbnail|original",
      pithumbsize: "600",
      format: "json",
      origin: "*",
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "catfishing-clone/1.0 (education)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            thumbnail?: { source?: string };
            original?: { source?: string };
          }
        >;
      };
    };
    const pages = data.query?.pages ?? {};
    const first = Object.values(pages)[0];
    return first?.thumbnail?.source ?? first?.original?.source ?? null;
  } catch {
    return null;
  }
}

/**
 * Batch-fetch the count of *useful* (post-filter) categories for a
 * list of article titles. One Wikipedia request for the whole batch.
 * Returns a map keyed by the caller's original input title.
 */
export async function fetchUsefulCategoryCounts(
  titles: string[],
  filter: (cats: string[], title: string) => string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (titles.length === 0) return counts;

  const params = new URLSearchParams({
    action: "query",
    titles: titles.join("|"),
    prop: "categories",
    cllimit: "max",
    clshow: "!hidden",
    redirects: "1",
    format: "json",
    origin: "*",
  });

  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`,
      {
        headers: { "User-Agent": "catfishing-clone/1.0 (education)" },
        cache: "no-store",
      }
    );
    if (!res.ok) return counts;

    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; categories?: Array<{ title: string }> }
        >;
        normalized?: Array<{ from: string; to: string }>;
        redirects?: Array<{ from: string; to: string }>;
      };
    };

    const catsByCanonical = new Map<string, string[]>();
    for (const page of Object.values(data.query?.pages ?? {})) {
      if (!page.title) continue;
      catsByCanonical.set(
        page.title,
        (page.categories ?? []).map((c) => c.title.replace(/^Category:/, ""))
      );
    }

    const normalized = data.query?.normalized ?? [];
    const redirects = data.query?.redirects ?? [];

    for (const t of titles) {
      let resolved = t;
      const n = normalized.find((x) => x.from === resolved);
      if (n) resolved = n.to;
      const r = redirects.find((x) => x.from === resolved);
      if (r) resolved = r.to;
      const raw = catsByCanonical.get(resolved);
      if (raw) {
        counts.set(t, filter(raw, resolved).length);
      }
    }
  } catch {
    // ignore — callers will just see absent counts
  }

  return counts;
}

export async function fetchArticle(title: string): Promise<FetchedArticle> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Empty article title");

  const params = new URLSearchParams({
    action: "query",
    titles: trimmed,
    prop: "categories|info|redirects",
    cllimit: "max",
    clshow: "!hidden",
    inprop: "url",
    rdlimit: "max",
    redirects: "1",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": "catfishing-clone/1.0 (education)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`);

  const data = (await res.json()) as ApiQuery;
  if (data.error) {
    throw new Error(data.error.info || "Wikipedia API error");
  }

  const pages = data.query?.pages ?? {};
  const pageKeys = Object.keys(pages);
  if (pageKeys.length === 0) {
    throw new Error("Article not found. Check the spelling or try a different title.");
  }

  const page = pages[pageKeys[0]];
  if (!page || page.missing !== undefined || page.pageid === -1 || !page.pageid) {
    throw new Error("Article not found. Check the spelling or try a different title.");
  }

  const categories = (page.categories ?? [])
    .map((c) => c.title.replace(/^Category:/, ""))
    .filter(Boolean);

  const aliasesFromPageRedirects = (page.redirects ?? [])
    .map((r) => r.title ?? r.from ?? "")
    .filter(Boolean);
  const aliasesFromQueryRedirects = (data.query?.redirects ?? [])
    .filter((r) => r.to === page.title)
    .map((r) => r.from);
  const aliases = Array.from(
    new Set(
      [...aliasesFromPageRedirects, ...aliasesFromQueryRedirects].filter(
        (s): s is string => !!s
      )
    )
  );

  const isDisambig =
    categories.some((c) => /disambiguation pages/i.test(c)) ||
    categories.some((c) => /^Disambiguation/i.test(c));
  if (isDisambig) {
    throw new Error(
      "That's a disambiguation page. Pick a more specific article."
    );
  }

  const [summary, pageViews] = await Promise.all([
    fetchSummary(page.title),
    fetchPageViewsYearly(page.title),
  ]);

  let thumbnail = summary.thumbnail;
  if (!thumbnail) {
    thumbnail = await fetchFirstArticleImage(page.pageid);
  }

  return {
    title: page.title,
    url:
      page.fullurl ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(
        page.title.replace(/ /g, "_")
      )}`,
    pageId: page.pageid,
    categories,
    aliases,
    summary: summary.extract,
    thumbnailUrl: thumbnail,
    pageViews,
    difficultyScore: computeDifficultyFromPageViews(pageViews),
  };
}
