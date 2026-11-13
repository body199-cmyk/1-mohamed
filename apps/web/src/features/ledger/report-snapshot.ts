export type ReportPage = {
  status: string;
  snapshot?: string;
  total_count?: string | number;
  rows: Record<string, unknown>[];
  next_cursor?: Record<string, unknown> | null;
};

export function assertReportPage(report: ReportPage) {
  if (!report || report.status !== 'OK' || !Array.isArray(report.rows) ||
      typeof report.snapshot !== 'string' || !/^\d+:\d+$/.test(report.snapshot) ||
      !/^(0|[1-9][0-9]*)$/.test(String(report.total_count)) ||
      (typeof report.total_count === 'number' && !Number.isSafeInteger(report.total_count))) {
    throw new Error('تقرير غير صالح؛ أعد تحميل البيانات.');
  }
  const ids = new Set<string>();
  for (const row of report.rows) {
    // Cash movements can share an ID across the two source tables.
    const key = String(row.movement_type ?? '') + ':' + row.id;
    if (typeof row.id !== 'string' || !row.id || ids.has(key)) {
      throw new Error('سجلات التقرير مكررة أو ناقصة. أعد تحميل التقرير.');
    }
    ids.add(key);
  }
  if (BigInt(report.rows.length) > BigInt(report.total_count!) ||
      (!report.next_cursor && BigInt(report.rows.length) !== BigInt(report.total_count!))) {
    // A single later page is validated after merging, not on its own.
    throw new Error('عدد السجلات غير مطابق؛ التصدير متوقف.');
  }
}

export function mergeReportPage<T extends ReportPage>(previous: T, next: T): T {
  if (!previous.snapshot || previous.snapshot !== next.snapshot ||
      String(previous.total_count) !== String(next.total_count) || next.status !== 'OK' ||
      !Array.isArray(next.rows)) {
    throw new Error('تغيرت البيانات أثناء تحميل الصفحات. أعد تحميل التقرير من البداية.');
  }
  if (next.next_cursor && JSON.stringify(next.next_cursor) === JSON.stringify(previous.next_cursor)) {
    throw new Error('مؤشر الصفحة لم يتغير. أعد تحميل التقرير.');
  }
  const result = { ...previous, rows: [...previous.rows, ...next.rows], next_cursor: next.next_cursor ?? null };
  assertReportPage(result);
  return result;
}
