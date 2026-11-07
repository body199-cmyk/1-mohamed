import Link from "next/link";
import styles from "./home.module.css";

export const metadata = { title: "الرئيسية — حسابات النقل" };

const sections = [
  { title: "التشغيل اليومي", description: "ابدأ تسجيل الحركة والدفعات", items: [
    { href: "/demo/trips", icon: "🚚", title: "تسجيل نقلة", description: "إضافة النقلات ومراجعة الحركة اليومية", action: "فتح النقلات" },
    { href: "/demo/payments", icon: "💳", title: "دفعات العربيات", description: "تسجيل الدفعات ومتابعة المدفوعات", action: "فتح الدفعات" },
  ] },
  { title: "الحسابات والتقارير", description: "راجع المستحقات وحركة الشغل", items: [
    { href: "/demo/contractors", icon: "📒", title: "كشف حساب المقاول", description: "عرض الحسابات والأرصدة لكل مقاول", action: "فتح الكشف" },
    { href: "/demo/reports/vehicle-cash", icon: "💰", title: "نقدية العربية", description: "مراجعة حركة النقدية الخاصة بالعربيات", action: "فتح النقدية" },
    { href: "/demo/reports/daily", icon: "📅", title: "التقرير اليومي", description: "ملخص الشغل خلال يوم محدد", action: "فتح التقرير" },
  ] },
  { title: "المتابعة والإدارة", description: "نظرة عامة والبيانات المرجعية", items: [
    { href: "/demo/dashboard", icon: "📊", title: "لوحة المؤشرات", description: "متابعة ملخص التشغيل والأرقام", action: "عرض المؤشرات" },
    { href: "/demo/master-data", icon: "⚙️", title: "المقاولون والعربيات", description: "إدارة البيانات الأساسية", action: "فتح البيانات" },
  ] },
] as const;

export default function HomePage() {
  return <div className={styles.page}>
    <div className={styles.hero}>
      <span className={styles.eyebrow}>مساحة العمل</span>
      <h1>أهلاً بك في حسابات النقل</h1>
      <p>اختار المهمة اللي عايز تبدأ بيها. كل وظائف النظام قدامك، ومتقسمة حسب طريقة الشغل.</p>
      <Link className={styles.primary} href="/demo/trips">ابدأ بتسجيل نقلة <span aria-hidden="true">←</span></Link>
    </div>
    {sections.map(section => <section className={styles.section} key={section.title} aria-label={section.title}>
      <div className={styles.sectionHeading}><h2>{section.title}</h2><p>{section.description}</p></div>
      <div className={styles.grid}>{section.items.map(item =>
        <Link href={item.href} className={styles.card} key={item.href}>
          <span className={styles.icon} aria-hidden="true">{item.icon}</span>
          <strong>{item.title}</strong>
          <span className={styles.description}>{item.description}</span>
          <span className={styles.action}>{item.action} <span aria-hidden="true">←</span></span>
        </Link>
      )}</div>
    </section>)}
    <p className={styles.note}>هذه واجهة المعاينة التجريبية؛ لا تعتبر البيانات المعروضة سجلات إنتاج فعلية.</p>
  </div>;
}
