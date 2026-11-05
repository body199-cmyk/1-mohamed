import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BACKUP_TABLES, createBusinessBackup, verifyBusinessBackup,
  verifyBusinessDataset, serializeBusinessBackup, IsolatedRestoreStore,
} from "./backup-core.mjs";

const UID = "00000000-0000-0000-0000-000000000001";
const ORIGINAL_EPOCH = 7;
function fixture() {
  return {
    contractors:[
      {id:"K_PRIMARY",name:"أحمد أبو علي",is_primary:true,is_archived:false},
      {id:"K_2",name:"شركة النيل",is_primary:false,is_archived:false},
    ],
    vehicles:[{id:"V_1",plate_number:"أ ب ج 0007",is_archived:false}],
    vehicle_accounts:[{vehicle_id:"V_1",contractor_id:"K_PRIMARY"}],
    opening_balances:[{id:"OB_1",balance_type:"VEHICLE_CASH",contractor_id:"K_PRIMARY",
      vehicle_id:"V_1",start_date:"2026-11-01",signed_piastres:"50000",
      is_cancelled:false,version:1,cancel_reason:null,cancelled_at:null}],
    trips:[{id:"TR_1",vehicle_id:"V_1",counterparty_contractor_id:"K_2",
      responsible_contractor_id:"K_PRIMARY",direction:"AHMED_SUPPLIES",
      trip_date:"2026-11-02",weight_milli_tonnes:"1000",
      contractor_rate_piastres:"10000",vehicle_rate_piastres:"10000",
      same_rate:true,expense_piastres:"0",contractor_total_piastres:"10000",
      vehicle_total_piastres:"10000",receipt_number:"0007",origin:"محجر",
      destination:"موقع",is_cancelled:false,cancel_reason:null,cancelled_at:null,
      version:1}],
    payments:[{id:"PAY_1",vehicle_id:"V_1",responsible_contractor_id:"K_PRIMARY",
      payment_date:"2026-11-03",amount_piastres:"1000",linked_trip_id:"TR_1",
      receipt_number:"000012",is_cancelled:false,cancel_reason:null,
      cancelled_at:null,version:1}],
    audit_log:[{id:"1",entity_type:"PAYMENT",entity_id:"PAY_1",action:"INSERT",
      performed_by:UID,old_data:null,new_data:{receipt_number:"000012"},
      financial_impact:{cash_delta_piastres:"-1000"}}],
    idempotency_keys:[{key:"req-00001",user_id:UID,operation:"payment.create",
      payload_hash:"a".repeat(64),status:"COMPLETED",response_status:200,
      response_body:{payment_id:"PAY_1"}}],
  };
}
function backup(data=fixture()) {
  return createBusinessBackup(data,{backupId:"11111111-1111-4111-8111-111111111111",
    createdAt:"2026-11-05T18:00:00.000Z",sourceEpoch:4});
}
function assertInvalid(fn,needle=/BACKUP_INVALID/) {
  assert.throws(fn,needle);
}

test("B04 versioned verified snapshot includes every business table and exact receipt/money text",()=>{
  const data=fixture();
  const file=serializeBusinessBackup(backup(data));
  const verified=verifyBusinessBackup(file);
  assert.deepEqual(Object.keys(verified.counts).sort(),[...BACKUP_TABLES].sort());
  assert.equal(verified.counts.payments,1);
  assert.equal(verified.data.payments[0].receipt_number,"000012");
  assert.equal(verified.data.trips[0].vehicle_total_piastres,"10000");
  assert.equal(verified.data.audit_log[0].new_data.receipt_number,"000012");
  assert.equal(verified.data.idempotency_keys[0].key,"req-00001");
  assert(!file.includes("owner_user_id")); // Supabase identity must never be restored.
  assert.equal(verified.sha256.length,64);
  assert.equal(serializeBusinessBackup(backup(data)),file); // deterministic fixture
});

test("B04 checksum, counts and unsupported/missing fields rejected before restore",()=>{
  const archive=backup();
  assertInvalid(()=>verifyBusinessBackup({...archive,version:2}));
  assertInvalid(()=>verifyBusinessBackup({...archive,counts:{...archive.counts,payments:0}}));
  assertInvalid(()=>verifyBusinessBackup({...archive,sha256:"0".repeat(64)}));
  assertInvalid(()=>verifyBusinessBackup(JSON.stringify(archive).replace("000012","999999")));
  assertInvalid(()=>verifyBusinessBackup("{garbage"));
  assertInvalid(()=>verifyBusinessBackup({...archive,extra:1}));
  const short=fixture();delete short.audit_log;
  assertInvalid(()=>createBusinessBackup(short));
});

test("B04 validates cross-table FKs, account isolation and historical trip references",()=>{
  const lost=fixture();lost.vehicle_accounts=[];
  assertInvalid(()=>createBusinessBackup(lost),/حساب نقد عربية|علاقة/);
  const changed=fixture();changed.trips[0].responsible_contractor_id="K_2";
  assertInvalid(()=>createBusinessBackup(changed),/حساب|المسؤول/);
  const linked=fixture();linked.payments[0].linked_trip_id="DOES_NOT_EXIST";
  assertInvalid(()=>createBusinessBackup(linked),/دفعة|علاقة/);
  const oldLink=fixture();oldLink.payments[0].responsible_contractor_id="K_2";
  oldLink.vehicle_accounts.push({vehicle_id:"V_1",contractor_id:"K_2"});
  assert.doesNotThrow(()=>createBusinessBackup(oldLink)); // descriptive history D13
});

test("B04 valid contractor work opening may have null vehicle without bogus cash account",()=>{
  const data=fixture();
  data.opening_balances.push({
    id:"OB_WORK",balance_type:"CONTRACTOR_WORK",contractor_id:"K_2",
    vehicle_id:null,start_date:"2026-11-01",signed_piastres:"-7500",
    is_cancelled:false,version:1,cancel_reason:null,cancelled_at:null,
  });
  const verified=verifyBusinessBackup(createBusinessBackup(data));
  assert.equal(verified.counts.opening_balances,2);
  assert.equal(verified.data.opening_balances[1].vehicle_id,null);
});

test("B04 rejects mismatched totals, fractional piastres, prototype pollution and duplicates",()=>{
  const badTotal=fixture();badTotal.trips[0].vehicle_total_piastres="10001";
  assertInvalid(()=>createBusinessBackup(badTotal),/إجمالي/);
  const fraction=fixture();fraction.payments[0].amount_piastres="1.5";
  assertInvalid(()=>createBusinessBackup(fraction));
  const duplicate=fixture();duplicate.payments.push({...duplicate.payments[0]});
  assertInvalid(()=>createBusinessBackup(duplicate),/مكرر/);
  const poisoned=fixture();
  Object.defineProperty(poisoned.payments[0],"__proto__",{value:{x:1},enumerable:true});
  assertInvalid(()=>createBusinessBackup(poisoned),/مفتاح JSON/);
});

test("B05/B06 successful isolated restore saves verified safety copy and atomically replaces all tables",async()=>{
  const old=fixture();
  old.payments[0].amount_piastres="500";
  const store=new IsolatedRestoreStore(old,ORIGINAL_EPOCH);
  const archive=backup();
  let savedSafety;
  const result=await store.restore(serializeBusinessBackup(archive),{
    authorized:true,expectedEpoch:ORIGINAL_EPOCH,
    saveSafety:async content=>{savedSafety=verifyBusinessBackup(content);return true;}
  });
  assert.equal(store.epoch,ORIGINAL_EPOCH+1);
  assert.equal(result.newEpoch,8);
  assert.equal(store.read().payments[0].amount_piastres,"1000");
  assert.equal(savedSafety.data.payments[0].amount_piastres,"500");
  assert.deepEqual(store.read(),verifyBusinessBackup(archive).data);
  assert.deepEqual(result.restoredCounts,verifyBusinessDataset(store.read()));
});

test("B05 malformed file, failed safety copy and mid-restore exception all preserve old state",async()=>{
  const store=new IsolatedRestoreStore(fixture(),2);
  const before=store.read();
  const options={authorized:true,expectedEpoch:2,saveSafety:async()=>true};
  await assert.rejects(store.restore("broken",options),/BACKUP_INVALID/);
  await assert.rejects(store.restore(backup(),{...options,saveSafety:async()=>false}),/فشل حفظ نسخة الحماية/);
  await assert.rejects(store.restore(backup(),{...options,
    beforeCommit:async()=>{throw new Error("simulate transaction failure");}}),/simulate transaction failure/);
  assert.equal(store.epoch,2);
  assert.deepEqual(store.read(),before);
});

test("B07 fails closed for unauthenticated, stale generation or missing safety-snapshot handler",async()=>{
  const store=new IsolatedRestoreStore(fixture(),9);
  await assert.rejects(store.restore(backup(),{
    authorized:false,expectedEpoch:9,saveSafety:async()=>true}),/غير المصرح/);
  await assert.rejects(store.restore(backup(),{
    authorized:true,expectedEpoch:8,saveSafety:async()=>true}),/قديم/);
  await assert.rejects(store.restore(backup(),{
    authorized:true,expectedEpoch:9}),/إلزامية/);
  assert.equal(store.epoch,9);
});

test("B08 prior client generation cannot reapply a stale financial write after restore",async()=>{
  const store=new IsolatedRestoreStore(fixture(),3);
  await store.restore(backup(),{
    authorized:true,expectedEpoch:3,saveSafety:async()=>true,
  });
  assertInvalid(()=>store.write(3,data=>data.payments.push({...data.payments[0],id:"PAY_2"})),/الجيل/);
  assert.equal(store.read().payments.length,1);
  store.write(4,data=>data.payments.push({...data.payments[0],id:"PAY_2"}));
  assert.equal(store.read().payments.length,2);
});

test("B03 concurrent isolated restores cannot overwrite each other after safety capture",async()=>{
  const store=new IsolatedRestoreStore(fixture(),0);
  let releaseFirst;
  const pause=new Promise(resolve=>{releaseFirst=resolve;});
  const first=store.restore(backup(),{
    authorized:true,expectedEpoch:0,saveSafety:async()=>true,
    beforeCommit:async()=>pause,
  });
  const second=await store.restore(backup(),{
    authorized:true,expectedEpoch:0,saveSafety:async()=>true,
  });
  assert.equal(second.newEpoch,1);
  releaseFirst();
  await assert.rejects(first,/تغيّر الجيل/);
  assert.equal(store.epoch,1);
});

test("B04 rejects malformed oversized archive before any transaction side effect",async()=>{
  const store=new IsolatedRestoreStore(fixture(),0);
  let safetyCalls=0;
  await assert.rejects(store.restore("x".repeat(16*1024*1024+1),{
    authorized:true,expectedEpoch:0,
    saveSafety:async()=>{safetyCalls++;return true;}
  }),/تجاوز الحد/);
  assert.equal(safetyCalls,0);
  assert.equal(store.epoch,0);
});
