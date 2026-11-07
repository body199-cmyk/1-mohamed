import Link from "next/link";

export const metadata = { title: "الرئيسية — أحمد أبو علي" };

const shortcuts = [
  { title: "تسجيل النقلات", href: "/demo/trips", icon: "🚚", hint: "إضافة ومتابعة الشغل" },
  { title: "دفعات العربيات", href: "/demo/payments", icon: "💳", hint: "الدفعات والمستحقات" },
  { title: "كشف حساب المقاول", href: "/demo/contractors", icon: "📋", hint: "مين له ومين عليه" },
  { title: "نقدية العربية", href: "/demo/reports/vehicle-cash", icon: "🚛", hint: "حساب كل عربية" },
  { title: "التقرير اليومي", href: "/demo/reports/daily", icon: "📅", hint: "شغل اليوم بالتفصيل" },
  { title: "البيانات الأساسية", href: "/demo/master-data", icon: "🗂️", hint: "المقاولين والعربيات" },
  { title: "لوحة المؤشرات", href: "/demo/dashboard", icon: "📊", hint: "ملخص أداء الشغل" },
  { title: "الإعدادات", href: "/demo/settings", icon: "⚙️", hint: "تفضيلات العرض" },
];

export default function HomePage() {
  return <div className="shortcutHome">
    <div className="shortcutHeading">
      <div><p className="shortcutEyebrow">نظام حسابات النقل</p><h1>أهلًا بك في إدارة الشغل</h1><p>اختار العملية اللي محتاجها. كل حسابات المقاولين والعربيات في مكان واحد.</p></div>
      <Link href="/demo/contractors" className="shortcutStatementLink">كشف مين له ومين عليه ←</Link>
    </div>
    <div className="shortcutGrid">{shortcuts.map((item, index) =>
      <Link key={item.href} href={item.href} className={`shortcutTile shortcutTile${index % 4}`}>
        <span className="shortcutIcon" aria-hidden="true">{item.icon}</span>
        <span className="shortcutTitle">{item.title}</span>
        <span className="shortcutHint">{item.hint}</span>
        <span className="shortcutArrow" aria-hidden="true">←</span>
      </Link>
    )}</div>
  </div>;
}
