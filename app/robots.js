import { headers } from "next/headers";
import { robotsFor } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function robots() {
  return robotsFor(headers().get("host"));
}
