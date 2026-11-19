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
  if(doc.presentation==='compact-statement')return compactHtml(doc);
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
    ? doc.rows.map((row,rowIndex) => '<tr'+(doc.rowTones?.[rowIndex]==='credit'?' style="color:#166534;background:#f0fdf4"':doc.rowTones?.[rowIndex]==='debit'?' style="color:#991b1b;background:#fef2f2"':'')+'>' + row.map((value, index) =>
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
    '<span class="meta-value">' + generated + "</span></div>",
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

function compactHtml(doc:OperationalReportDocument):string {
 const e=escapeHtmlText;
 const metadataColumns=doc.metadata.length<=4?2:3;
 const metadata=doc.metadata.map((m,i)=>{const lastRow=Math.floor(i/metadataColumns)===Math.floor((doc.metadata.length-1)/metadataColumns);const orphan=lastRow&&doc.metadata.length%metadataColumns===1&&metadataColumns===3&&i===doc.metadata.length-1;return '<div class="meta-item"'+(orphan?' style="grid-column:2"':'')+'><span class="meta-label">'+e(m.label)+'</span><span class="meta-value">'+e(m.value)+'</span></div>';}).join('');
 const summary=doc.summarySections.map((s,i)=>'<section class="compact-summary '+(i===0?'primary':'counts')+'"><h2>'+e(s.title)+'</h2><div class="metrics">'+s.metrics.map(m=>'<div class="metric '+(m.tone??'neutral')+'"><span>'+e(m.label)+'</span><strong'+cellClass(m.direction)+'>'+e(m.value)+'</strong></div>').join('')+'</div></section>').join('');
 const sections=[{title:doc.detailsTitle??'تفاصيل التقرير',columns:doc.columns,rows:doc.rows,rowTones:doc.rowTones,emptyMessage:doc.emptyMessage},...(doc.detailSections??[])];
 const tables = sections.map((section, index) => {
  const totalWeight = section.columns.reduce((sum, column) => sum + column.widthWeight, 0);
  const wide = section.columns.length >= 12 ? " wide-table" : "";
  const columns = section.columns.map(column =>
   '<col style="width:' + column.widthWeight / totalWeight * 100 + '%">').join("");
  const headings = section.columns.map(column => '<th scope="col">' + e(column.label) + '</th>').join("");
  const rows = section.rows.length ? section.rows.map((row, rowIndex) =>
   '<tr class="' + (section.rowTones?.[rowIndex] ?? '') + '">' + row.map((value, columnIndex) =>
    '<td><span' + cellClass(section.columns[columnIndex]!.direction) + '>' + e(value) + '</span></td>'
   ).join("") + '</tr>').join("") :
   '<tr><td colspan="' + section.columns.length + '">' + e(section.emptyMessage) + '</td></tr>';
  const total = index === 0 && doc.detailsTotal ? '<p class="table-total">' + e(doc.detailsTotal) + '</p>' : "";
  return '<section class="details-section"><h2 class="section-heading">' + e(section.title) + '</h2>' +
   '<table class="details-table' + wide + '"><colgroup>' + columns + '</colgroup>' +
   '<thead><tr>' + headings + '</tr></thead><tbody>' + rows + '</tbody></table>' + total + '</section>';
 }).join("");
 return '<!doctype html>\n<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=1000"><title>'+e(doc.title)+'</title><style>'+STATEMENT_PRINT_STYLES+`
 .details-table .ltr-token{white-space:nowrap;overflow-wrap:normal;word-break:normal;font-variant-numeric:tabular-nums}.table-total{background:#eef3fb;color:#2446ad;padding:12px;font-weight:700}.statement-page{width:190mm;max-width:none}.statement-header{text-align:center}.business-name{font-size:23px;color:#2446ad}.report-title{font-size:19px}.meta-grid{background:white;border:0;padding:14px 0 10px;text-align:right;gap:14px 24px;width:92%;margin:14px auto 0;grid-template-columns:repeat(${metadataColumns},minmax(0,1fr))}
 .compact-summary{break-inside:avoid;margin:16px 0 24px}.compact-summary h2{font-size:14px}.primary h2{display:none}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.metric{padding:13px 8px}.primary .metric{background:#f1f6ff;border:1px solid #7c98d2;border-radius:6px}.metric span{display:block;font-size:11px;color:#526171}.metric strong{display:block;font-size:18px;color:#2446ad;margin-top:6px}.primary .credit{background:#effaf3;border-color:#69ac84}.primary .debit{background:#fff3f3;border-color:#d17d83}.credit strong,.details-table .credit td{color:#147344}.debit strong,.details-table .debit td{color:#b3343c}.counts .metric{padding:0}.counts strong{font-size:15px}.details-table{border:0}.details-table th{background:#2446ad;color:white;font-size:11px}.details-table td{font-size:12px}.details-table td,.details-table th{border:0;border-bottom:1px solid #d9e0e7;padding:10px 6px}.details-table tbody tr:nth-child(even){background:#f5f7fa}.section-heading{border-color:#2446ad}.statement-footer{font-size:11px}
 .metrics:has(>.metric:nth-child(3):last-child){grid-template-columns:repeat(3,minmax(0,1fr))}
 .details-table.wide-table th,.details-table.wide-table td{padding:4px 2px;font-size:8px;line-height:1.45}
 .details-table.wide-table th{overflow-wrap:normal;word-break:normal}
 .details-table.wide-table .ltr-token{font-size:7px;white-space:normal;overflow-wrap:anywhere}
 @media print{.statement-page{width:186mm}}
 </style></head><body><main class="statement-page"><header class="statement-header"><p class="business-name">`+e(doc.businessName)+'</p><h1 class="report-title">'+e(doc.title)+'</h1><p>'+e(doc.subtitle)+'</p><p class="meta-label">تاريخ الإعداد: '+e(doc.generatedAtLabel)+'</p><div class="meta-grid">'+metadata+'</div></header>'+summary+tables+'<footer class="statement-footer">'+doc.footerNotes.map(n=>'<p>'+e(n)+'</p>').join('')+'</footer></main></body></html>';
}
