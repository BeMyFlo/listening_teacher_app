import { headers } from "next/headers";
import { robotsFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function robots() {
  return robotsFor((await headers()).get("host"));
}
