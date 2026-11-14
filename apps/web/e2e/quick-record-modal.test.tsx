import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchableChoice } from "../src/features/ledger/searchable-choice";
import { QuickRecordModal } from "../src/features/ledger/quick-record-modal";

const noop = () => undefined;

describe("quick record modal markup", () => {
  it("renders nothing when closed", () => {
    const html = renderToStaticMarkup(
      <QuickRecordModal kind="vehicle" open={false} busy={false} existing={[]}
        onClose={noop} onCreate={async () => "V2"} onCreated={noop} />);
    expect(html).toBe("");
  });
  it("vehicle dialog shows plate field, driver field and submit button", () => {
    const html = renderToStaticMarkup(
      <QuickRecordModal kind="vehicle" open busy={false} existing={["عربية ١"]}
        onClose={noop} onCreate={async () => "V2"} onCreated={noop} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("إضافة عربية سريعة");
    expect(html).toContain("رقم اللوحة");
    expect(html).toContain("اسم السائق");
    expect(html).toContain("حفظ وإضافة");
    expect(html).toContain("إلغاء");
  });
  it("contractor dialog shows name field only", () => {
    const html = renderToStaticMarkup(
      <QuickRecordModal kind="contractor" open busy={false} existing={["مصنع النور"]}
        onClose={noop} onCreate={async () => "K2"} onCreated={noop} />);
    expect(html).toContain("إضافة مقاول سريع");
    expect(html).toContain("اسم المقاول");
    expect(html).not.toContain("اسم السائق");
  });
  it("disables submit while busy", () => {
    const html = renderToStaticMarkup(
      <QuickRecordModal kind="vehicle" open busy existing={[]}
        onClose={noop} onCreate={async () => "V2"} onCreated={noop} />);
    expect(/<button[^>]*disabled[^>]*>[^<]*حفظ وإضافة/.test(html.replace(/\s+/g, " "))).toBe(true);
  });
});

describe("SearchableChoice add affordance", () => {
  it("renders the add button when onAdd is provided", () => {
    const html = renderToStaticMarkup(
      <SearchableChoice id="c1" label="العربية" choices={[{ id: "V1", label: "عربية ١" }]}
        value="" onChange={noop} disabled={false} onAdd={noop} addLabel="+ عربية جديدة" />);
    expect(html).toContain('id="c1-add"');
    expect(html).toContain("+ عربية جديدة");
  });
  it("renders no add button without onAdd", () => {
    const html = renderToStaticMarkup(
      <SearchableChoice id="c2" label="العربية" choices={[]} value="" onChange={noop} disabled={false} />);
    expect(html).not.toContain("-add");
  });
});
