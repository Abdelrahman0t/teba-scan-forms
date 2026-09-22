import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "حسابي الشخصي — مركز طيبة سكان للأشعة",
  description: "الملف الشخصي للمستخدم، الصلاحيات، وإدارة كلمة المرور",
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
