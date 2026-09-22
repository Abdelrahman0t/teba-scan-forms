"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  HeartPulse,
  Home,
  Database,
  Menu,
  X,
  ShieldAlert,
  Baby,
  ClipboardCheck,
  Ambulance,
  ChevronDown,
  Users,
  LogOut,
  UserCircle,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser, getRoleLabel, getRoleBadgeClass, clearLocalSession } from "@/lib/supabase/auth";

// All form routes with their allowed roles
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
    label: "تقييم المريض",
    code: "TRC-ICD",
    icon: ClipboardCheck,
    roles: ["nurse", "technician", "radiologist"],
  },
  {
    href: "/forms/fall-risk-adult",
    label: "تقييم مخاطر السقوط كبار (Hendrich II)",
    code: "TRC-ICD",
    icon: ShieldAlert,
    roles: ["nurse"],
  },
  {
    href: "/forms/fall-risk-pediatric",
    label: "تقييم مخاطر السقوط اطفال (Humpty Dumpty)",
    code: "TRC.ICD",
    icon: Baby,
    roles: ["nurse"],
  },
  {
    href: "/forms/patient-transfer",
    label: "نموذج نقل المريض (RSTP)",
    code: "TRC.ACT",
    icon: Ambulance,
    roles: ["radiologist", "nurse"],
  },
  {
    href: "/forms/patient-education",
    label: "نموذج التثقيف الصحي",
    code: "TRC.MRS",
    icon: HeartPulse,
    roles: ["nurse", "technician"],
  },
  {
    href: "/forms/radiation-exposure",
    label: "حساب جرعات الأشعة",
    code: "TRC.MRS",
    icon: Activity,
    roles: ["technician"],
  },
];

const ROLE_COLOR: Record<string, string> = {
  nurse: "text-blue-300",
  technician: "text-amber-300",
  radiologist: "text-emerald-300",
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, role, isAdmin, loading } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formsDropdownOpen, setFormsDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click / Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFormsDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setFormsDropdownOpen(false);
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    setFormsDropdownOpen(false);
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    clearLocalSession();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Filter forms by role (if no role, show all — graceful fallback for unauthenticated)
  const formRoutes = role
    ? ALL_FORM_ROUTES.filter((f) => f.roles.includes(role))
    : ALL_FORM_ROUTES;

  // Hide navbar entirely on auth/onboarding pages (checked after all hooks)
  if (pathname === "/login" || pathname === "/register" || pathname === "/pending") return null;

  return (
    <header className="bg-gradient-to-r from-[#2c0b36] via-[#3e1149] to-[#2c0b36] text-white shadow-lg no-print sticky top-0 z-50 border-b border-purple-900/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-0.5 shadow-md border border-purple-200/50 group-hover:scale-105 transition-transform duration-200 overflow-hidden">
              <img src="/tiba-scan.jpg" alt="Tiba Scan Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="text-sm sm:text-base font-extrabold tracking-tight block text-white group-hover:text-purple-200 transition-colors">
                مركز طيبة سكان للأشعة
              </span>
              <span className="text-[10px] text-purple-300/80 block -mt-0.5 font-mono">
                Tiba Scan Radiology Center
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2 space-x-reverse">
            <Link
              href="/"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                pathname === "/"
                  ? "bg-[#7a2088] text-white shadow-md shadow-purple-950/40 border border-purple-400/30"
                  : "text-purple-100 hover:bg-purple-950/60 hover:text-white"
              }`}
            >
              <Home className="w-4 h-4" />
              <span>الرئيسية</span>
            </Link>

            {/* Forms Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setFormsDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                  pathname.startsWith("/forms") || formsDropdownOpen
                    ? "bg-[#581c68] text-white border border-purple-400/40 shadow-sm"
                    : "text-purple-100 hover:bg-purple-950/60 hover:text-white"
                }`}
              >
                <ClipboardCheck className="w-4 h-4 text-purple-300" />
                <span>النماذج الطبية ({formRoutes.length})</span>
                <ChevronDown className={`w-3.5 h-3.5 mt-0.5 transition-transform duration-200 ${formsDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {formsDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#2d0c38] border border-purple-800/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-purple-200 border-b border-purple-900/60 mb-1 flex items-center justify-between">
                    <span>النماذج المتاحة لدورك</span>
                    {role && (
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${getRoleBadgeClass(role)}`}>
                        {getRoleLabel(role)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 max-h-[75vh] overflow-y-auto">
                    {formRoutes.map((f) => {
                      const Icon = f.icon;
                      const isActive = pathname === f.href;
                      return (
                        <Link
                          key={f.href}
                          href={f.href}
                          onClick={() => setFormsDropdownOpen(false)}
                          className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
                            isActive ? "bg-[#7a2088] text-white shadow-xs" : "hover:bg-[#431454] text-purple-100"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-purple-300"}`} />
                            <span className="text-xs font-bold">{f.label}</span>
                          </div>
                          <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                            isActive ? "bg-[#51165e] text-white" : "bg-[#1f0826] text-purple-300"
                          }`}>
                            {f.code}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Patients */}
            <Link
              href="/patients"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                pathname === "/patients"
                  ? "bg-[#7a2088] text-white shadow-md shadow-purple-950/40 border border-purple-400/30"
                  : "text-purple-100 hover:bg-purple-950/60 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>سجل المرضى</span>
            </Link>

            {/* Medical Records / Submissions */}
            <Link
              href="/submissions"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                pathname === "/submissions"
                  ? "bg-[#7a2088] text-white shadow-md shadow-purple-950/40 border border-purple-400/30"
                  : "text-purple-100 hover:bg-purple-950/60 hover:text-white"
              }`}
            >
              <Database className="w-4 h-4" />
              <span>السجلات الطبية</span>
            </Link>

            {/* Admin Users Link */}
            {isAdmin && (
              <Link
                href="/admin/users"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  pathname.startsWith("/admin/users")
                    ? "bg-amber-400 text-slate-900 shadow-md font-extrabold"
                    : "bg-amber-400/20 text-amber-200 hover:bg-amber-400/30 border border-amber-400/30"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>إدارة المستخدمين</span>
              </Link>
            )}

            {/* User Menu */}
            {!loading && user && (
              <div className="relative mr-1" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/8 border border-white/15 hover:bg-white/15 transition-all"
                >
                  <UserCircle className={`w-4 h-4 ${role ? ROLE_COLOR[role] : "text-purple-300"}`} />
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-white block leading-tight">
                      {profile?.full_name ?? user.email?.split("@")[0]}
                    </span>
                    {role && (
                      <span className={`text-[9px] font-semibold block leading-tight ${ROLE_COLOR[role]}`}>
                        {getRoleLabel(role)}
                      </span>
                    )}
                  </div>
                  <ChevronDown className={`w-3 h-3 text-purple-300 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute left-0 mt-2 w-52 bg-[#2d0c38] border border-purple-800/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-purple-900/60 mb-1">
                      <p className="text-white text-xs font-bold">{profile?.full_name ?? "المستخدم"}</p>
                      <p className="text-purple-400 text-[10px] mt-0.5" dir="ltr">{profile?.phone ?? user.email}</p>
                      {role && (
                        <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${getRoleBadgeClass(role)}`}>
                          {getRoleLabel(role)}
                        </span>
                      )}
                    </div>
                    <Link
                      href="/account"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-purple-200 hover:bg-purple-900/50 hover:text-white text-xs font-bold transition-all"
                    >
                      <UserCircle className="w-4 h-4 text-purple-300" />
                      <span>حسابي الشخصي</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-300 hover:bg-rose-500/15 text-xs font-bold transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Mobile Button */}
          <div className="flex md:hidden items-center gap-2">
            {!loading && user && profile && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${getRoleBadgeClass(role)}`}>
                {profile.full_name.split(" ")[0]}
              </span>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-purple-200 hover:text-white hover:bg-purple-900/60 transition-colors"
              aria-label="القائمة الرئيسية"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-purple-200" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#24082c] border-t border-purple-900/60 px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">

          {/* User info on mobile */}
          {!loading && user && (
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5 border border-white/10 mb-2">
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <UserCircle className={`w-5 h-5 ${role ? ROLE_COLOR[role] : "text-purple-300"}`} />
                <div>
                  <p className="text-white text-xs font-bold">{profile?.full_name ?? user.email?.split("@")[0]}</p>
                  {role && <p className={`text-[10px] ${ROLE_COLOR[role]}`}>{getRoleLabel(role)}</p>}
                </div>
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-2 py-1 rounded-lg bg-purple-900/40 text-purple-200 hover:text-white text-[10px] font-bold border border-purple-700/50"
                >
                  حسابي
                </Link>
                <button onClick={handleLogout} className="p-1 text-rose-400 hover:text-rose-300 transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${pathname === "/" ? "bg-[#7a2088] text-white" : "text-purple-200 hover:bg-[#380e45]"}`}>
              <Home className="w-4 h-4 text-purple-300" /><span>الرئيسية</span>
            </Link>
            <Link href="/patients" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${pathname === "/patients" ? "bg-[#7a2088] text-white" : "text-purple-200 hover:bg-[#380e45]"}`}>
              <Users className="w-4 h-4 text-purple-300" /><span>سجل المرضى الشامل</span>
            </Link>
            <Link href="/submissions" onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${pathname === "/submissions" ? "bg-[#7a2088] text-white" : "text-purple-200 hover:bg-[#380e45]"}`}>
              <Database className="w-4 h-4 text-purple-300" /><span>السجلات الطبية الموثقة</span>
            </Link>
            {isAdmin && (
              <Link
                href="/admin/users"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  pathname.startsWith("/admin/users") ? "bg-amber-400 text-slate-900" : "bg-amber-400/20 text-amber-200 hover:bg-amber-400/30"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>إدارة المستخدمين والموافقات</span>
              </Link>
            )}
          </div>

          <div className="border-t border-purple-900/60 pt-2 space-y-1">
            <span className="text-[10px] font-bold text-purple-300 px-2 block">النماذج المتاحة:</span>
            {formRoutes.map((f) => {
              const Icon = f.icon;
              const isActive = pathname === f.href;
              return (
                <Link
                  key={f.href}
                  href={f.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? "bg-[#7a2088] text-white" : "text-purple-200 hover:bg-[#380e45]"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-purple-300" />
                    <span>{f.label}</span>
                  </div>
                  <span className="text-[9px] font-mono text-purple-300 bg-[#190520] px-1.5 py-0.5 rounded">{f.code}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
