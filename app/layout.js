import "./globals.css";
import { IconSprite } from "@/components/Icon";

export const metadata = {
  title: "IELTS with Ms Nhi",
  description: "IELTS LMS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
