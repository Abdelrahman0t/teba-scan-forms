import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "إدارة المستخدمين والموافقات — مركز طيبة سكان للأشعة",
  description: "لوحة تحكم المسؤول لإدارة المستخدمين واعتماد الحسابات الطبية",
};

export default function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
