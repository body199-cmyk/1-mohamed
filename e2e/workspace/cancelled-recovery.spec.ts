import { test, expect } from "@playwright/test";
import { createPortableBackup, PORTABLE_BACKUP_TABLES } from "../../apps/web/src/lib/backup/export";

const fixture = (cancelled:boolean) => {
  const tables = Object.fromEntries(PORTABLE_BACKUP_TABLES.map(key => [key, [] as Record<string,unknown>[]]));
  tables.trips = [
    { id:"T-accidental", version:2, trip_date:"2026-11-17",
      vehicle_id:"V1", responsible_contractor_id:"K1", vehicle_total_piastres:"200000",
      is_cancelled:cancelled, cancel_reason:cancelled?"accident":"", cancelled_at:cancelled?"2026-11-19T01:00:00Z":null },
  ];
  tables.payments = [
    { id:"P-accidental", version:5, payment_date:"2026-11-17",
      vehicle_id:"V1", responsible_contractor_id:"K1", amount_piastres:"50000",
      is_cancelled:cancelled, cancel_reason:cancelled?"mistake":"", cancelled_at:cancelled?"2026-11-19T01:00:00Z":null },
  ];
  return JSON.stringify(createPortableBackup(tables));
};

async function settings(page:import("@playwright/test").Page) {
  await page.route("**/api/ledger/master?**",route=>route.fulfill({json:{ok:true,data:[],hasMore:false}}));
  await page.route("**/api/backup/history",route=>route.fulfill({json:{ok:true,backups:[]}}));
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  const more=page.locator('[data-testid="mobile-more"]');
  await more.locator("summary").click();
  await page.getByRole("button",{name:"الإعدادات",exact:true}).click();
}

test("reactivate selected canceled trip only after explicit confirmation, stable version and owner RPC",async({page})=>{
  let recovered=false;
  const actions:Array<{operation:string;requestKey:string;payload:Record<string,unknown>}>=[];
  await page.route("**/api/backup/export?format=json",route=>route.fulfill({
    status:200,contentType:"application/json",body:fixture(!recovered),
  }));
  await page.route("**/api/ledger/operations",async route=>{
    const value=route.request().postDataJSON();
    actions.push(value);
    recovered=true;
    await route.fulfill({json:{ok:true,data:{status:"OK",version:3}}});
  });
  await settings(page);
  const section=page.getByRole("region",{name:"استعادة السجلات الملغاة"});
  const submit=section.getByRole("button",{name:"استعادة السجل المحدد فقط"});
  await expect(submit).toHaveCount(0);
  await section.getByRole("button",{name:"عرض السجلات الملغاة"}).click();
  await section.locator("#recovery-record-id").selectOption("T-accidental");
  await expect(submit).toBeDisabled();
  await section.locator("#recovery-reason").fill("Restored accidental cancellation");
  await section.locator("#recovery-confirm").fill("استعادة");
  await expect(submit).toBeDisabled();
  await section.getByRole("checkbox").check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(section.getByRole("status")).toContainText("تمت استعادة السجل");
  expect(actions).toHaveLength(1);
  expect(actions[0].operation).toBe("trip.reactivate");
  expect(actions[0].payload).toEqual({
    id:"T-accidental",expected_version:2,reason:"Restored accidental cancellation",
  });
  expect(actions[0].requestKey).toMatch(/^recovery:[0-9a-f-]+$/);
  await expect(section.getByText("لا توجد سجلات ملغاة")).toBeVisible();
});

test("payment D16 rejection is shown with no success state, and reused request ID on retry",async({page})=>{
  const actions:Array<{operation:string;requestKey:string;payload:Record<string,unknown>}>=[];
  await page.route("**/api/backup/export?format=json",route=>route.fulfill({
    status:200,contentType:"application/json",body:fixture(true),
  }));
  await page.route("**/api/ledger/operations",async route=>{
    actions.push(route.request().postDataJSON());
    await route.fulfill({status:422,json:{error:"تعذر حفظ العملية. راجع المدخلات ثم حاول مرة أخرى بنفس مفتاح الطلب."}});
  });
  await settings(page);
  const section=page.getByRole("region",{name:"استعادة السجلات الملغاة"});
  await section.locator("#recovery-record-type").selectOption("payment");
  await section.getByRole("button",{name:"عرض السجلات الملغاة"}).click();
  await section.locator("#recovery-record-id").selectOption("P-accidental");
  await section.locator("#recovery-reason").fill("Recovery after accidental cancel");
  await section.locator("#recovery-confirm").fill("استعادة");
  await section.getByRole("checkbox").check();
  await section.getByRole("button",{name:"استعادة السجل المحدد فقط"}).click();
  await expect(section.getByRole("alert")).toContainText("تعذر حفظ العملية");
  await section.getByRole("button",{name:"استعادة السجل المحدد فقط"}).click();
  expect(actions).toHaveLength(2);
  expect(actions[0].operation).toBe("payment.reactivate");
  expect(actions[0].payload.expected_version).toBe(5);
  expect(actions[0].requestKey).toBe(actions[1].requestKey);
});

test("unauthorized list cannot expose a recovery record or send write",async({page})=>{
  let writes=0;
  await page.route("**/api/backup/export?format=json",route=>route.fulfill({
    status:403,contentType:"application/json",body:'{"error":"Forbidden"}',
  }));
  page.on("request",req=>{if(req.url().includes("/api/ledger/operations"))writes++});
  await settings(page);
  const section=page.getByRole("region",{name:"استعادة السجلات الملغاة"});
  await section.getByRole("button",{name:"عرض السجلات الملغاة"}).click();
  await expect(section.getByRole("alert")).toContainText("صلاحية صاحب المشروع");
  await expect(section.locator("#recovery-record-id")).toHaveCount(0);
  expect(writes).toBe(0);
});
