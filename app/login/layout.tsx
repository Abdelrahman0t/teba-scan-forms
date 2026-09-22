import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "تسجيل الدخول — مركز طيبة سكان للأشعة",
  description: "تسجيل الدخول لنظام إدارة النماذج الطبية",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
