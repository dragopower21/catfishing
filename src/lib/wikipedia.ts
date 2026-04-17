export type WikipediaSuggestion = {
  title: string;
  description: string;
  url: string;
};

export type FetchedArticle = {
  title: string;
  url: string;
  pageId: number;
  categories: string[];
  aliases: string[];
  summary: string | null;
  thumbnailUrl: string | null;
};

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

  const [summary, fallbackImage] = await Promise.all([
    fetchSummary(page.title),
    Promise.resolve(null as string | null),
  ]);

  let thumbnail = summary.thumbnail;
  if (!thumbnail) {
    thumbnail = await fetchFirstArticleImage(page.pageid);
  }
  void fallbackImage;

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
  };
}
