import { getCatalog } from "@/lib/data/catalog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const catalog = await getCatalog({
    category: url.searchParams.get("category"),
    language: url.searchParams.get("language"),
    format: url.searchParams.get("format"),
    campaignId: url.searchParams.get("campaignId"),
    limit: Number(url.searchParams.get("limit") ?? 96),
  });

  return Response.json(catalog);
}
