import { headers } from "next/headers";
import { sitemapFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap() {
  return sitemapFor((await headers()).get("host"));
}
