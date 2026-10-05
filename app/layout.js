import "./globals.css";
import { IconSprite } from "@/components/Icon";
import { PLATFORM_NAME } from "@/lib/platform";

export const metadata = {
  title: PLATFORM_NAME,
  description: "Lessons, practice and grading for teachers and students.",
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
