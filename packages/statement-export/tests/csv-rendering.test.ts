import { describe, expect, it } from "vitest";
import type { ContractorStatementDocument } from "../src/document-types";
import { renderContractorStatementCsv } from "../src/render-statement-csv";

function createSampleDocument(
  overrides: Partial<ContractorStatementDocument> = {}
): ContractorStatementDocument {
  return {
    businessName: "مكتب أحمد أبو علي للنقل",
    counterpartyName: "شركة النيل للمقاولات",
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
      movementCountText: "2",
    },
    rows: [
      {
        reference: "MOV-001",
        workDate: "2026-11-02",
        directionText: "أحمد أحضر العربيات لشغل المقاول",
        amountText: "1,500.00",
        runningBalanceText: "1,100.00",
      },
      {
        reference: "MOV-002",
        workDate: "2026-11-06",
        directionText: "المقاول أحضر العربيات لشغل أحمد",
        amountText: "600.00",
        runningBalanceText: "500.00",
      },
    ],
    ...overrides,
  };
}

/**
 * Independent RFC-4180 state-machine parser for structural verification in tests
 * ( handles CRLF, blank separator lines, quoted fields, and doubled quotes ).
 */
function parseCsvRecords(csvWithBom: string): string[][] {
  const text = csvWithBom.startsWith("\uFEFF")
    ? csvWithBom.slice(1)
    : csvWithBom;
  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      currentRow.push(currentCell);
      currentCell = "";
    } else if (ch === "\r" && text[i + 1] === "\n") {
      if (currentRow.length > 0 || currentCell.length > 0) {
        currentRow.push(currentCell);
        records.push(currentRow);
      } else {
        records.push([]);
      }
      currentRow = [];
      currentCell = "";
      i += 1;
    } else {
      currentCell += ch;
    }
  }

  if (currentRow.length > 0 || currentCell.length > 0) {
    currentRow.push(currentCell);
    records.push(currentRow);
  }

  return records;
}

describe("EXPORT-01 renderContractorStatementCsv", () => {
  it("starts with a single UTF-8 BOM, uses CRLF line endings, quotes every cell, and omits sep=", () => {
    const csv = renderContractorStatementCsv(createSampleDocument());

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1).includes("\uFEFF")).toBe(false);
    expect(csv.includes("sep=")).toBe(false);

    const body = csv.slice(1);
    const rawLines = body.split("\r\n");
    expect(rawLines.length).toBe(18);

    // Non-empty lines must have every cell enclosed in double quotes
    for (const line of rawLines) {
      if (line !== "") {
        expect(line.startsWith('"')).toBe(true);
        expect(line.endsWith('"')).toBe(true);
      }
    }
  });

  it("outputs metadata, summary, blank lines, headers, and detail rows in the exact required order", () => {
    const csv = renderContractorStatementCsv(createSampleDocument());
    const records = parseCsvRecords(csv);

    expect(records).toEqual([
      ["اسم المنشأة", "مكتب أحمد أبو علي للنقل"],
      ["نوع التقرير", "كشف شغل مقاول"],
      ["هوية الحساب", "'+ لأحمد، − على أحمد، 0 متعادل"],
      ["المقاول", "شركة النيل للمقاولات"],
      ["من تاريخ", "2026-11-01"],
      ["إلى تاريخ", "2026-11-10"],
      ["تاريخ الإعداد", "2026-11-10 18:30"],
      [],
      ["رصيد أول الفترة", "'-400.00"],
      ["شغل أحمد خلال الفترة", "1,500.00"],
      ["شغل المقاول خلال الفترة", "600.00"],
      ["رصيد آخر الفترة", "500.00"],
      ["النتيجة", "لصالح أحمد أبو علي"],
      ["عدد الحركات", "2"],
      [],
      [
        "رقم النقلة",
        "التاريخ",
        "اتجاه الشغل",
        "الأثر على حساب أحمد (+/−) — جنيه",
        "الرصيد بعد الحركة — جنيه",
      ],
      [
        "MOV-001",
        "2026-11-02",
        "أحمد أحضر العربيات لشغل المقاول",
        "1,500.00",
        "1,100.00",
      ],
      [
        "MOV-002",
        "2026-11-06",
        "المقاول أحضر العربيات لشغل أحمد",
        "600.00",
        "500.00",
      ],
    ]);
  });

  it("doubles internal quotes and keeps commas and newlines inside a single cell", () => {
    const doc = createSampleDocument({
      businessName: 'شركة "الأمل"، للنقل\nفرع دمياط',
      counterpartyName: 'مقاول "أ"، قسم (1)\r\nملاحظة داخلية',
    });

    const csv = renderContractorStatementCsv(doc);
    const records = parseCsvRecords(csv);

    expect(records[0]).toEqual([
      "اسم المنشأة",
      'شركة "الأمل"، للنقل\nفرع دمياط',
    ]);
    expect(records[3]).toEqual([
      "المقاول",
      'مقاول "أ"، قسم (1)\r\nملاحظة داخلية',
    ]);
  });

  it("applies spreadsheet formula guard to cells starting with =, +, -, @ (including after whitespace) or leading tab/CR/LF", () => {
    const cases: readonly { readonly raw: string; readonly expected: string }[] =
      [
        { raw: "=SUM(A1:A5)", expected: "'=SUM(A1:A5)" },
        { raw: "+100.00", expected: "'+100.00" },
        { raw: "-100.00", expected: "'-100.00" },
        { raw: "@HYPERLINK(\"http://x\")", expected: "'@HYPERLINK(\"http://x\")" },
        { raw: "   =1+1", expected: "'   =1+1" },
        { raw: "  +cmd", expected: "'  +cmd" },
        { raw: "   -250.50", expected: "'   -250.50" },
        { raw: " \t @risk", expected: "' \t @risk" },
        { raw: "\tSafeTextAfterTab", expected: "'\tSafeTextAfterTab" },
        { raw: "\rCarriageReturnStart", expected: "'\rCarriageReturnStart" },
        { raw: "\nLineFeedStart", expected: "'\nLineFeedStart" },
        { raw: "00012345", expected: "00012345" },
        {
          raw: "999999999999999999999999.99",
          expected: "999999999999999999999999.99",
        },
        { raw: "نص عادي مع - بالوسط = آمن", expected: "نص عادي مع - بالوسط = آمن" },
      ];

    for (const testCase of cases) {
      const csv = renderContractorStatementCsv(
        createSampleDocument({
          counterpartyName: testCase.raw,
        })
      );
      const records = parseCsvRecords(csv);
      expect(records[3]?.[1]).toBe(testCase.expected);
    }
  });

  it("keeps summary and detail headers when rows are empty and does not mutate frozen inputs", () => {
    const frozenEmptyDoc: ContractorStatementDocument = Object.freeze({
      businessName: "مكتب أحمد أبو علي",
      counterpartyName: "المقاول المتحد",
      period: Object.freeze({ from: "2026-11-01", to: "2026-11-10" }),
      generatedAtLabel: "2026-11-10",
      summary: Object.freeze({
        openingBalanceText: "0.00",
        ahmedWorkText: "0.00",
        counterpartyWorkText: "0.00",
        closingBalanceText: "0.00",
        closingBeneficiaryText: "متعادل",
        movementCountText: "0",
      }),
      rows: Object.freeze([]),
    });

    const csv = renderContractorStatementCsv(frozenEmptyDoc);
    const records = parseCsvRecords(csv);

    expect(frozenEmptyDoc.rows.length).toBe(0);
    expect(records.length).toBe(16);
    expect(records[15]).toEqual([
      "رقم النقلة",
      "التاريخ",
      "اتجاه الشغل",
      "الأثر على حساب أحمد (+/−) — جنيه",
      "الرصيد بعد الحركة — جنيه",
    ]);
  });
});
