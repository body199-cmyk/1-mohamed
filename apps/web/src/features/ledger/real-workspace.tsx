"use client";
import { useState } from "react";
import { LogoutButton } from "../auth/logout-button";
import { TransactionEntry } from "./transaction-entry";
import { RecordActions } from "./record-actions";
import { RealContractorStatement } from "./real-contractor-statement";
import { RealReports } from "./real-reports";
import { MasterDataEntry } from "./master-data-entry";
import { RealCashStatement } from "./real-cash-statement";
import { useWorkspaceData } from "./workspace-data";
import { useTheme } from "../../components/theme-provider";
import styles from "./workspace.module.css";
import ui from "./workspace-ui.module.css";
import {WorkspaceIcon} from './workspace-icon';
import {DataDeletionSettings} from './data-deletion-settings';
const sections = [
  ["home","الرئيسية"],["entry","تسجيل الشغل والدفعات"],["reports","النقلات واليومية"],
  ["contractor","كشف المقاول"],["cash","كشف حساب عربية"],["master","البيانات الأساسية"],["settings","الإعدادات"]
] as const;
const shortcutDetails = {
  entry: ["🚚", "إضافة ومتابعة الشغل والدفعات"],
  reports: ["📅", "شغل اليوم بالتفصيل"],
  contractor: ["📋", "مين له ومين عليه"],
  cash: ["🚛", "النقلات والدفعات والمتبقي للعربية"],
  master: ["🗂️", "المقاولين والعربيات"],
} as const;
type Screen=typeof sections[number][0];
export function RealWorkspace() {
  const data=useWorkspaceData();
  const [screen,setScreen]=useState<Screen>("home");
  const [dataGeneration,setDataGeneration]=useState(0);
  const {theme,toggleTheme}=useTheme();
  const blocked=data.busy||data.loading;
  async function afterDeletion(){await data.refresh();setDataGeneration(value=>value+1);}
  if(!data.configured) return <section><h1>إدارة حسابات النقل</h1>
    <p role="status">لم يتم ربط قاعدة البيانات بعد. الحفظ الدائم غير متاح حاليًا.</p></section>;
  return <div className={styles.workspace}>
    <header className={styles.header}><h1><WorkspaceIcon name="entry"/>إدارة حسابات النقل</h1><LogoutButton /></header>
    <nav className={styles.nav} aria-label="القائمة الرئيسية">
      {sections.map(([id,label])=><button key={id} aria-current={screen===id?"page":undefined}
        onClick={()=>setScreen(id)}><WorkspaceIcon name={id}/>{label}</button>)}
    </nav>
    <div className={styles.content}>
      {data.notice&&<p role="status" className={styles.notice}>{data.notice}</p>}
      <div className={styles.toolbar}><h2>{sections.find(([id])=>id===screen)?.[1]}</h2>
        <button disabled={blocked} onClick={()=>void data.refresh()}>{data.loading?"جارٍ التحديث...":"تحديث البيانات"}</button></div>
      <section className={ui.surface} hidden={screen!=="home"}>
        <div className="shortcutHeading"><div>
          <h2>أهلًا بك في إدارة الشغل</h2><p>سجّل الشغل، راجع الحسابات، وصدّر الكشوف.</p></div></div>
        <div className={`shortcutGrid ${styles.shortcuts}`}>{sections.filter(([id])=>id!=="home"&&id!=="settings").map(([id,label],index)=> {
          const detail = shortcutDetails[id as keyof typeof shortcutDetails];
          return <button key={id} type="button" className={`shortcutTile shortcutTile${index % 4}`} onClick={()=>setScreen(id)}>
            <span className="shortcutIcon" aria-hidden="true"><WorkspaceIcon name={id}/></span>
            <span className="shortcutTitle">{label}</span><span className="shortcutHint">{detail[1]}</span>
            <span className="shortcutArrow" aria-hidden="true">←</span>
          </button>;
        })}</div>
        <p>المقاولون: {data.contractors.filter(c=>!c.is_archived&&!c.is_primary).length} — العربيات: {data.vehicles.filter(v=>!v.is_archived).length}</p>
        {data.contractors.length===0&&!data.loading&&<p role="status">الحساب فارغ. ابدأ بإعداد صاحب الحساب ثم أضف المقاولين والعربيات من البيانات الأساسية.</p>}
      </section>
      <div key={"entry"+dataGeneration} hidden={screen!=="entry"}><TransactionEntry {...data} busy={blocked} onExit={()=>setScreen("home")} /></div>
      <div key={"reports"+dataGeneration} hidden={screen!=="reports"}><RealReports {...data} disabled={blocked} /></div>
      <div key={"contractor"+dataGeneration} hidden={screen!=="contractor"}><RealContractorStatement {...data} disabled={blocked} /></div>
      <div key={"cash"+dataGeneration} hidden={screen!=="cash"}><RealCashStatement {...data} disabled={blocked} /></div>
      <div key={"master"+dataGeneration} hidden={screen!=="master"}>
        <MasterDataEntry {...data} busy={blocked}/>
        <RecordActions {...data} busy={blocked} mode="master" reportType="trips.list" reportRows={[]} />
      </div>
      <section className={`${ui.surface} ${ui.settings}`} hidden={screen!=="settings"}>
        <h2>الإعدادات</h2><button onClick={toggleTheme}>المظهر: {theme==="dark"?"داكن":"فاتح"}</button>
        <p>تغيير كلمة المرور واستعادتها من شاشة تسجيل الدخول عبر بريد صاحب الحساب.</p>
        <p>نسخ قاعدة البيانات واستعادتها تُدار بواسطة المسؤول؛ تصدير التقرير ليس نسخة احتياطية للبرنامج.</p>
        <DataDeletionSettings vehicles={data.vehicles} disabled={blocked} revision={data.revision} onDeleted={afterDeletion}/>
      </section>
    </div>
  </div>;
}

