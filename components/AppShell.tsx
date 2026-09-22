"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import FooterWrapper from "@/components/FooterWrapper";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tiba_sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  function handleToggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("tiba_sidebar_collapsed", String(next));
      return next;
    });
  }

  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/pending";

  if (isAuthPage) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Clinical Sidebar on the left */}
      <Sidebar collapsed={collapsed} onToggleCollapse={handleToggle} />

      {/* Main Content Area - Expands to wide monitor layout with dynamic sidebar margin on the left */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "lg:ml-20" : "lg:ml-68"
        }`}
      >
        <main className="flex-1 w-full max-w-[1780px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <FooterWrapper />
      </div>
    </div>
  );
}
