/** Stable A4 white-paper document: intentionally independent of dashboard theme, screen size and device. */
export const STATEMENT_PRINT_STYLES = `
  @page {
    size: A4;
    margin: 14mm 12mm;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    background-color: #ffffff;
    color: #1e293b;
    font-family: "Cairo", Arial, sans-serif;
    font-size: 13px;
    line-height: 1.6;
    direction: rtl;
    text-align: right;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .statement-page {
    width: 100%;
    max-width: 190mm;
    margin: 0 auto;
    padding: 4mm 0;
  }

  .statement-header {
    border-bottom: 2px solid #206bc4;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }

  .business-name {
    font-size: 14px;
    font-weight: 700;
    color: #206bc4;
    margin: 0 0 4px 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .report-title {
    font-size: 22px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 10px 0;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px 12px;
    background-color: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 10px 12px;
  }

  .meta-item {
    min-width: 0;
  }

  .meta-label {
    display: block;
    font-size: 11px;
    color: #475569;
    margin-bottom: 2px;
  }

  .meta-value {
    font-size: 13px;
    font-weight: 700;
    color: #1e293b;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .section-heading {
    font-size: 15px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 8px 0;
    padding-right: 8px;
    border-right: 3px solid #206bc4;
  }

  .summary-section {
    margin-bottom: 18px;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .summary-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1px solid #cbd5e1;
  }

  .summary-table th,
  .summary-table td {
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .summary-table th {
    width: 35%;
    background-color: #f8fafc;
    font-weight: 700;
    color: #1e293b;
    text-align: right;
  }

  .summary-table td {
    width: 65%;
    font-weight: 600;
    color: #1e293b;
  }

  .summary-closing-row th,
  .summary-closing-row td {
    background-color: #eff6ff;
    font-weight: 700;
  }

  .details-section {
    margin-bottom: 16px;
  }

  .details-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1px solid #cbd5e1;
  }

  .details-table thead {
    display: table-header-group;
  }

  .details-table tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .details-table th,
  .details-table td {
    border: 1px solid #cbd5e1;
    padding: 7px 9px;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .details-table th {
    background-color: #f1f5f9;
    color: #1e293b;
    font-weight: 700;
    text-align: right;
  }

  .col-ref {
    width: 16%;
  }

  .col-date {
    width: 14%;
  }

  .col-dir {
    width: 34%;
  }

  .col-amount {
    width: 18%;
  }

  .col-balance {
    width: 18%;
  }

  .ltr-token {
    display: inline-block;
    direction: ltr;
    unicode-bidi: isolate;
    text-align: left;
    max-width: 100%;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .empty-state-cell {
    text-align: center;
    padding: 16px 10px;
    color: #475569;
    font-weight: 600;
  }

  .statement-footer {
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #cbd5e1;
    font-size: 12px;
    color: #475569;
    page-break-inside: avoid;
    break-inside: avoid;
  }
`;
