import type {
  ContractorStatementDocument,
  ContractorStatementRow,
} from "./document-types";
import { escapeHtmlText } from "./html-escape";
import { STATEMENT_PRINT_STYLES } from "./statement-print-styles";

function renderDetailRowHtml(row: ContractorStatementRow): string {
  const reference = escapeHtmlText(row.reference);
  const workDate = escapeHtmlText(row.workDate);
  const directionText = escapeHtmlText(row.directionText);
  const amountText = escapeHtmlText(row.amountText);
  const runningBalanceText = escapeHtmlText(row.runningBalanceText);

  return [
    "          <tr>",
    `            <td><span class="ltr-token">${reference}</span></td>`,
    `            <td><span class="ltr-token">${workDate}</span></td>`,
    `            <td>${directionText}</td>`,
    `            <td class="${row.amountText.startsWith("-") ? "signed-negative" : row.amountText.startsWith("+") ? "signed-positive" : ""}"><span class="ltr-token">${amountText}</span></td>`,
    `            <td><span class="ltr-token">${runningBalanceText}</span></td>`,
    "          </tr>",
  ].join("\n");
}

export function renderContractorStatementHtml(
  document: ContractorStatementDocument
): string {
  const businessName = escapeHtmlText(document.businessName);
  const counterpartyName = escapeHtmlText(document.counterpartyName);
  const periodFrom = escapeHtmlText(document.period.from);
  const periodTo = escapeHtmlText(document.period.to);
  const generatedAtLabel = escapeHtmlText(document.generatedAtLabel);

  const openingBalanceText = escapeHtmlText(
    document.summary.openingBalanceText
  );
  const ahmedWorkText = escapeHtmlText(document.summary.ahmedWorkText);
  const counterpartyWorkText = escapeHtmlText(
    document.summary.counterpartyWorkText
  );
  const closingBalanceText = escapeHtmlText(
    document.summary.closingBalanceText
  );
  const closingBeneficiaryText = escapeHtmlText(
    document.summary.closingBeneficiaryText
  );
  const movementCountText = escapeHtmlText(document.summary.movementCountText);

  const detailRowsHtml =
    document.rows.length === 0
      ? [
          "          <tr>",
          '            <td colspan="5" class="empty-state-cell">لا توجد حركات خلال الفترة</td>',
          "          </tr>",
        ].join("\n")
      : document.rows.map(renderDetailRowHtml).join("\n");

  return [
    "<!doctype html>",
    '<html lang="ar" dir="rtl">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>كشف شغل مقاول — ${counterpartyName}</title>`,
    `  <style>${STATEMENT_PRINT_STYLES}</style>`,
    "</head>",
    "<body>",
    '  <main class="statement-page">',
    '    <header class="statement-header">',
    `      <p class="business-name">${businessName}</p>`,
    '      <h1 class="report-title">كشف شغل مقاول</h1>',
    '      <div class="meta-grid">',
    '        <div class="meta-item">',
    '          <span class="meta-label">المقاول</span>',
    `          <span class="meta-value">${counterpartyName}</span>`,
    "        </div>",
    '        <div class="meta-item">',
    '          <span class="meta-label">الفترة</span>',
    `          <span class="meta-value">من <span class="ltr-token">${periodFrom}</span> إلى <span class="ltr-token">${periodTo}</span></span>`,
    "        </div>",
    '        <div class="meta-item">',
    '          <span class="meta-label">تاريخ الإعداد</span>',
    `          <span class="meta-value"><span class="ltr-token">${generatedAtLabel}</span></span>`,
    "        </div>",
    "      </div>",
    "    </header>",
    "",
    '    <section class="summary-section" aria-label="ملخص الكشف">',
    '      <h2 class="section-heading">ملخص الكشف</h2>',
    '      <table class="summary-table">',
    "        <tbody>",
    "          <tr>",
    '            <th scope="row">رصيد أول الفترة</th>',
    `            <td><span class="ltr-token">${openingBalanceText}</span></td>`,
    "          </tr>",
    "          <tr>",
    '            <th scope="row">شغل أحمد خلال الفترة</th>',
    `            <td><span class="ltr-token">${ahmedWorkText}</span></td>`,
    "          </tr>",
    "          <tr>",
    '            <th scope="row">شغل المقاول خلال الفترة</th>',
    `            <td><span class="ltr-token">${counterpartyWorkText}</span></td>`,
    "          </tr>",
    '          <tr class="summary-closing-row">',
    '            <th scope="row">رصيد آخر الفترة</th>',
    `            <td><span class="ltr-token">${closingBalanceText}</span></td>`,
    "          </tr>",
    '          <tr class="summary-closing-row">',
    '            <th scope="row">النتيجة</th>',
    `            <td>${closingBeneficiaryText}</td>`,
    "          </tr>",
    "          <tr>",
    '            <th scope="row">عدد الحركات</th>',
    `            <td><span class="ltr-token">${movementCountText}</span></td>`,
    "          </tr>",
    "        </tbody>",
    "      </table>",
    "    </section>",
    "",
    '    <section class="details-section" aria-label="تفاصيل الحركات">',
    '      <h2 class="section-heading">تفاصيل الحركات</h2>',
    '      <table class="details-table">',
    "        <thead>",
    "          <tr>",
    '            <th scope="col" class="col-ref">رقم النقلة</th>',
    '            <th scope="col" class="col-date">التاريخ</th>',
    '            <th scope="col" class="col-dir">اتجاه الشغل</th>',
    '            <th scope="col" class="col-amount">الأثر على حساب أحمد (+/−) — جنيه</th>',
    '            <th scope="col" class="col-balance">الرصيد بعد الحركة — جنيه</th>',
    "          </tr>",
    "        </thead>",
    "        <tbody>",
    detailRowsHtml,
    "        </tbody>",
    "      </table>",
    "    </section>",
    "",
    '    <footer class="statement-footer">',
    "      هذا الكشف يوضح فرق الشغل المتبادل بين المقاولين خلال الفترة المحددة، ولا يشمل دفعات العربيات النقدية المستقلة.",
    "    </footer>",
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n");
}
