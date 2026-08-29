"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  HeartPulse,
  ShieldAlert,
  Baby,
  ClipboardCheck,
  Ambulance,
  Database,
  Users,
  ArrowLeft,
} from "lucide-react";

export default function Home() {
  const supabase = createClient();

  const [stats, setStats] = useState({
    submissionsCount: 0,
    patientsCount: 0,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const [sRes, pRes] = await Promise.all([
          supabase.from("form_submissions").select("*", { count: "exact", head: true }),
          supabase.from("patients").select("*", { count: "exact", head: true }),
        ]);

        setStats({
          submissionsCount: sRes.count || 0,
          patientsCount: pRes.count || 0,
        });
      } catch (err) {}
    }

    loadStats();
  }, []);

  const formsList = [
    {
      id: "rad",
      title: "نموذج تسجيل التعرض لجرعات الأشعة",
      title_en: "Radiation Exposure Registration Form",
      code: "TRC.MRS",
      href: "/forms/radiation-exposure",
      icon: Activity,
      color: "bg-sky-50 text-sky-600 border-sky-100",
      badgeColor: "bg-sky-100 text-sky-800",
      btnColor: "bg-sky-600 hover:bg-sky-700",
      description: "توثيق الفحوصات الإشعاعية، السن، الطول، الوزن، حساب الجرعة التراكمية وطباعة النموذج الرسمي.",
    },
    {
      id: "edu",
      title: "نموذج التثقيف الصحي للمريض والأسرة",
      title_en: "Patient & Family Health Education Form",
      code: "TRC.MRS",
      href: "/forms/patient-education",
      icon: HeartPulse,
      color: "bg-emerald-50 text-emerald-600 border-emerald-100",
      badgeColor: "bg-emerald-100 text-emerald-800",
      btnColor: "bg-emerald-600 hover:bg-emerald-700",
      description: "تقييم الاحتياجات التعليمية، عوائق التثقيف، تحضير الفحص، مخاطر الأشعة والصبغة، ومخاطر السقوط.",
    },
    {
      id: "fall_screen",
      title: "المسح (الفحص المبدئي) لخطر السقوط",
      title_en: "Fall Risk Initial Screening",
      code: "TRC.MRS",
      href: "/forms/fall-risk-screening",
      icon: ShieldAlert,
      color: "bg-amber-50 text-amber-600 border-amber-100",
      badgeColor: "bg-amber-100 text-amber-800",
      btnColor: "bg-amber-500 hover:bg-amber-600",
      description: "الفحص المبدئي السريع لعدم الاتزان، استخدام الأجهزة المساعدة، إعاقات، وتطبيق شارة F والكرسي المتحرك.",
    },
    {
      id: "fall_adult",
      title: "تقييم مخاطر السقوط للكبار (Hendrich II)",
      title_en: "Hendrich II Adult Fall Risk Assessment",
      code: "TRC-ICD",
      href: "/forms/fall-risk-adult",
      icon: ShieldAlert,
      color: "bg-rose-50 text-rose-600 border-rose-100",
      badgeColor: "bg-rose-100 text-rose-800",
      btnColor: "bg-rose-600 hover:bg-rose-700",
      description: "مقياس هندريش 2 الدقيق: اختبار النهوض من الكرسي، الأدوية، الارتباك، وحساب درجات الخطر آلياً.",
    },
    {
      id: "fall_ped",
      title: "مقياس مخاطر سقوط الأطفال (Humpty Dumpty)",
      title_en: "Humpty Dumpty Pediatric Fall Scale",
      code: "TRC.ICD",
      href: "/forms/fall-risk-pediatric",
      icon: Baby,
      color: "bg-cyan-50 text-cyan-600 border-cyan-100",
      badgeColor: "bg-cyan-100 text-cyan-800",
      btnColor: "bg-cyan-600 hover:bg-cyan-700",
      description: "تقييم سقوط الأطفال حسب السن، التشخيص، الأدوية، الإدراك، وجدول متابعة التمريض على مدار 24 ساعة.",
    },
    {
      id: "assessment",
      title: "نموذج تقييم المريض الشامل",
      title_en: "Comprehensive Patient Assessment Form",
      code: "TRC-ICD",
      href: "/forms/patient-assessment",
      icon: ClipboardCheck,
      color: "bg-indigo-50 text-indigo-600 border-indigo-100",
      badgeColor: "bg-indigo-100 text-indigo-800",
      btnColor: "bg-indigo-600 hover:bg-indigo-700",
      description: "الفحص السريري الكامل، العلامات الحيوية، فحص الحمل، التاريخ الطبي، نتائج المعمل، والوصلات الوريدية.",
    },
    {
      id: "transfer",
      title: "نموذج نقل المريض (RSTP Score)",
      title_en: "Patient Transfer Form (RSTP)",
      code: "TRC.ACT",
      href: "/forms/patient-transfer",
      icon: Ambulance,
      color: "bg-blue-50 text-blue-600 border-blue-100",
      badgeColor: "bg-blue-100 text-blue-800",
      btnColor: "bg-blue-600 hover:bg-blue-700",
      description: "حساب معدل الخطر عند نقل المريض (RSTP) وتحديد وسيلة النقل وطاقم التمريض والأطباء المطلوب آلياً.",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white p-8 sm:p-12 rounded-3xl shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-semibold">
            <span>نظام النماذج والمستندات الطبية المعتمدة • 7 نماذج مطابقة للأصل</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            مركز طيبة سكان للأشعة
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            منصة إلكترونية شاملة لإدخال وحفظ وطباعة كافة النماذج والمستندات الطبية الرسمية، مع الحساب الآلي لدرجات الخطورة ومطابقة المستندات المطبوعة بنسبة 100%.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/submissions"
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-lg shadow-sky-500/20"
            >
              <Database className="w-4 h-4" />
              <span>استعراض كافة النماذج المسجلة</span>
            </Link>

            <Link
              href="/patients"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all"
            >
              <Users className="w-4 h-4" />
              <span>سجل المرضى الشامل</span>
            </Link>
          </div>
        </div>

        {/* Decorative Background Icon */}
        <Activity className="absolute -left-10 -bottom-10 w-80 h-80 text-white/5 pointer-events-none" />
      </div>

      {/* KPI Stats Section - Only 2 Primary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-200 flex items-center justify-between hover:border-sky-300 transition-all hover:shadow-md">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">إجمالي النماذج المسجلة</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900">{stats.submissionsCount}</h3>
          </div>
          <div className="p-4 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100">
            <Database className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition-all hover:shadow-md">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">المرضى المسجلين</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900">{stats.patientsCount}</h3>
          </div>
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
            <Users className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* ALL 7 MEDICAL FORMS CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">النماذج الطبية المعتمدة (7 مستندات)</h2>
            <p className="text-xs text-slate-500">اختر النموذج المطلوب لبدء إدخال البيانات والتوثيق والطباعة</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {formsList.map((form) => {
            const Icon = form.icon;
            return (
              <div
                key={form.id}
                className="bg-white p-6 rounded-3xl shadow-xs border border-slate-200 hover:border-sky-300 transition-all flex flex-col justify-between space-y-4 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-2xl border ${form.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">
                      {form.code}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">{form.title}</h3>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5">{form.title_en}</p>
                  </div>

                  <p className="text-slate-600 text-xs leading-relaxed">{form.description}</p>
                </div>

                <Link
                  href={form.href}
                  className={`inline-flex items-center justify-between w-full text-white font-bold px-4 py-2.5 rounded-xl transition-all text-xs shadow-xs ${form.btnColor}`}
                >
                  <span>فتح وتعبئة النموذج</span>
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
