import "./globals.css";
import { IconSprite } from "@/components/Icon";
import { PLATFORM_NAME } from "@/lib/platform";

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
    <html lang="en">
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
