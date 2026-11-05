import { EntrySessionProvider } from "../demo/entry-session-context";
import type { Metadata } from "next";
import "../styles/variables.css";
import "../styles/globals.css";
import { ThemeProvider } from "../components/theme-provider";
import { DemoStoreProvider } from "../demo/demo-context";
import { DemoBanner } from "../components/demo-banner";
import { NavHeader } from "../components/nav-header";

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "أحمد أبو علي — حسابات النقل — معاينة تجريبية تفاعلية",
  description: "معاينة تفاعلية لتسجيل النقلات وكشوف حسابات المقاولين",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head><link rel="stylesheet" href="/fonts/cairo.css" /></head>

      <body>
        <a href="#main-content" className="skipLink">تخطي التنقل إلى المحتوى الرئيسي</a>
        <ThemeProvider>
          <DemoStoreProvider><EntrySessionProvider>
            <DemoBanner />
            <NavHeader />
            <main id="main-content" tabIndex={-1} className="container" style={{ paddingBlock: "24px" }}>
              {children}
            </main>
          </EntrySessionProvider></DemoStoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
