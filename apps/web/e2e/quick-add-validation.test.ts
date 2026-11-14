import { describe, expect, it } from "vitest";
import { validateQuickContractorName, validateQuickPlate } from "../src/features/ledger/quick-add-validation";

describe("quick-add duplicate validation", () => {
  it("rejects an empty plate", () => {
    expect(validateQuickPlate("   ", ["عربية ١"])).toBe("أدخل رقم اللوحة.");
  });
  it("rejects a plate duplicate after Arabic-digit and spacing normalization", () => {
    expect(validateQuickPlate("د هـ و ٥٦٧٨", ["د هـ و 5678"])).toBe(
      "اللوحة مسجلة بالفعل. اخترها من القائمة بدل إضافتها مرتين.");
    expect(validateQuickPlate("ط س ر ١٢٣ ", ["ط  س ر 123"])).not.toBeNull();
  });
  it("accepts a distinct plate", () => {
    expect(validateQuickPlate("د هـ و 5678", ["ط س ر 123"])).toBeNull();
  });
  it("rejects an empty contractor name", () => {
    expect(validateQuickContractorName(" ", ["مصنع النور"])).toBe("أدخل اسم المقاول.");
  });
  it("rejects a name duplicate after spacing normalization", () => {
    expect(validateQuickContractorName("مصنع  النور", ["مصنع النور"])).toBe(
      "الاسم مسجل بالفعل. اختره من القائمة بدل إضافتها مرتين.");
  });
  it("allows partial name similarity", () => {
    expect(validateQuickContractorName("مصنع النور", ["مصنع النور للأعمال"])).toBeNull();
  });
});
