import "./globals.css";
import { IconSprite } from "@/components/Icon";

export const metadata = {
  title: "Ms Nhi",
  description: "IELTS LMS",
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
