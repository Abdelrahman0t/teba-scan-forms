"use client";
import { usePathname } from "next/navigation";

export default function FooterWrapper() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/register" || pathname === "/pending") return null;
  return (
    <footer className="bg-[#24082c] text-purple-300/80 py-4 text-center text-xs no-print border-t border-purple-900/50">
      مركز طيبة سكان للأشعة • Tiba Scan Investigation &amp; Radiology Center © 2026
    </footer>
  );
}
