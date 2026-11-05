# H058 — Reports and export polish review

Scope: CSS and presentation only for contractor statement, daily work report, and export action controls; vehicle cash statement reuses themed payments CSS. No modification to statement documents, monetary formulas, payment balance or file generation libraries.

Issues: export actions used SELECT control CSS styles (misleading affordance) on five BUTTON elements; badges and error background used hard-coded light-only hex values inconsistent with dark theme. Fix: dedicated exportButton, primary direct PDF, small-screen wrap, focus-ring intact, CSS theme tokens. Daily report filters/table align with the rest of the app.

Gate: 3 Playwright tests, mobile/tablet/desktop no body overflow across three report routes, 5 visible semantic export BUTTONs with focus outline and minimum target, Light/Dark screenshot six states; full previous 34 browser, package, isolated SQL and three negative controls, backup 12, Next build and HTTP Auth default-deny. Second review and exact-head CI before merge. No Vercel/Supabase; final visual user signoff H059 later.
