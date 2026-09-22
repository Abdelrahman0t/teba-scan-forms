import type { Metadata } from "next";
export const metadata: Metadata = { title: "في انتظار الموافقة — مركز طيبة سكان للأشعة" };
export default function PendingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
