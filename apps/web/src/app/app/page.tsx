import type { Metadata } from "next";
import { RealWorkspace } from "../../features/ledger/real-workspace";

export const metadata: Metadata = { title: "حسابات النقل — مساحة العمل" };

/**
 * Server-backed workspace only; no DemoStoreProvider or sample seed records.
 * Private access is gated by proxy.ts, signed claims, app_is_owner(), and the
 * Route Handler checks. This route never mounts the demo store or sample data.
 */
export default function ProtectedWorkspacePage() {
  return <RealWorkspace />;
}
