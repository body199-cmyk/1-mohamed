"use client";
import ui from "./workspace-ui.module.css";
import { useRef, useState, type FormEvent } from "react";
import type { LedgerEntities, LedgerWrite } from "./workspace-data";
import { poundsToPiastres } from "../../lib/ledger/amounts";


const short = (value: string) => value.length > 80 ? value.slice(0, 80) + "…" : value;
export function MasterDataEntry({ contractors, vehicles, accounts, busy, write }: LedgerEntities & {busy: boolean; write: LedgerWrite}) {
  const [notice,setNotice] = useState("");
  const [contractorName, setContractorName] = useState("");
  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [vehicleContractor, setVehicleContractor] = useState("");
  const [accountVehicle, setAccountVehicle] = useState("");
  const [accountContractor, setAccountContractor] = useState("");
  const [openingType, setOpeningType] = useState<"CONTRACTOR_WORK" | "VEHICLE_CASH">("CONTRACTOR_WORK");
  const [openingContractor, setOpeningContractor] = useState("");
  const [openingVehicle, setOpeningVehicle] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  async function createContractor(event: FormEvent) {
    event.preventDefault();
    const name = contractorName.trim();
    if (!name) return;
    const id = "CTR-" + crypto.randomUUID();
    // Stable payload across retries, including the generated record ID.
    const key = "contractor:" + name;
    const cached = drafts.current.get(key) ?? { id, name, start_mode: "DETAILS" };
    drafts.current.set(key, cached);
    if (await write("contractor.create", cached)) {
      drafts.current.delete(key); setContractorName("");
    }
  }
  const drafts = useRef(new Map<string, Record<string, unknown>>());

  async function createVehicle(event: FormEvent) {
    event.preventDefault();
    const normalizedPlate = plate.trim();
    if (!normalizedPlate) return;
    const key = JSON.stringify(["vehicle", normalizedPlate, driver.trim(), vehicleContractor]);
    const cached = drafts.current.get(key) ?? {
      id: "VEH-" + crypto.randomUUID(), plate_number: normalizedPlate,
      driver_name: driver.trim() || null, ...(vehicleContractor ? { contractor_id: vehicleContractor } : {})
    };
    drafts.current.set(key, cached);
    if (await write("vehicle.create", cached)) {
      drafts.current.delete(key); setPlate(""); setDriver("");
    }
  }

  async function ensureAccount(event: FormEvent) {
    event.preventDefault();
    if (!accountVehicle || !accountContractor) return;
    await write("vehicle.account.ensure", {
      vehicle_id: accountVehicle, contractor_id: accountContractor
    });
  }

  async function createOpening(event: FormEvent) {
    event.preventDefault();
    try {
      const piastres = poundsToPiastres(openingAmount);
      if (!openingContractor || !openingDate ||
          (openingType === "VEHICLE_CASH" && !openingVehicle)) {
        setNotice("حدد المقاول والتاريخ والحساب المطلوب."); return;
      }
      const signature = [openingType, openingContractor, openingVehicle, openingDate, piastres].join(":");
      const cached = drafts.current.get(signature) ?? {
        id: "OPEN-" + crypto.randomUUID(), balance_type: openingType,
        contractor_id: openingContractor,
        ...(openingType === "VEHICLE_CASH" ? { vehicle_id: openingVehicle } : {}),
        start_date: openingDate, signed_piastres: piastres, start_mode: "TOTAL"
      };
      drafts.current.set(signature, cached);
      if (await write("opening.create", cached)) {
        drafts.current.delete(signature); setOpeningAmount("");
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "المبلغ غير صالح."); }
  }

  return <>
    {notice && <p role="status">{notice}</p>}
    <section className={ui.surface}>
      <h2>المقاولون ({contractors.length})</h2>
      <ul>{contractors.map(c => <li key={c.id}>{short(c.name)} {c.is_primary ? "(الأساسي)" : ""} {c.is_archived ? "(مؤرشف)" : ""}</li>)}</ul>
      <form className={ui.form} onSubmit={createContractor}>
        <div className={ui.fieldGroup}><label htmlFor="contractor-name">إضافة مقاول جديد</label>
        <input id="contractor-name" className={ui.control} value={contractorName} required maxLength={160}
          onChange={e => setContractorName(e.target.value)} disabled={busy} /></div>
        <div className={ui.actions}><button disabled={busy} type="submit">حفظ المقاول</button></div>
      </form>
    </section>
    <section className={ui.surface}>
      <h2>العربيات ({vehicles.length})</h2>
      <ul>{vehicles.map(v => <li key={v.id}>{short(v.plate_number)} {v.driver_name ? " — " + short(v.driver_name) : ""}</li>)}</ul>
      <form className={ui.form} onSubmit={createVehicle}>
        <div className={ui.fieldGroup}><label htmlFor="vehicle-plate">رقم اللوحة</label>
        <input id="vehicle-plate" className={ui.control} required value={plate} maxLength={80}
          onChange={e => setPlate(e.target.value)} disabled={busy} /></div>
        <div className={ui.fieldGroup}><label htmlFor="vehicle-driver">السائق</label>
        <input id="vehicle-driver" className={ui.control} value={driver} maxLength={160}
          onChange={e => setDriver(e.target.value)} disabled={busy} /></div>
        <div className={ui.fieldGroup}><label htmlFor="vehicle-contractor">المقاول المسؤول (اختياري)</label>
        <select id="vehicle-contractor" className={ui.control} value={vehicleContractor}
          onChange={e => setVehicleContractor(e.target.value)} disabled={busy}>
          <option value="">بدون حساب عند الإنشاء</option>
          {contractors.filter(c => !c.is_archived).map(c =>
            <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
        <div className={ui.actions}><button disabled={busy} type="submit">حفظ العربية</button></div>
      </form>
    </section>
    <section className={ui.surface}>
      <h2>ربط عربية بمقاول ({accounts.length} حساب)</h2>
      <form className={ui.form} onSubmit={ensureAccount}>
        <div className={ui.fieldGroup}><label htmlFor="account-vehicle">العربية</label>
        <select id="account-vehicle" className={ui.control} required value={accountVehicle}
          onChange={e => setAccountVehicle(e.target.value)} disabled={busy}>
          <option value="">اختر العربية</option>
          {vehicles.filter(v => !v.is_archived).map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
        </select></div>
        <div className={ui.fieldGroup}><label htmlFor="account-contractor">المقاول المسؤول</label>
        <select id="account-contractor" className={ui.control} required value={accountContractor}
          onChange={e => setAccountContractor(e.target.value)} disabled={busy}>
          <option value="">اختر المقاول</option>
          {contractors.filter(c => !c.is_archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
        <div className={ui.actions}><button disabled={busy} type="submit">تأكيد ربط الحساب</button></div>
      </form>
    </section>
    <section className={ui.surface}>
      <h2>الرصيد الافتتاحي — لا تكرر الحركات التاريخية</h2>
      <p>اختر رصيدًا إجماليًا عند بداية الفترة أو أدخل الحركات التاريخية بالتفصيل، ولا تجمع الطريقتين لنفس الفترة.</p>
      <form className={ui.form} onSubmit={createOpening}>
        <div className={ui.fieldGroup}><label htmlFor="opening-type">نوع الرصيد</label>
        <select id="opening-type" className={ui.control} value={openingType}
          onChange={e => { setOpeningType(e.target.value as typeof openingType); setOpeningContractor(""); setOpeningVehicle(""); }} disabled={busy}>
          <option value="CONTRACTOR_WORK">فرق شغل المقاول</option>
          <option value="VEHICLE_CASH">نقدية عربية مع مقاول</option>
        </select></div>
        <div className={ui.fieldGroup}><label htmlFor="opening-contractor">المقاول</label>
        <select id="opening-contractor" className={ui.control} required value={openingContractor}
          onChange={e => setOpeningContractor(e.target.value)} disabled={busy}>
          <option value="">اختر المقاول</option>
          {contractors.filter(c => !c.is_archived && (openingType === "VEHICLE_CASH" || !c.is_primary)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
        {openingType === "VEHICLE_CASH" && <>
          <div className={ui.fieldGroup}><label htmlFor="opening-vehicle">العربية المرتبطة بالمقاول</label>
          <select id="opening-vehicle" className={ui.control} required value={openingVehicle}
            onChange={e => setOpeningVehicle(e.target.value)} disabled={busy}>
            <option value="">اختر العربية</option>
            {accounts.filter(a => a.contractor_id === openingContractor).map(a => {
              const v = vehicles.find(v => v.id === a.vehicle_id);
              return <option key={a.vehicle_id} value={a.vehicle_id}>{v?.plate_number ?? a.vehicle_id}</option>;
            })}
          </select></div>
        </>}
        <div className={ui.fieldGroup}><label htmlFor="opening-date">تاريخ بداية الرصيد</label>
        <input id="opening-date" type="date" className={ui.control} required value={openingDate}
          onChange={e => setOpeningDate(e.target.value)} disabled={busy} /></div>
        <div className={ui.fieldGroup}><label htmlFor="opening-amount">المبلغ بالجنيه (سالب أو موجب)</label>
        <input id="opening-amount" className={ui.control} required inputMode="decimal"
          placeholder="1250" value={openingAmount}
          onChange={e => setOpeningAmount(e.target.value)} disabled={busy} /></div>
        <div className={ui.actions}><button disabled={busy} type="submit">حفظ الرصيد الافتتاحي</button></div>
      </form>
    </section>
  </>;
}
