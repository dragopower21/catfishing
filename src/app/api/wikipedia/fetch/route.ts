import { fetchArticle, titleFromUrl } from "@/lib/wikipedia";
import { filterCategories } from "@/lib/filterCategories";
import { checkRate, clientKey, tooManyRequests } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rate = checkRate(clientKey(request, "wiki-fetch"), 30, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetInMs);

  let body: { urlOrTitle?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const input =
    typeof body.urlOrTitle === "string"
      ? body.urlOrTitle.trim().slice(0, 500)
      : "";
  if (!input) {
    return Response.json(
      { error: "urlOrTitle is required" },
      { status: 400 }
    );
  }

  const lookupTitle = input.startsWith("http")
    ? titleFromUrl(input) ?? input
    : input;

  try {
    const fetched = await fetchArticle(lookupTitle);
    const filtered = filterCategories(fetched.categories, fetched.title);
    return Response.json({
      title: fetched.title,
      url: fetched.url,
      pageId: fetched.pageId,
      categories: filtered,
      rawCategoryCount: fetched.categories.length,
      aliases: fetched.aliases,
      summary: fetched.summary,
      thumbnailUrl: fetched.thumbnailUrl,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 400 }
    );
  }
}
