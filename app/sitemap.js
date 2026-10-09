import { headers } from "next/headers";
import { sitemapFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function sitemap() {
  return sitemapFor(headers().get("host"));
}
