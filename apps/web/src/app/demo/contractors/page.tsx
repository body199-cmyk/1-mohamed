import { ContractorStatementsView } from "../../../features/contractor-statements/contractor-statements-view";

export const metadata = {
  title: "كشف حساب المقاول — نظام نقليات النور",
};

export default function DemoContractorsPage() {
  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
      <ContractorStatementsView />
    </div>
  );
}
