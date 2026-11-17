import { createHash } from "node:crypto";

export const PORTABLE_BACKUP_TABLES = [
  "app_members","app_owner","audit_log","business_settings","contractors",
  "idempotency_keys","opening_balances","payments","trips","vehicle_accounts","vehicles","backup_history",
] as const;
export type PortableBackupTable = typeof PORTABLE_BACKUP_TABLES[number];
export const BACKUP_ORDER: Record<PortableBackupTable, readonly string[]> = {
  app_members:["user_id"], app_owner:["id"], audit_log:["id"], business_settings:["id"],
  contractors:["id"], idempotency_keys:["key"], opening_balances:["id"], payments:["id"],
  trips:["id"], vehicle_accounts:["vehicle_id","contractor_id"], vehicles:["id"], backup_history:["id"],
};
export const BACKUP_COLUMNS: Record<PortableBackupTable, readonly string[]> = {
  app_members:["user_id","email","is_active","invited_by","created_at","updated_at"],
  app_owner:["id","owner_user_id","initialized_at","created_at"],
  audit_log:["id","entity_type","entity_id","action","reason","old_data","new_data","diff","financial_impact","performed_by","created_at"],
  business_settings:["id","business_name","phone_number","default_payment_terms","updated_at"],
  contractors:["id","name","is_primary","is_archived","created_at","updated_at","version"],
  idempotency_keys:["key","user_id","operation","payload_hash","status","response_status","response_body","created_at","updated_at"],
  opening_balances:["id","balance_type","contractor_id","vehicle_id","start_date","signed_piastres","notes","is_cancelled","cancel_reason","cancelled_at","version","created_at","updated_at"],
  payments:["id","vehicle_id","responsible_contractor_id","payment_date","amount_piastres","linked_trip_id","receipt_number","notes","is_cancelled","cancel_reason","cancelled_at","version","created_at","updated_at"],
  trips:["id","vehicle_id","counterparty_contractor_id","responsible_contractor_id","direction","trip_date","weight_milli_tonnes","contractor_rate_piastres","vehicle_rate_piastres","same_rate","expense_piastres","contractor_total_piastres","vehicle_total_piastres","notes","is_cancelled","cancel_reason","cancelled_at","version","created_at","updated_at","origin","destination","receipt_number"],
  vehicle_accounts:["vehicle_id","contractor_id","created_at","last_activity_at"],
  vehicles:["id","plate_number","driver_name","notes","is_archived","created_at","updated_at","version"],
  backup_history:["id","backup_date","format","file_name","drive_file_id","drive_web_view_link","size_bytes","sha256","table_counts","created_at"],
};
const MAX_ROWS=50000;
function assert(ok:boolean,message:string):asserts ok { if(!ok) throw new Error("PORTABLE_BACKUP_INVALID: "+message); }
function checkSafeNumbers(value:unknown,path="root"):void {
  if(typeof value==="number") assert(Number.isSafeInteger(value),"Unsafe numeric value at "+path+"; export stopped to avoid changing financial precision.");
  else if(Array.isArray(value)) value.forEach((item,index)=>checkSafeNumbers(item,path+"["+index+"]"));
  else if(value&&typeof value==="object") for(const [key,item] of Object.entries(value)) checkSafeNumbers(item,path+"."+key);
}
export function createPortableBackup(tables:Record<PortableBackupTable,unknown[]>,createdAt=new Date().toISOString()) {
  const keys=Object.keys(tables).sort(),expected=[...PORTABLE_BACKUP_TABLES].sort();
  assert(keys.length===expected.length&&keys.every((key,index)=>key===expected[index]),"All 11 public application tables are required.");
  let total=0;
  for(const table of PORTABLE_BACKUP_TABLES) {
    assert(Array.isArray(tables[table]),"Missing table "+table+".");
    total+=tables[table].length;
    assert(total<=MAX_ROWS,"Portable export exceeded 50,000 rows.");
    checkSafeNumbers(tables[table],table);
  }
  const body={format:"1-mohamed-portable-data-backup",format_version:1,created_at:new Date(createdAt).toISOString(),project_ref:"sskkuniskphlawivzudw",tables_included:[...PORTABLE_BACKUP_TABLES],row_counts:Object.fromEntries(PORTABLE_BACKUP_TABLES.map(table=>[table,tables[table].length])),auth_passwords_included:false,storage_objects_included:false,tables};
  const sha256=createHash("sha256").update(JSON.stringify(body),"utf8").digest("hex");
  return {...body,sha256};
}
function csvCell(value:unknown):string {
  let text= value===null||value===undefined ? "" : typeof value==="object" ? JSON.stringify(value) : String(value);
  if(/^[=+\-@\t\r]/.test(text)) text="'"+text;
  return /[",\r\n]/.test(text) ? '"'+text.replace(/"/g,'""')+'"' : text;
}
export function serializeTableCsv(table:PortableBackupTable,rows:Record<string,unknown>[]):string {
  const columns=BACKUP_COLUMNS[table];
  assert(rows.every(row=>row&&typeof row==="object"&&!Array.isArray(row)),"Invalid CSV row.");
  const body=[columns.join(","),...rows.map(row=>columns.map(column=>csvCell(row[column])).join(","))].join("\r\n");
  return "\uFEFF"+body+"\r\n";
}
