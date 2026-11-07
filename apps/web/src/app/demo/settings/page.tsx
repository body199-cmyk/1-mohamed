"use client";
import { useTheme } from "../../../components/theme-provider";
export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  return <section style={{maxWidth:680,display:"grid",gap:20}}>
    <div><h1>الإعدادات</h1><p style={{color:"var(--text-muted)"}}>تفضيلات عرض النظام، منفصلة عن بيانات المقاولين والعربيات.</p></div>
    <div style={{background:"var(--surface-card)",border:"1px solid var(--border-color)",padding:22,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <div><h2 style={{fontSize:"1.05rem"}}>مظهر التطبيق</h2><p style={{color:"var(--text-muted)"}}>الوضع الحالي: {theme === "light" ? "فاتح" : "داكن"}</p></div>
      <button type="button" onClick={toggleTheme} style={{background:"var(--color-primary)",color:"#fff",borderRadius:10,padding:"12px 18px",fontWeight:700}}>تغيير المظهر</button>
    </div>
    <p style={{color:"var(--text-muted)",fontSize:13}}>إعدادات البيانات والحسابات غير متاحة هنا؛ لا يتم تغيير أي قواعد محاسبية من هذه الصفحة.</p>
  </section>;
}
