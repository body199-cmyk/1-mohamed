# H051 / T08.6 — Second-pass review checklist

- Work totals from canonical buildDailyWorkReport with original snapshot validation and two directions; NOT equal to contractor difference or vehicle cash balance.
- Payment totals use only noncancelled payments on exact Cairo date; text piastres converted via BigInt, reject malformed/overflow or aggregate overflow. No netting or cross-account adjustment.
- Recent records show actual dates and archived history. Links connect to independent daily work, cash vehicle and contractor work screens. No new financial write paths or APIs.
- Accessible root redirect / -> /demo/dashboard in demo only, HTTP allowlist stays only /demo paths; unknown /dashboard and POST must continue denying.
- Unit 6 covers correct actual-day work, cash-only, canceled and no-work cases, invalid snapshot/amount and >2^53; Chromium 2 covers root/navigation and payment cross-route/mobile; run all existing packages, PostgreSQL suites, three negative controls, build, SDK/HTTP auth guards, and existing 17 E2E.
- Limits: DemoStore in-memory only and never a production dashboard; actual persisted and concurrent results require Supabase integration later, no Vercel.
