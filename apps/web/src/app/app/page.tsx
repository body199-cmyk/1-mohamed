import type { Metadata } from "next";
import { RealWorkspace } from "../../features/ledger/real-workspace";

export const metadata: Metadata = { title: "حسابات النقل — مساحة العمل" };

/**
 * Server-backed workspace only; no DemoStoreProvider or sample seed records.
 * The existing proxy still denies private access until final Auth/RLS cutover.
 */
export default function ProtectedWorkspacePage() {
  return <RealWorkspace />;
}
