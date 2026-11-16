"use client";
import { useEffect, useRef, useState } from "react";
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
import { WorkspaceIcon } from "./workspace-icon";

const primarySections = [
  { id: "daily", title: "اليومية", label: "اليومية", icon: "daily" },
  { id: "contractor", title: "حساب شغل المقاولين", label: "المقاولون", icon: "contractor" },
  { id: "cash", title: "حسابات العربيات والدفعات", label: "العربيات", icon: "cash" },
  { id: "reports", title: "التقارير والكشوف", label: "التقارير", icon: "reports" },
] as const;

const secondarySections = [
  { id: "master", title: "إدارة البيانات", icon: "master" },
  { id: "settings", title: "الإعدادات", icon: "settings" },
] as const;

type Screen =
  | (typeof primarySections)[number]["id"]
  | (typeof secondarySections)[number]["id"];

const allSections = [...primarySections, ...secondarySections];

export function RealWorkspace() {
  const data = useWorkspaceData();
  const [screen, setScreen] = useState<Screen>("daily");
  // TransactionEntry calls onExit only after a successful write; return to the daily landing here.
  const [dailyEntryVisible, setDailyEntryVisible] = useState(true);
  const [dailyExitNotice, setDailyExitNotice] = useState(false);
  const [focusTarget, setFocusTarget] = useState<"trip" | "payment" | null>(null);
  const contextRequestId = useRef(0);
  const [tripContextRequest, setTripContextRequest] = useState<{id:number;value:string}|null>(null);
  const [paymentContextRequest, setPaymentContextRequest] = useState<{id:number;value:string}|null>(null);
  const { theme, toggleTheme } = useTheme();
  const blocked = data.busy || data.loading;
  const screenTitle = allSections.find(section => section.id === screen)?.title ?? "اليومية";

  useEffect(() => {
    if (screen !== "daily" || !dailyEntryVisible || !focusTarget) return;
    const target = document.getElementById(focusTarget === "trip" ? "real-trip-vehicle" : "real-payment-account");
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    setFocusTarget(null);
  }, [screen, dailyEntryVisible, focusTarget]);

  function openDailyAt(target: "trip" | "payment", value?: string) {
    if (value) {
      const request = { id: ++contextRequestId.current, value };
      if (target === "trip") setTripContextRequest(request);
      else setPaymentContextRequest(request);
    }
    setDailyExitNotice(false);
    setDailyEntryVisible(true);
    setFocusTarget(target);
    setScreen("daily");
  }

  if (!data.configured) return <section><h1>إدارة حسابات النقل</h1>
    <p role="status">لم يتم ربط قاعدة البيانات بعد. الحفظ الدائم غير متاح حاليًا.</p></section>;

  return <div className={styles.workspace}>
    <header className={styles.header}>
      <h1><WorkspaceIcon name="daily" />إدارة حسابات النقل</h1>
      <div className={styles.headerActions}>
        <LogoutButton />
        <details className={styles.mobileMore} data-testid="mobile-more" onKeyDown={event => {
          if (event.key === "Escape") {
            event.currentTarget.removeAttribute("open");
            event.currentTarget.querySelector<HTMLElement>("summary")?.focus();
          }
        }}>
          <summary aria-label="المزيد: إدارة البيانات والإعدادات" title="المزيد">
            <WorkspaceIcon name="more" /><span>المزيد</span>
          </summary>
          <div className={styles.mobileMoreMenu}>
            {secondarySections.map(({ id, title, icon }) => (
              <button key={id} type="button" aria-current={screen === id ? "page" : undefined} onClick={event => {
                setScreen(id);
                const menu = event.currentTarget.closest("details");
                menu?.removeAttribute("open");
                menu?.querySelector<HTMLElement>("summary")?.focus();
              }}>
                <WorkspaceIcon name={icon} />{title}
              </button>
            ))}
          </div>
        </details>
        <button
          type="button"
          className={styles.themeToggle}
          aria-label="تبديل الوضع الفاتح/الداكن"
          title="تبديل الوضع الفاتح/الداكن"
          aria-pressed={theme === "dark"}
          onClick={toggleTheme}
        >
          <WorkspaceIcon name={theme === "dark" ? "sun" : "moon"} />
          <span>{theme === "dark" ? "فاتح" : "داكن"}</span>
        </button>
      </div>
    </header>

    <nav className={styles.nav} aria-label="التنقل الرئيسي">
      <div className={styles.primaryNav}>
        {primarySections.map(({ id, title, label, icon }) => (
          <button key={id} type="button" aria-label={title} title={title}
            aria-current={screen === id ? "page" : undefined}
            onClick={() => setScreen(id)}>
            <WorkspaceIcon name={icon} />
            <span className={styles.navDesktopLabel}>{title}</span>
            <span className={styles.navMobileLabel}>{label}</span>
          </button>
        ))}
      </div>
      <div className={styles.desktopSecondaryNav} role="group" aria-label="إدارة">
        <p>إدارة</p>
        {secondarySections.map(({ id, title, icon }) => (
          <button key={id} type="button" aria-label={title} title={title}
            aria-current={screen === id ? "page" : undefined}
            onClick={() => setScreen(id)}>
            <WorkspaceIcon name={icon} /><span>{title}</span>
          </button>
        ))}
      </div>
    </nav>

    <div className={styles.content}>
      {data.notice && <p role="status" className={styles.notice}>{data.notice}</p>}
      <div className={styles.toolbar}>
        <h2 data-testid="workspace-title">{screenTitle}</h2>
        <button type="button" disabled={blocked} onClick={() => void data.refresh()}>
          <WorkspaceIcon name="refresh" />{data.loading ? "جارٍ التحديث..." : "تحديث البيانات"}
        </button>
      </div>

      <div className={styles.dailyCounts} hidden={screen !== "daily"}>
        <span>المقاولون: <strong>{data.contractors.filter(c => !c.is_archived && !c.is_primary).length}</strong></span>
        <span>العربيات: <strong>{data.vehicles.filter(v => !v.is_archived).length}</strong></span>
      </div>

      <div hidden={screen !== "daily"}>
        {data.contractors.length === 0 && !data.loading && (
          <section className={ui.surface + " " + styles.emptyState}>
            <p role="status">الحساب فارغ. ابدأ بإعداد صاحب الحساب ثم أضف المقاولين والعربيات من إدارة البيانات.</p>
            <button type="button" onClick={() => setScreen("master")}>إدارة البيانات</button>
          </section>
        )}
        {dailyEntryVisible ? (
          <TransactionEntry {...data} busy={blocked} tripCounterpartyRequest={tripContextRequest} paymentAccountRequest={paymentContextRequest} onExit={() => {
            setDailyEntryVisible(false);
            setDailyExitNotice(true);
          }} />
        ) : (
          <section className={ui.surface + " " + styles.dailyLanding}>
            <p role="status">{dailyExitNotice ? "تم حفظ النقلة والخروج من نموذج الإدخال." : "اليومية جاهزة لمتابعة الشغل والدفعات."}</p>
            <button type="button" onClick={() => {
              setDailyExitNotice(false);
              setDailyEntryVisible(true);
            }}>تسجيل شغل أو دفعة</button>
          </section>
        )}
      </div>
      <div hidden={screen !== "reports"}><RealReports {...data} disabled={blocked} /></div>
      <div hidden={screen !== "contractor"}><RealContractorStatement {...data} disabled={blocked} onRegisterWork={contractorId => openDailyAt("trip", contractorId)} /></div>
      <div hidden={screen !== "cash"}><RealCashStatement {...data} disabled={blocked} onRegisterPayment={account => openDailyAt("payment", account)} /></div>
      <div hidden={screen !== "master"}>
        <MasterDataEntry {...data} busy={blocked} />
        <RecordActions {...data} busy={blocked} mode="master" reportType="trips.list" reportRows={[]} />
      </div>
      <section className={ui.surface + " " + ui.settings} hidden={screen !== "settings"}>
        <h2>الإعدادات</h2><button onClick={toggleTheme}>المظهر: {theme === "dark" ? "داكن" : "فاتح"}</button>
        <p>تغيير كلمة المرور واستعادتها من شاشة تسجيل الدخول عبر بريد صاحب الحساب.</p>
        <p>نسخ قاعدة البيانات واستعادتها تُدار بواسطة المسؤول؛ تصدير التقرير ليس نسخة احتياطية للبرنامج.</p>
      </section>
    </div>
  </div>;
}
