import { fetchArticle, titleFromUrl } from "@/lib/wikipedia";
import { filterCategories } from "@/lib/filterCategories";

export async function POST(request: Request) {
  let body: { urlOrTitle?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const input =
    typeof body.urlOrTitle === "string" ? body.urlOrTitle.trim() : "";
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
