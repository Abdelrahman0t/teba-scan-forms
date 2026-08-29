"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formsDropdownOpen, setFormsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setFormsDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFormsDropdownOpen(false);
      }
    }
    if (formsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [formsDropdownOpen]);

  // Close dropdown automatically on navigation
  useEffect(() => {
    setFormsDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  const formRoutes = [
    { href: "/forms/radiation-exposure", label: "تسجيل جرعات الأشعة", code: "TRC.MRS", icon: Activity, color: "text-sky-400" },
    { href: "/forms/patient-education", label: "التثقيف الصحي للأسرة", code: "TRC.MRS", icon: HeartPulse, color: "text-emerald-400" },
    { href: "/forms/fall-risk-screening", label: "المسح المبدئي لخطر السقوط", code: "TRC.MRS", icon: ShieldAlert, color: "text-amber-400" },
    { href: "/forms/fall-risk-adult", label: "مخاطر السقوط للكبار (Hendrich II)", code: "TRC-ICD", icon: ShieldAlert, color: "text-rose-400" },
    { href: "/forms/fall-risk-pediatric", label: "مخاطر السقوط أطفال (Humpty Dumpty)", code: "TRC.ICD", icon: Baby, color: "text-sky-400" },
    { href: "/forms/patient-assessment", label: "نموذج تقييم المريض الشامل", code: "TRC-ICD", icon: ClipboardCheck, color: "text-indigo-400" },
    { href: "/forms/patient-transfer", label: "نموذج نقل المريض (RSTP)", code: "TRC.ACT", icon: Ambulance, color: "text-blue-400" },
  ];

  return (
    <header className="bg-slate-900 text-white shadow-md no-print sticky top-0 z-50 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo Brand */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center font-black text-white text-xs tracking-wider">
              TIBA
            </div>
            <div>
              <span className="text-sm font-extrabold tracking-tight block">مركز طيبة سكان للأشعة</span>
              <span className="text-[10px] text-slate-400 block -mt-1 font-mono">Tiba Scan Radiology Center</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-2 space-x-reverse">
            <Link
              href="/"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                pathname === "/"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Home className="w-4 h-4" />
              <span>الرئيسية</span>
            </Link>

            {/* Forms Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setFormsDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                  pathname.startsWith("/forms") || formsDropdownOpen
                    ? "bg-slate-800 text-sky-400 border border-slate-700 shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>النماذج الطبية الرسمية (7)</span>
                <ChevronDown className={`w-3.5 h-3.5 mt-0.5 transition-transform duration-200 ${formsDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Popup Panel */}
              {formsDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span>قائمة النماذج والمستندات الطبية المعتمدة</span>
                    <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-sky-400 font-mono">7 نماذج</span>
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
                            isActive
                              ? "bg-sky-600 text-white shadow-xs"
                              : "hover:bg-slate-800 text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isActive ? "text-white" : f.color}`} />
                            <span className="text-xs font-bold">{f.label}</span>
                          </div>
                          <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                            isActive ? "bg-sky-700 text-white" : "bg-slate-950 text-slate-400"
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

            {/* Submissions Link */}
            <Link
              href="/submissions"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                pathname === "/submissions"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Database className="w-4 h-4" />
              <span>كافة النماذج المسجلة</span>
            </Link>

            {/* Patients Registry Link */}
            <Link
              href="/patients"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                pathname === "/patients"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>سجل المرضى</span>
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none transition-colors"
              aria-label="القائمة الرئيسية"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-sky-400" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-t border-slate-800 px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                pathname === "/" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-900"
              }`}
            >
              <Home className="w-4 h-4 text-sky-400" />
              <span>الرئيسية</span>
            </Link>

            <Link
              href="/submissions"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                pathname === "/submissions" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-900"
              }`}
            >
              <Database className="w-4 h-4 text-sky-400" />
              <span>كافة النماذج المسجلة</span>
            </Link>

            <Link
              href="/patients"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                pathname === "/patients" ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-900"
              }`}
            >
              <Users className="w-4 h-4 text-indigo-400" />
              <span>سجل المرضى الشامل</span>
            </Link>
          </div>

          <div className="border-t border-slate-800 pt-2 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 px-2 block">النماذج الطبية الرسمية:</span>
            {formRoutes.map((f) => {
              const Icon = f.icon;
              const isActive = pathname === f.href;
              return (
                <Link
                  key={f.href}
                  href={f.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-sky-400" />
                    <span>{f.label}</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 bg-slate-900 px-1 rounded">{f.code}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
