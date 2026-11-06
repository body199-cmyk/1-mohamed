import { describe, expect, it } from "vitest";
import type {
  ContractorStatementDocument,
  ContractorStatementRow,
} from "../src/document-types";
import { renderContractorStatementHtml } from "../src/render-statement-html";

function createSampleDocument(
  overrides: Partial<ContractorStatementDocument> = {}
): ContractorStatementDocument {
  return {
    businessName: "مكتب أحمد أبو علي للنقل",
    counterpartyName: "شركة النيل للمقاولات والنقل",
    period: {
      from: "2026-11-01",
      to: "2026-11-10",
    },
    generatedAtLabel: "2026-11-10 18:30",
    summary: {
      openingBalanceText: "-400.00",
      ahmedWorkText: "1,500.00",
      counterpartyWorkText: "600.00",
      closingBalanceText: "500.00",
      closingBeneficiaryText: "لصالح أحمد أبو علي",
      movementCountText: "3",
    },
    rows: [
      {
        reference: "MOV-001",
        workDate: "2026-11-02",
        directionText: "أحمد أحضر العربيات لشغل المقاول",
        amountText: "300.00",
        runningBalanceText: "-100.00",
      },
      {
        reference: "MOV-002",
        workDate: "2026-11-05",
        directionText: "أحمد أحضر العربيات لشغل المقاول",
        amountText: "1,000.00",
        runningBalanceText: "900.00",
      },
      {
        reference: "MOV-003",
        workDate: "2026-11-06",
        directionText: "المقاول أحضر العربيات لشغل أحمد",
        amountText: "600.00",
        runningBalanceText: "300.00",
      },
    ],
    ...overrides,
  };
}

describe("EXPORT-01 renderContractorStatementHtml", () => {
  it("renders a complete RTL Arabic HTML document with business name, title, contractor, period, and timestamp", () => {
    const html = renderContractorStatementHtml(createSampleDocument());

    expect(html.startsWith("<!doctype html>\n<html lang=\"ar\" dir=\"rtl\">")).toBe(
      true
    );
    expect(html.endsWith("</html>")).toBe(true);
    expect(html.includes("مكتب أحمد أبو علي للنقل")).toBe(true);
    expect(html.includes("كشف شغل مقاول")).toBe(true);
    expect(html.includes("شركة النيل للمقاولات والنقل")).toBe(true);
    expect(html.includes("2026-11-01")).toBe(true);
    expect(html.includes("2026-11-10")).toBe(true);
    expect(html.includes("2026-11-10 18:30")).toBe(true);
    expect(html.includes("فرق الشغل")).toBe(true);
  });

  it("places the summary section before the details table and preserves all required headings", () => {
    const html = renderContractorStatementHtml(createSampleDocument());

    const summaryLabels = [
      "رصيد أول الفترة",
      "شغل أحمد خلال الفترة",
      "شغل المقاول خلال الفترة",
      "رصيد آخر الفترة",
      "النتيجة",
      "عدد الحركات",
    ];
    for (const label of summaryLabels) {
      expect(html.includes(label)).toBe(true);
    }

    const detailHeaders = [
      "رقم النقلة",
      "التاريخ",
      "رقم الإيصال",
      "اتجاه الشغل",
      "الأثر على حساب أحمد (+/−) — جنيه",
      "الرصيد بعد الحركة — جنيه",
    ];
    for (const header of detailHeaders) {
      expect(html.includes(header)).toBe(true);
    }

    const lastSummaryLabelPos = html.indexOf("عدد الحركات");
    const firstTableHeaderPos = html.indexOf("رقم النقلة");
    expect(lastSummaryLabelPos > 0).toBe(true);
    expect(firstTableHeaderPos > lastSummaryLabelPos).toBe(true);
  });

  it("renders caller-supplied values verbatim without recalculating totals or row counts", () => {
    const doc = createSampleDocument({
      summary: {
        openingBalanceText: "-999,999,999,999,999,999.99",
        ahmedWorkText: "888,888,888,888,888,888.50",
        counterpartyWorkText: "000125.00",
        closingBalanceText: "-111,111,111,111,111,236.49",
        closingBeneficiaryText: "نص مستفيد مرسل كما هو من المستدعي",
        movementCountText: "999 (نص حر دون إعادة عد)",
      },
    });

    const html = renderContractorStatementHtml(doc);

    expect(html.includes("-999,999,999,999,999,999.99")).toBe(true);
    expect(html.includes("888,888,888,888,888,888.50")).toBe(true);
    expect(html.includes("000125.00")).toBe(true);
    expect(html.includes("-111,111,111,111,111,236.49")).toBe(true);
    expect(html.includes("نص مستفيد مرسل كما هو من المستدعي")).toBe(true);
    expect(html.includes("999 (نص حر دون إعادة عد)")).toBe(true);
  });

  it("renders all rows in their exact input order and keeps identical-looking rows separate", () => {
    const rows: readonly ContractorStatementRow[] = [
      {
        reference: "REF-Z-FIRST",
        workDate: "2026-11-09",
        directionText: "أحمد أحضر العربيات لشغل المقاول",
        amountText: "500.00",
        runningBalanceText: "500.00",
      },
      {
        reference: "REF-A-SECOND",
        workDate: "2026-11-02",
        directionText: "أحمد أحضر العربيات لشغل المقاول",
        amountText: "500.00",
        runningBalanceText: "1,000.00",
      },
      {
        reference: "REF-A-SECOND",
        workDate: "2026-11-02",
        directionText: "أحمد أحضر العربيات لشغل المقاول",
        amountText: "500.00",
        runningBalanceText: "1,500.00",
      },
    ];

    const html = renderContractorStatementHtml(createSampleDocument({ rows }));

    const firstIndex = html.indexOf("REF-Z-FIRST");
    const secondIndex = html.indexOf("REF-A-SECOND");
    const thirdIndex = html.indexOf("REF-A-SECOND", secondIndex + 1);

    expect(firstIndex > 0).toBe(true);
    expect(secondIndex > firstIndex).toBe(true);
    expect(thirdIndex > secondIndex).toBe(true);
  });

  it("displays the empty state message when rows are empty while keeping the full summary", () => {
    const html = renderContractorStatementHtml(
      createSampleDocument({
        summary: {
          openingBalanceText: "-250.00",
          ahmedWorkText: "0.00",
          counterpartyWorkText: "0.00",
          closingBalanceText: "-250.00",
          closingBeneficiaryText: "لصالح المقاول",
          movementCountText: "0",
        },
        rows: [],
      })
    );

    expect(html.includes("لا توجد حركات خلال الفترة")).toBe(true);
    expect(html.includes("رصيد أول الفترة")).toBe(true);
    expect(html.includes("-250.00")).toBe(true);
    expect(html.includes("لصالح المقاول")).toBe(true);
  });

  it("escapes HTML special characters and neutralizes script/img injection payloads across all fields", () => {
    const doc = createSampleDocument({
      businessName: "<script>alert(1)</script>",
      counterpartyName: "<img src=x onerror=alert(1)>",
      generatedAtLabel: "2026-11-10 & < > \" '",
      summary: {
        openingBalanceText: "-100.00\" onclick=\"alert(1)",
        ahmedWorkText: "<b>1500</b>",
        counterpartyWorkText: "'600'",
        closingBalanceText: "&500",
        closingBeneficiaryText: "<svg onload=alert(1)>",
        movementCountText: "1",
      },
      rows: [
        {
          reference: "REF-<script>alert(1)</script>",
          workDate: "2026-11-05",
          directionText: "اتجاه & < > \" ' <img src=x onerror=alert(1)>",
          amountText: "1,250.50",
          runningBalanceText: "-100.00",
        },
      ],
    });

    const html = renderContractorStatementHtml(doc);

    expect(html.includes("<script>")).toBe(false);
    expect(html.includes("<img ")).toBe(false);
    expect(html.includes("<svg ")).toBe(false);
    expect(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe(true);
    expect(html.includes("&lt;img src=x onerror=alert(1)&gt;")).toBe(true);
    expect(html.includes("2026-11-10 &amp; &lt; &gt; &quot; &#39;")).toBe(true);
    expect(
      html.includes(
        "اتجاه &amp; &lt; &gt; &quot; &#39; &lt;img src=x onerror=alert(1)&gt;"
      )
    ).toBe(true);
  });

  it("preserves long Arabic names, long references, and 200 detail rows without truncation or mutating frozen input", () => {
    const longReference =
      "REF-LONG-2026-11-CONTRACTOR-STATEMENT-SEGMENT-0001-9999-ALPHA-BETA-GAMMA";
    const rows: ContractorStatementRow[] = [];

    for (let i = 1; i <= 200; i += 1) {
      rows.push(
        Object.freeze({
          reference: `${longReference}-${String(i).padStart(3, "0")}`,
          workDate: "2026-11-06",
          directionText:
            "أحمد أحضر العربيات لشغل المقاول في موقع مشروع التوسعة الشمالية",
          amountText: "12,345.67",
          runningBalanceText: "-98,765.43",
        })
      );
    }

    const frozenDoc: ContractorStatementDocument = Object.freeze({
      businessName: "مؤسسة النقل الثقيل والتوريدات العمومية",
      counterpartyName:
        "شركة المقاولون المتحدون لأعمال النقل والمحاجر والتوريدات بالوجه البحري",
      period: Object.freeze({ from: "2026-11-01", to: "2026-11-30" }),
      generatedAtLabel: "2026-11-30 22:00",
      summary: Object.freeze({
        openingBalanceText: "-50,000.00",
        ahmedWorkText: "2,469,134.00",
        counterpartyWorkText: "100,000.00",
        closingBalanceText: "2,319,134.00",
        closingBeneficiaryText: "لصالح أحمد أبو علي",
        movementCountText: "200",
      }),
      rows: Object.freeze(rows),
    });

    const html = renderContractorStatementHtml(frozenDoc);

    expect(frozenDoc.rows.length).toBe(200);
    expect(html.includes(`${longReference}-001`)).toBe(true);
    expect(html.includes(`${longReference}-100`)).toBe(true);
    expect(html.includes(`${longReference}-200`)).toBe(true);

    const tbodyMatch = /<table class="details-table">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/.exec(
      html
    );
    expect(tbodyMatch !== null).toBe(true);
    const renderedTrCount = (tbodyMatch![1]!.match(/<tr>/g) ?? []).length;
    expect(renderedTrCount).toBe(200);
  });
});
