import { expect, test } from '@playwright/test';
import { createSqlLedger } from './support/sql-ledger';

test('Master Data sends exact opening numbers to SQL and replays a lost response once', async ({ page }) => {
  test.setTimeout(120000);
  const sql = await createSqlLedger();
  try {
    await sql.write('vehicle.account.ensure', { vehicle_id: 'V2', contractor_id: 'C2' });
    await sql.write('vehicle.account.ensure', { vehicle_id: 'V1', contractor_id: 'C1' });
    const state = await sql.connect(page);
    await page.goto('/');
    await page.getByRole('navigation').getByRole('button', { name: 'إدارة البيانات', exact: true }).click();
    const form = page.getByRole('button', { name: 'حفظ الرصيد الافتتاحي', exact: true });
    const amount = page.locator('#opening-amount');
    const cases = [
      ['CONTRACTOR_WORK', 'C1', null, '1.50', 200],
      ['CONTRACTOR_WORK', 'C2', null, '-90071992547409.49', -9007199254740900],
      ['VEHICLE_CASH', 'C2', 'V2', '-2.50', -300],
      ['VEHICLE_CASH', 'C1', 'V1', '0', 0],
      ['VEHICLE_CASH', 'K_AHMED', 'V2', '90071992547409.49', 9007199254740900],
    ] as const;
    for (const [type, contractor, vehicle, value, expected] of cases) {
      await page.locator('#opening-type').selectOption(type);
      await page.locator('#opening-contractor').selectOption(contractor);
      if (vehicle) await page.locator('#opening-vehicle').selectOption(vehicle);
      await page.locator('#opening-date').fill('2026-11-02');
      if (value === '1.50') {
        state.loseNextOpeningResponse = true;
        await amount.fill(value);
        await form.click();
        await expect(page.getByText(/انقطع الاتصال ولم تتأكد نتيجة الحفظ/)).toBeVisible();
      }
      await amount.fill(value);
      await form.click();
      await expect(amount).toHaveValue('');
      const payload = state.attempts.at(-1)?.payload;
      expect(payload).toMatchObject({ balance_type: type, signed_piastres: expected });
      expect(await sql.rows(
        'select signed_piastres::text as amount from opening_balances where id=$1',
        [(payload as { id: string }).id],
      )).toEqual([{ amount: String(expected) }]);
    }
    for (const invalid of ['1.234', '90071992547409.50', '-90071992547409.50']) {
      await amount.fill(invalid);
      await form.click();
      await expect(page.getByText(/بحد أقصى خانتين|حد النقل الرقمي الدقيق/)).toBeVisible();
      expect(state.attempts).toHaveLength(cases.length + 1);
    }
    expect(state.attempts).toHaveLength(cases.length + 1);
    expect(state.attempts[0]).toEqual(state.attempts[1]);
    expect(await sql.rows("select id from opening_balances where id like 'OPEN-%' and id <> 'OPEN-V1'")).toHaveLength(cases.length);
    expect(await sql.rows("select id from audit_log where entity_type='OPENING_BALANCE' and entity_id <> 'OPEN-V1'")).toHaveLength(cases.length);
  } finally {
    await sql.db.close();
  }
});
