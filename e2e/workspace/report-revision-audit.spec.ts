import { expect, test, type Page, type Route } from '@playwright/test';

const contractor = { id: 'C1', name: 'مقاول الاختبار', is_archived: false, is_primary: false, version: 1 };
const vehicle = { id: 'V1', plate_number: 'عربية الاختبار', is_archived: false, version: 1 };
const account = { vehicle_id: 'V1', contractor_id: 'C1' };
const statement = {
  status: 'OK', counterparty_contractor_id: 'C1', snapshot: '10:10',
  date_from: '2026-11-01', date_to: '2026-11-03',
  opening_balance_piastres: '0', ahmed_work_piastres: '0', counterparty_work_piastres: '0',
  closing_balance_piastres: '0', balance_magnitude_piastres: '0', beneficiary: 'BALANCED',
  total_count: '0', next_cursor: null, rows: [],
};
const partial = {
  ...statement, ahmed_work_piastres: '20000', closing_balance_piastres: '20000',
  balance_magnitude_piastres: '20000', beneficiary: 'AHMED',
  total_count: '2', next_cursor: { date: '2026-11-02', id: 'T1' },
  rows: [{
    id: 'T1', trip_date: '2026-11-02', vehicle_id: 'V1', origin: null, destination: null, notes: null,
    direction: 'AHMED_SUPPLIES', weight_milli_tonnes: '1000', contractor_total_piastres: '10000',
    signed_delta_piastres: '10000', running_balance_piastres: '10000',
  }],
};
const respond = (route: Route, data: unknown) => route.fulfill({ json: { ok: true, data } });
const fail = (route: Route) => route.fulfill({ status: 422, json: { error: 'خطأ من الطلب السابق' } });

async function fixture(page: Page) {
  const requests: Route[] = [];
  await page.route('**/api/ledger/master?**', route => {
    const type = new URL(route.request().url()).searchParams.get('type');
    return route.fulfill({ json: { ok: true, data: type === 'contractors' ? [contractor] : type === 'vehicles' ? [vehicle] : [account], hasMore: false } });
  });
  await page.route('**/api/ledger/read', async route => {
    const body = route.request().postDataJSON();
    if (['contractor.statement', 'cash.statement'].includes(body.operation) ||
      (body.operation === 'trips.list' && body.payload.limit === 200)) requests.push(route);
    else await respond(route, { status: 'OK', rows: [], total_count: '0', next_cursor: null });
  });
  await page.goto('/');
  return requests;
}

async function contractorFilter(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'التقارير والكشوف', exact: true }).click();
  await page.getByRole('button', { name: 'فتح كشف المقاول', exact: true }).click();
  await page.locator('#real-statement-contractor').selectOption('C1');
  await page.locator('#real-statement-from').fill('2026-11-01');
  await page.locator('#real-statement-to').fill('2026-11-03');
  return page.getByRole('button', { name: 'عرض كشف الحساب', exact: true });
}

async function refresh(page: Page) {
  const button = page.getByRole('button', { name: 'تحديث البيانات', exact: true });
  await button.click();
  await expect(button).toBeEnabled();
}

async function flushResponse(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

for (const pagination of [false, true]) {
  test(`contractor revision supersedes delayed ${pagination ? 'pagination' : 'initial load'}`, async ({ page }) => {
    const requests = await fixture(page);
    const submit = await contractorFilter(page);
    await submit.click();
    await expect.poll(() => requests.length).toBe(1);
    if (pagination) {
      await respond(requests[0], partial);
      await page.getByRole('button', { name: 'تحميل 200 نقلة إضافية', exact: true }).click();
      await expect.poll(() => requests.length).toBe(2);
    }
    const obsolete = requests.at(-1)!;
    await refresh(page);
    await refresh(page);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect.poll(() => requests.length).toBe(pagination ? 3 : 2);
    const current = requests.at(-1)!;
    if (pagination) await fail(obsolete);
    else await respond(obsolete, partial);
    await flushResponse(page);
    await expect(submit).toBeDisabled();
    await expect(page.getByText('خطأ من الطلب السابق')).toHaveCount(0);
    await expect(page.getByText('تم تحميل 1 من أصل 2 نقلة.')).toHaveCount(0);
    await respond(current, statement);
    await expect(page.getByText('تم تحميل 0 من أصل 0 نقلة.')).toBeVisible();
  });
}

test('contractor revision removes a previously displayed error and pending requests can finish after unmount', async ({ page }) => {
  const requests = await fixture(page);
  const submit = await contractorFilter(page);
  await submit.click();
  await expect.poll(() => requests.length).toBe(1);
  await fail(requests[0]);
  await expect(page.getByText('خطأ من الطلب السابق')).toBeVisible();
  await refresh(page);
  await expect(page.getByText('خطأ من الطلب السابق')).toHaveCount(0);
  await submit.click();
  await expect.poll(() => requests.length).toBe(2);
  const errors: Error[] = [];
  page.on('pageerror', error => errors.push(error));
  await page.evaluate(() => window.dispatchEvent(new Event('workspace-fixture-unmount')));
  await expect(submit).toHaveCount(0);
  await fail(requests[1]);
  await flushResponse(page);
  expect(errors).toEqual([]);
});

test('operational pagination error cannot interrupt a revised automatic report', async ({ page }) => {
  const requests = await fixture(page);
  await page.getByRole('navigation').getByRole('button', { name: 'التقارير والكشوف', exact: true }).click();
  await page.locator('#report-from').fill('2026-11-01');
  await page.locator('#report-to').fill('2026-11-03');
  await expect.poll(() => requests.length).toBe(1);
  const { status, snapshot, rows, next_cursor, total_count } = partial;
  await respond(requests[0], { status, snapshot, rows, next_cursor, total_count });
  await page.getByRole('button', { name: 'تحميل 200 سجل إضافي', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  await refresh(page);
  await expect.poll(() => requests.length).toBe(3);
  await fail(requests[1]);
  await flushResponse(page);
  await expect(page.getByText('جارٍ تحديث التقرير تلقائيًا…', { exact: true })).toBeVisible();
  await expect(page.getByText('خطأ من الطلب السابق')).toHaveCount(0);
  await respond(requests[2], { status, snapshot, rows: [], next_cursor: null, total_count: '0' });
  await expect(page.getByText('عدد السجلات: 0', { exact: true })).toBeVisible();
});

test('vehicle cash statement ignores stale error cleanup after revision', async ({ page }) => {
  const requests = await fixture(page);
  await page.getByRole('navigation').getByRole('button', { name: 'حسابات العربيات والدفعات', exact: true }).click();
  await page.locator('#cash-account').selectOption('V1|C1');
  await page.locator('#cash-from').fill('2026-11-01');
  await page.locator('#cash-to').fill('2026-11-03');
  const submit = page.getByRole('button', { name: 'عرض كشف النقدية', exact: true });
  await submit.click();
  await expect.poll(() => requests.length).toBe(1);
  await refresh(page);
  await submit.click();
  await expect.poll(() => requests.length).toBe(2);
  await fail(requests[0]);
  await flushResponse(page);
  await expect(submit).toBeDisabled();
  await expect(page.getByText('خطأ من الطلب السابق')).toHaveCount(0);
  await respond(requests[1], {
    status: 'OK', snapshot: '10:10', total_count: '0', rows: [], next_cursor: null,
    vehicle_id: 'V1', responsible_contractor_id: 'C1', date_from: '2026-11-01', date_to: '2026-11-03',
    period_opening_piastres: '0', period_closing_piastres: '0', current_cash_balance_piastres: '0',
    work_piastres: '0', paid_piastres: '0',
  });
  await expect(page.getByLabel('ملخص نقدية العربية')).toBeVisible();
});
