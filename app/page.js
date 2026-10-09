import { headers } from "next/headers";
import Landing from "@/components/landing/Landing";
import SessionRedirect from "@/components/SessionRedirect";
import { shouldShowLanding, TAGLINE } from "@/lib/landing";
import { siteOrigin } from "@/lib/seo";
import { PLATFORM_NAME } from "@/lib/platform";

// Phụ thuộc tên miền truy cập nên luôn render theo request.
export const dynamic = "force-dynamic";

const DESCRIPTION =
  "BeMyFlo giúp giáo viên và trung tâm IELTS giao bài, chấm Writing và Speaking có AI hỗ trợ, điểm danh và theo dõi học viên. Đang miễn phí trong giai đoạn thử nghiệm.";

export function generateMetadata() {
  if (!shouldShowLanding(headers().get("host"))) return {};
  const origin = siteOrigin();
  const title = `${PLATFORM_NAME} – ${TAGLINE}`;
  return {
    title,
    description: DESCRIPTION,
    ...(origin ? { alternates: { canonical: origin + "/" } } : {}),
    openGraph: {
      title,
      description: DESCRIPTION,
      siteName: PLATFORM_NAME,
      type: "website",
      locale: "vi_VN",
      ...(origin ? { url: origin + "/", images: [{ url: origin + "/og.png", width: 1200, height: 630, alt: PLATFORM_NAME }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION, ...(origin ? { images: [origin + "/og.png"] } : {}) },
  };
}

export default function Index() {
  if (shouldShowLanding(headers().get("host"))) return <Landing />;
  return <SessionRedirect />;
}
