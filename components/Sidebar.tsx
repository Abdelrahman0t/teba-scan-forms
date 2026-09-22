"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Users,
  Database,
  ShieldAlert,
  ClipboardCheck,
  Baby,
  Ambulance,
  HeartPulse,
  Activity,
  ShieldCheck,
  UserCircle,
  UserPlus,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser, getRoleLabel, getRoleBadgeClass } from "@/lib/supabase/auth";
import { useFormSync } from "@/lib/syncEvents";

const ALL_FORM_ROUTES = [
  {
    href: "/forms/fall-risk-screening",
    label: "مسح مخاطر السقوط",
    code: "TRC.MRS",
    icon: ShieldAlert,
    roles: ["nurse"],
  },
  {
    href: "/forms/patient-assessment",
    label: "التقييم الشامل للمريض",
    code: "TRC-ICD",
    icon: ClipboardCheck,
    roles: ["nurse", "technician", "radiologist"],
  },
  {
    href: "/forms/fall-risk-adult",
    label: "سقوط الكبار (Hendrich II)",
    code: "TRC-ICD",
    icon: ShieldAlert,
    roles: ["nurse"],
  },
  {
    href: "/forms/fall-risk-pediatric",
    label: "سقوط الأطفال (Humpty Dumpty)",
    code: "TRC.ICD",
    icon: Baby,
    roles: ["nurse"],
  },
  {
    href: "/forms/patient-transfer",
    label: "نقل المريض (RSTP)",
    code: "TRC.ACT",
    icon: Ambulance,
    roles: ["radiologist", "nurse"],
  },
  {
    href: "/forms/patient-education",
    label: "التثقيف الصحي للأسرة",
    code: "TRC.MRS",
    icon: HeartPulse,
    roles: ["nurse", "technician"],
  },
  {
    href: "/forms/radiation-exposure",
    label: "جرعات الأشعة",
    code: "TRC.MRS",
    icon: Activity,
    roles: ["technician"],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ collapsed: propCollapsed, onToggleCollapse }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, role, isAdmin, loading } = useUser();

  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState({ patients: 0, submissions: 0 });

  const isControlled = typeof propCollapsed === "boolean";
  const collapsed = isControlled ? propCollapsed : localCollapsed;

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Load sidebar collapsed state if uncontrolled
  useEffect(() => {
    if (!isControlled) {
      const saved = localStorage.getItem("tiba_sidebar_collapsed");
      if (saved !== null) {
        setLocalCollapsed(saved === "true");
      }
    }
  }, [isControlled]);

  function handleToggle() {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setLocalCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem("tiba_sidebar_collapsed", String(next));
        return next;
      });
    }
  }

  // Live badge counts
  useEffect(() => {
    fetchCounts();
  }, []);

  useFormSync(() => {
    fetchCounts();
  });

  async function fetchCounts() {
    try {
      const [pRes, sRes] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("form_submissions").select("*", { count: "exact", head: true }),
      ]);
      setCounts({
        patients: pRes.count || 0,
        submissions: sRes.count || 0,
      });
    } catch {}
  }

  // Always display all 7 models in the sidebar
  const formRoutes = ALL_FORM_ROUTES;

  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/pending";
  if (isAuthPage) return null;

  return (
    <>
      {/* ========================================================================= */}
      {/* MOBILE TOP BAR (Visible only on small screens)                            */}
      {/* ========================================================================= */}
      <div className="lg:hidden bg-gradient-to-r from-[#2c0b36] via-[#3e1149] to-[#2c0b36] text-white p-3.5 flex items-center justify-between shadow-md sticky top-0 z-40 no-print border-b border-purple-900/60">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-800 cursor-pointer"
            aria-label="فتح القائمة السريرية"
          >
            <Menu className="w-5 h-5" />
          </button>
          {role && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${getRoleBadgeClass(role)}`}>
              {profile?.full_name?.split(" ")[0] || getRoleLabel(role)}
            </span>
          )}
        </div>

        <Link href="/" className="flex items-center gap-2.5">
          <div className="text-right">
            <span className="text-xs font-bold block leading-tight">مركز طيبة سكان للأشعة</span>
            <span className="text-[9px] text-purple-300 font-mono block">Tiba Scan EMR</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-white p-0.5 overflow-hidden flex items-center justify-center shrink-0">
            <img src="/tiba-scan.jpg" alt="Tiba Scan" className="w-full h-full object-contain" />
          </div>
        </Link>
      </div>

      {/* MOBILE BACKDROP OVERLAY */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden transition-opacity"
        />
      )}

      {/* ========================================================================= */}
      {/* MAIN CLINICAL SIDEBAR (Desktop Docked on Left + Mobile Drawer)            */}
      {/* ========================================================================= */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col bg-gradient-to-b from-[#25082e] via-[#350d41] to-[#1f0526] text-white shadow-2xl transition-all duration-300 ease-in-out no-print border-r border-purple-900/60 ${
          // Mobile drawer: slides from left
          mobileOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"
        } ${
          // Desktop width
          collapsed ? "lg:w-20" : "lg:w-68"
        }`}
      >
        {/* SIDEBAR HEADER / BRAND */}
        {collapsed && !mobileOpen ? (
          <div className="p-3 border-b border-purple-900/60 flex items-center justify-center">
            <Link
              href="/"
              className="w-11 h-11 rounded-xl bg-white p-1 shadow-md border border-purple-300/40 flex items-center justify-center shrink-0 hover:scale-105 transition-transform overflow-hidden mx-auto"
              title="مركز طيبة سكان للأشعة - الرئيسية"
            >
              <img src="/tiba-scan.jpg" alt="Tiba Scan" className="w-full h-full object-contain" />
            </Link>
          </div>
        ) : (
          <div className="p-4 border-b border-purple-900/60 flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-3 group min-w-0 overflow-hidden flex-1">
              <div className="w-10 h-10 rounded-xl bg-white p-0.5 shadow-md border border-purple-300/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                <img src="/tiba-scan.jpg" alt="Tiba Scan" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-black text-white group-hover:text-purple-200 transition-colors block truncate">
                  طيبة سكان للأشعة
                </span>
                <span className="text-[10px] text-purple-300/80 block font-mono">
                  Clinical Workspace
                </span>
              </div>
            </Link>

            {/* Desktop Collapse Button */}
            <button
              onClick={handleToggle}
              className="hidden lg:flex p-1.5 rounded-lg text-purple-300 hover:text-white hover:bg-purple-900/60 transition-colors cursor-pointer shrink-0"
              title="طي القائمة"
              aria-label="طي القائمة"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-purple-300 hover:text-white hover:bg-purple-900/60 shrink-0"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* STAFF IDENTITY CARD (WHOLE CARD REDIRECTS TO PROFILE / ACCOUNT) */}
        {(!collapsed || mobileOpen) ? (
          <Link
            href="/account"
            className="p-3 mx-3 mt-3 rounded-2xl bg-white/8 hover:bg-white/15 border border-white/12 shadow-sm flex items-center gap-3 group transition-all cursor-pointer block"
            title="الانتقال إلى الملف الشخصي والحساب"
          >
            <div className="relative shrink-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform ${
                  isAdmin
                    ? "bg-gradient-to-tr from-[#50135b] to-[#6d1a7b] border border-yellow-400/80 shadow-yellow-500/20"
                    : "bg-gradient-to-tr from-[#621c6f] to-[#8d2799] border border-purple-300/40"
                }`}
              >
                <UserCircle className={`w-5 h-5 ${isAdmin ? "text-yellow-400" : "text-white"}`} />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#25082e] rounded-full" title="متصل الآن" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-white block truncate leading-tight group-hover:text-purple-200 transition-colors">
                {profile?.full_name || "مستخدم سريري"}
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRoleBadgeClass(role)}`}>
                  {getRoleLabel(role)}
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <div className="py-3 px-2 flex items-center justify-center border-b border-purple-900/50 relative">
            <Link
              href="/account"
              className="relative group p-1 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center cursor-pointer"
              title={`${profile?.full_name || "المستخدم"} (${getRoleLabel(role)}) - انقر للملف الشخصي`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform relative ${
                  isAdmin
                    ? "bg-gradient-to-tr from-[#50135b] to-[#6d1a7b] border border-yellow-400/80 shadow-yellow-500/20"
                    : "bg-gradient-to-tr from-[#621c6f] to-[#8d2799] border border-purple-300/40"
                }`}
              >
                <UserCircle className={`w-5 h-5 ${isAdmin ? "text-yellow-400" : "text-white"}`} />
                <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-emerald-400 border border-[#25082e] rounded-full" />
              </div>
            </Link>

            {/* Arrow on the right edge of the sidebar, centered with user icon */}
            <button
              onClick={handleToggle}
              className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#350d41] hover:bg-[#4d135e] text-purple-200 hover:text-white flex items-center justify-center shadow-lg border border-purple-400/40 transition-all cursor-pointer z-50 hover:scale-110"
              title="توسيع القائمة"
              aria-label="توسيع القائمة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* NAVIGATION SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">

          {/* PRIMARY WORKSPACE LINKS */}
          <div className="space-y-1">
            {(!collapsed || mobileOpen) && (
              <span className="text-[10px] font-bold text-purple-300/60 px-2 block uppercase tracking-wider mb-1">
                {role === "admission" ? "بوابة الاستقبال" : "المنظومة السريرية"}
              </span>
            )}

            {/* Admission Desk Link (For Admission staff & Admins) */}
            {(role === "admission" || isAdmin) && (
              <Link
                href="/admission"
                className={`flex items-center gap-3 rounded-xl text-xs font-bold transition-all group ${
                  pathname === "/admission"
                    ? "bg-[#7a2088] text-white shadow-md shadow-purple-950/40 border border-purple-400/30"
                    : "text-purple-100 hover:bg-white/8 hover:text-white"
                } ${collapsed && !mobileOpen ? "w-10 h-10 p-0 mx-auto justify-center" : "px-3 py-2.5"}`}
                title="مكتب الدخول وتسجيل المرضى"
              >
                <UserPlus className="w-4 h-4 text-purple-300 group-hover:text-white shrink-0" />
                {(!collapsed || mobileOpen) && <span>مكتب الدخول</span>}
              </Link>
            )}

            {/* Dashboard Link */}
            <Link
              href="/"
              className={`flex items-center gap-3 rounded-xl text-xs font-bold transition-all group ${
                pathname === "/"
                  ? "bg-[#7a2088] text-white shadow-md shadow-purple-950/40 border border-purple-400/30"
                  : "text-purple-100 hover:bg-white/8 hover:text-white"
              } ${collapsed && !mobileOpen ? "w-10 h-10 p-0 mx-auto justify-center" : "px-3 py-2.5"}`}
              title="لوحة المتابعة الرئيسية"
            >
              <Home className="w-4 h-4 text-purple-300 group-hover:text-white shrink-0" />
              {(!collapsed || mobileOpen) && <span>لوحة المتابعة</span>}
            </Link>

            {/* Clinical Staff Links: Patients 360 & Submissions (Hidden from Admission Desk) */}
            {role !== "admission" && (
              <>
                <Link
                  href="/patients"
                  className={`flex items-center justify-between rounded-xl text-xs font-bold transition-all group ${
                    pathname === "/patients"
                      ? "bg-[#7a2088] text-white shadow-md shadow-purple-950/40 border border-purple-400/30"
                      : "text-purple-100 hover:bg-white/8 hover:text-white"
                  } ${collapsed && !mobileOpen ? "w-10 h-10 p-0 mx-auto justify-center" : "px-3 py-2.5"}`}
                  title="سجل المرضى الشامل"
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-purple-300 group-hover:text-white shrink-0" />
                    {(!collapsed || mobileOpen) && <span>سجل المرضى</span>}
                  </div>
                  {(!collapsed || mobileOpen) && counts.patients > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/15 text-purple-200">
                      {counts.patients}
                    </span>
                  )}
                </Link>

                <Link
                  href="/submissions"
                  className={`flex items-center justify-between rounded-xl text-xs font-bold transition-all group ${
                    pathname === "/submissions"
                      ? "bg-[#7a2088] text-white shadow-md shadow-purple-950/40 border border-purple-400/30"
                      : "text-purple-100 hover:bg-white/8 hover:text-white"
                  } ${collapsed && !mobileOpen ? "w-10 h-10 p-0 mx-auto justify-center" : "px-3 py-2.5"}`}
                  title="السجلات الطبية الموثقة"
                >
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-purple-300 group-hover:text-white shrink-0" />
                    {(!collapsed || mobileOpen) && <span>السجلات الطبية</span>}
                  </div>
                  {(!collapsed || mobileOpen) && counts.submissions > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/15 text-purple-200">
                      {counts.submissions}
                    </span>
                  )}
                </Link>
              </>
            )}
          </div>

          {/* CLINICAL FORMS SECTION - Show all 7 models, disabled if unauthorized for role */}
          <div className="space-y-1 pt-2 border-t border-purple-900/50">
            {(!collapsed || mobileOpen) && (
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-[10px] font-bold text-purple-300/60 uppercase tracking-wider">
                  النماذج السريرية
                </span>
                <span className="text-[9px] font-mono text-purple-400 bg-white/5 px-1.5 py-0.2 rounded">
                  {ALL_FORM_ROUTES.length}
                </span>
              </div>
            )}

            {ALL_FORM_ROUTES.map((f) => {
              const Icon = f.icon;
              const isActive = pathname === f.href;
              const isAllowed = isAdmin || (role ? f.roles.includes(role) : !loading);

              if (!isAllowed) {
                return (
                  <div
                    key={f.href}
                    className={`flex items-center justify-between rounded-xl text-xs font-medium transition-all opacity-40 cursor-not-allowed select-none bg-white/[0.02] border border-transparent ${
                      collapsed && !mobileOpen ? "w-10 h-10 p-0 mx-auto justify-center" : "px-3 py-2"
                    }`}
                    title={`${f.label} (غير متاح لدور: ${getRoleLabel(role)})`}
                    aria-disabled="true"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0 flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-purple-300/50" />
                        {collapsed && !mobileOpen && (
                          <Lock className="w-2.5 h-2.5 text-purple-300/80 absolute -bottom-1 -right-1" />
                        )}
                      </div>
                      {(!collapsed || mobileOpen) && (
                        <span className="truncate text-purple-200/60">{f.label}</span>
                      )}
                    </div>
                    {(!collapsed || mobileOpen) && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Lock className="w-3 h-3 text-purple-300/60" />
                        <span className="text-[9px] font-mono text-purple-300/40 bg-[#16041b]/60 px-1 py-0.2 rounded border border-purple-900/30">
                          {f.code}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={f.href}
                  href={f.href}
                  className={`flex items-center justify-between rounded-xl text-xs font-bold transition-all group ${
                    isActive
                      ? "bg-[#621c6f] text-white shadow-xs border border-purple-400/40"
                      : "text-purple-200/90 hover:bg-white/8 hover:text-white"
                  } ${collapsed && !mobileOpen ? "w-10 h-10 p-0 mx-auto justify-center" : "px-3 py-2"}`}
                  title={f.label}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-purple-300 group-hover:text-white"}`} />
                    {(!collapsed || mobileOpen) && (
                      <span className="truncate">{f.label}</span>
                    )}
                  </div>
                  {(!collapsed || mobileOpen) && (
                    <span className="text-[9px] font-mono text-purple-300/70 bg-[#16041b] px-1 py-0.2 rounded shrink-0">
                      {f.code}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* ADMIN MANAGEMENT */}
          {isAdmin && (
            <div className="space-y-1 pt-2 border-t border-purple-900/50">
              {(!collapsed || mobileOpen) && (
                <span className="text-[10px] font-bold text-amber-300/70 px-2 block uppercase tracking-wider mb-1">
                  لوحة الإدارة
                </span>
              )}

              <Link
                href="/admin/users"
                className={`flex items-center gap-2.5 rounded-xl text-xs font-bold transition-all ${
                  pathname.startsWith("/admin/users")
                    ? "bg-amber-400 text-slate-900 shadow-md font-extrabold"
                    : "bg-amber-400/15 text-amber-200 hover:bg-amber-400/25 border border-amber-400/30"
                } ${collapsed && !mobileOpen ? "w-10 h-10 p-0 mx-auto justify-center" : "px-3 py-2"}`}
                title="إدارة المستخدمين والموافقات"
              >
                <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
                {(!collapsed || mobileOpen) && <span>إدارة المستخدمين</span>}
              </Link>
            </div>
          )}

        </div>

        {/* SIDEBAR FOOTER */}
        {(!collapsed || mobileOpen) && (
          <div className="p-3 border-t border-purple-900/60 bg-black/20 text-center text-[10px] text-purple-300/60">
            <span>مركز طيبة سكان • TRC-EMR © 2026</span>
          </div>
        )}
      </aside>
    </>
  );
}
