"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "./theme-provider";
import { DemoStoreProvider } from "../demo/demo-context";
import { EntrySessionProvider } from "../demo/entry-session-context";
import { DemoBanner } from "./demo-banner";
import { NavHeader } from "./nav-header";

/**
 * Keep the legacy demo providers and public navigation strictly in /demo.
 * The login/recovery/private workspace never inherits seeded demo data or
 * links to public preview pages. Final cutover will disable public /demo.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const demo = pathname === "/demo" || pathname.startsWith("/demo/");
  return <ThemeProvider>
    {demo ? <DemoStoreProvider><EntrySessionProvider>
      <DemoBanner />
      <div className="appShell">
        <NavHeader />
        <div className="appWorkspace">
          <main id="main-content" tabIndex={-1} className="container appMain">{children}</main>
        </div>
      </div>
    </EntrySessionProvider></DemoStoreProvider> :
      <main id="main-content" tabIndex={-1} className="container appMain">{children}</main>}
  </ThemeProvider>;
}

