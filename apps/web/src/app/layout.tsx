import type { Metadata } from "next";
import "../styles/variables.css";
import "../styles/globals.css";
import { SiteShell } from "../components/site-shell";

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "أحمد أبو علي — حسابات النقل",
  description: "نظام حسابات النقل والمقاولين",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl">
    <head><link rel="stylesheet" href="/fonts/cairo.css" /></head>
    <body>
      <a href="#main-content" className="skipLink">تخطي التنقل إلى المحتوى الرئيسي</a>
      <SiteShell>{children}</SiteShell>
    </body>
  </html>;
}
