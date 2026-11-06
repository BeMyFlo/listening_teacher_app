import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { IconSprite } from "@/components/Icon";
import { PLATFORM_NAME } from "@/lib/platform";

// Font chính của app — next/font tự tải về lúc build và host cùng app (không
// gọi Google Fonts lúc chạy). Biến --font-sans dùng trong styles/legacy.css.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sans",
});

const TITLE = `${PLATFORM_NAME} – Quản lý lớp học cho giáo viên`;
const DESCRIPTION =
  "BeMyFlo giúp giáo viên và trung tâm quản lý lớp học: giao bài, chấm bài bằng AI, theo dõi tiến độ và điểm danh học viên. Học viên làm bài luyện tập và thi thử online.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  applicationName: PLATFORM_NAME,
  keywords: ["quản lý lớp học", "phần mềm quản lý trung tâm", "giao bài cho học viên", "chấm bài bằng AI", "điểm danh học viên", "thi thử online"],
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: PLATFORM_NAME, type: "website", locale: "vi_VN" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
