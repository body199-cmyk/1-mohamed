import test from "node:test";
import assert from "node:assert/strict";
import { assessSource, reportForSources } from "./production-preflight.mjs";

const current = {
  rootPage: 'redirect("/demo/home")',
  loginPage: 'export default function LoginNotConfiguredPage() {}',
  proxy: '/** temporary FAIL-CLOSED boundary */',
  layout: '<DemoStoreProvider />',
  demoStore: 'const [trips, setTrips] = useState<DemoTripRecord[]>([])'
};

test("fail closed on known demo-only release blockers", () => {
  const result = reportForSources(current);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.automatedBlockers.length, 4);
  assert.equal(result.mandatoryLiveEvidence.length, 7);
});

test("static source fixes alone never certify real-data readiness", () => {
  const blockers = assessSource({
    rootPage: 'redirect("/home")',
    loginPage: "export default function Login() {}",
    proxy: "export async function proxy() {}",
    layout: "<AppShell />",
    demoStore: "const data = await fetchData()"
  });
  assert.deepEqual(blockers, []);
  assert.equal(reportForSources({
    rootPage: "", loginPage: "", proxy: "", layout: "", demoStore: ""
  }).status, "BLOCKED");
});
