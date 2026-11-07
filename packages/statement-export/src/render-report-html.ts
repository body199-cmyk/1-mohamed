import type { OperationalReportDocument } from "./document-types";
import { escapeHtmlText } from "./html-escape";
import { assertOperationalReportDocument } from "./report-document-validation";
import { STATEMENT_PRINT_STYLES } from "./statement-print-styles";

function cellClass(direction: "rtl" | "ltr" | undefined): string {
  return direction === "ltr" ? ' class="ltr-token"' : "";
}

export function renderOperationalReportHtml(doc: OperationalReportDocument): string {
  assertOperationalReportDocument(doc);
  const business = escapeHtmlText(doc.businessName);
  const title = escapeHtmlText(doc.title);
  const subtitle = escapeHtmlText(doc.subtitle);
  const generated = escapeHtmlText(doc.generatedAtLabel);
  const metadata = doc.metadata.map(item =>
    '        <div class="meta-item"><span class="meta-label">' +
    escapeHtmlText(item.label) + '</span><span class="meta-value' +
    (item.direction === "ltr" ? ' ltr-token' : '') + '">' +
    escapeHtmlText(item.value) + '</span></div>'
  ).join("\n");
  const summaries = doc.summarySections.map(section => {
    const rows = section.metrics.map(metric =>
      '          <tr' + (metric.emphasis ? ' class="summary-closing-row"' : '') + '>' +
      '<th scope="row">' + escapeHtmlText(metric.label) + '</th>' +
      '<td' + cellClass(metric.direction) + '>' + escapeHtmlText(metric.value) + '</td></tr>'
    ).join("\n");
    return '    <section class="summary-section" aria-label="' + escapeHtmlText(section.title) + '">' +
      '<h2 class="section-heading">' + escapeHtmlText(section.title) + '</h2>' +
      '<table class="summary-table"><tbody>' + rows + '</tbody></table></section>';
  }).join("\n");
  const totalWeight = doc.columns.reduce((sum, column) => sum + column.widthWeight, 0);
  const colgroup = doc.columns.map(column =>
    '<col style="width:' + (column.widthWeight / totalWeight * 100).toFixed(4) + '%">'
  ).join("");
  const headings = doc.columns.map(column =>
    '<th scope="col">' + escapeHtmlText(column.label) + '</th>'
  ).join("");
  const body = doc.rows.length
    ? doc.rows.map(row => '<tr>' + row.map((value, index) =>
        '<td' + cellClass(doc.columns[index]!.direction) + '>' +
        escapeHtmlText(value) + '</td>'
      ).join("") + '</tr>').join("\n")
    : '<tr><td colspan="' + doc.columns.length + '" class="empty-state-cell">' +
      escapeHtmlText(doc.emptyMessage) + '</td></tr>';
  const notes = doc.footerNotes.map(note => '<p>' + escapeHtmlText(note) + '</p>').join("\n");
  return [
    "<!doctype html>",
    '<html lang="ar" dir="rtl">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    "  <title>" + title + "</title>",
    "  <style>" + STATEMENT_PRINT_STYLES + "</style>",
    "</head>",
    "<body>",
    '  <main class="statement-page">',
    '    <header class="statement-header">',
    '      <p class="business-name">' + business + "</p>",
    '      <h1 class="report-title">' + title + "</h1>",
    '      <p class="meta-label">' + subtitle + "</p>",
    '      <div class="meta-grid">' + metadata +
    '        <div class="meta-item"><span class="meta-label">تاريخ الإعداد</span>' +
    '<span class="meta-value ltr-token">' + generated + "</span></div>",
    "      </div>",
    "    </header>",
    summaries,
    '    <section class="details-section" aria-label="تفاصيل التقرير">',
    '      <h2 class="section-heading">تفاصيل التقرير</h2>',
    '      <table class="details-table"><colgroup>' + colgroup + '</colgroup>',
    "        <thead><tr>" + headings + "</tr></thead>",
    "        <tbody>" + body + "</tbody>",
    "      </table>",
    "    </section>",
    '    <footer class="statement-footer">' + notes + "</footer>",
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n");
}
