# H060 — Adopt an existing visual system, not a blank-slate design

## User direction and researched source
On November 6, 2026 the user explicitly rejected another self-invented visual treatment and instructed us to research a pre-existing visual identity online and implement it in the transport-ledger repository. Selected **Tabler Admin Template** as a reproducible, documented reference:
- Official site: https://tabler.io/admin-template
- Official docs and stated MIT license: https://docs.tabler.io/ui/getting-started
- Tabler open-source repository: https://github.com/tabler/tabler
- Supported interface characteristics: responsive cards/tables/forms, vertical sidebar layout, RTL, light/dark themes.
  
**Use and branding boundary:** We reference Tabler's documented visual layout principles, but do not claim Tabler's brand is the business's identity, copy its logo/assets or import any third-party template source. The app retains its existing Arabic name and Cairo font. We use our original Next.js/React components with CSS Modules and no new dependencies. Full business-specific visual approval remains with the user.

## Scoped implementation
1. Change shared light/dark neutral design tokens and card radius/shadows to Tabler-inspired scale.
2. Existing `NavHeader` remains same semantic links/aria-current/theme control. On desktop >=1101px, display its existing nav as a **right-hand sidebar** via CSS, on <=1100px preserve scrollable horizontal navigation (H055 regression).
3. `RootLayout` adds only `appShell` and `appWorkspace` around nav/main, preserving providers, single skip link, demo warning and #main-content.
4. Restyle only Dashboard CSS (subtle gradient, flatter KPI cards, blue action), preserving JSX, metric totals, histories and links.
5. CI includes 3 H060 Playwright cases and eight 360/1280 light/dark screenshots of dashboard and contractor statement. Expected 47 browser tests plus existing package/SQL/security/backup/build/HTTP checks.

## Risks and controls
- A right sidebar reduces desktop content width, so existing 1280px dashboard geometry and 360/768/1024 no-overflow tests must pass unchanged; reviewer checks screenshot layouts and nested table scrolling.
- Contrast guard: light blue CTA on white text and dark blue CTA with dark text remain >=4.5:1; H059 active-link and H055 warning checks stay mandatory.
- Financial figures, payment day, recovery contracts, export files, user data, routing and Auth are unchanged; screenshot/test success alone does not certify real mobile devices.
- This is **H060 foundation**; H061 can make bounded per-page adjustments after visual review. No user visual sign-off is asserted.
