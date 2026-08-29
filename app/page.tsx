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
      description: "توثيق الفحوصات الإشعاعية، السن، الطول، الوزن، حساب الجرعة التراكمية وطباعة النموذج الرسمي.",
    },
    {
      id: "edu",
      title: "نموذج التثقيف الصحي للمريض والأسرة",
      title_en: "Patient & Family Health Education Form",
      code: "TRC.MRS",
      href: "/forms/patient-education",
      icon: HeartPulse,
      description: "تقييم الاحتياجات التعليمية، عوائق التثقيف، تحضير الفحص، مخاطر الأشعة والصبغة، ومخاطر السقوط.",
    },
    {
      id: "fall_screen",
      title: "المسح (الفحص المبدئي) لخطر السقوط",
      title_en: "Fall Risk Initial Screening",
      code: "TRC.MRS",
      href: "/forms/fall-risk-screening",
      icon: ShieldAlert,
      description: "الفحص المبدئي السريع لعدم الاتزان، استخدام الأجهزة المساعدة، إعاقات، وتطبيق شارة F والكرسي المتحرك.",
    },
    {
      id: "fall_adult",
      title: "تقييم مخاطر السقوط للكبار (Hendrich II)",
      title_en: "Hendrich II Adult Fall Risk Assessment",
      code: "TRC-ICD",
      href: "/forms/fall-risk-adult",
      icon: ShieldAlert,
      description: "مقياس هندريش 2 الدقيق: اختبار النهوض من الكرسي، الأدوية، الارتباك، وحساب درجات الخطر آلياً.",
    },
    {
      id: "fall_ped",
      title: "مقياس مخاطر سقوط الأطفال (Humpty Dumpty)",
      title_en: "Humpty Dumpty Pediatric Fall Scale",
      code: "TRC.ICD",
      href: "/forms/fall-risk-pediatric",
      icon: Baby,
      description: "تقييم سقوط الأطفال حسب السن، التشخيص، الأدوية، الإدراك، وجدول متابعة التمريض على مدار 24 ساعة.",
    },
    {
      id: "assessment",
      title: "نموذج تقييم المريض الشامل",
      title_en: "Comprehensive Patient Assessment Form",
      code: "TRC-ICD",
      href: "/forms/patient-assessment",
      icon: ClipboardCheck,
      description: "الفحص السريري الكامل، العلامات الحيوية، فحص الحمل، التاريخ الطبي، نتائج المعمل، والوصلات الوريدية.",
    },
    {
      id: "transfer",
      title: "نموذج نقل المريض (RSTP Score)",
      title_en: "Patient Transfer Form (RSTP)",
      code: "TRC.ACT",
      href: "/forms/patient-transfer",
      icon: Ambulance,
      description: "حساب معدل الخطر عند نقل المريض (RSTP) وتحديد وسيلة النقل وطاقم التمريض والأطباء المطلوب آلياً.",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner with Tiba Scan Official Brand */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#2c0b36] via-[#481454] to-[#2c0b36] text-white p-6 sm:p-10 rounded-3xl shadow-xl border border-purple-900/50">
        <div className="relative z-10 max-w-2xl space-y-4">
          
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white p-1 shadow-lg border border-purple-200/40 flex items-center justify-center shrink-0">
              <img
                src="/tiba-scan.jpg"
                alt="Tiba Scan"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                مركز طيبة سكان للأشعة
              </h1>
              <p className="text-xs text-purple-300/90 font-mono">Tiba Scan Radiology Center • الدقة والخبرة في مكان واحد</p>
            </div>
          </div>

          <p className="text-purple-100/90 text-xs sm:text-sm leading-relaxed">
            منظومة إلكترونية موحدة لإدخال وتوثيق وحفظ وطباعة النماذج والمستندات الطبية الرسمية للمرضى، مع حساب درجات المخاطر آلياً وفقاً لأعلى معايير الجودة والاعتماد.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/submissions"
              className="inline-flex items-center gap-2 bg-[#7a2088] hover:bg-[#681974] text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-lg shadow-purple-950/50 border border-purple-400/30"
            >
              <Database className="w-4 h-4" />
              <span>استعراض كافة النماذج المسجلة</span>
            </Link>

            <Link
              href="/patients"
              className="inline-flex items-center gap-2 bg-purple-950/80 hover:bg-purple-900/80 text-white border border-purple-700/50 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all"
            >
              <Users className="w-4 h-4 text-purple-300" />
              <span>سجل المرضى الشامل</span>
            </Link>
          </div>
        </div>

        {/* Decorative Background Icon */}
        <Activity className="absolute -left-10 -bottom-10 w-80 h-80 text-white/5 pointer-events-none" />
      </div>

      {/* KPI Stats Section - Only 2 Primary Cards in Tiba Scan Colors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-xs border border-purple-100 flex items-center justify-between hover:border-purple-300 transition-all hover:shadow-md group">
          <div>
            <p className="text-xs font-bold text-purple-900/60 mb-1">إجمالي النماذج المسجلة</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-[#481454]">{stats.submissionsCount}</h3>
          </div>
          <div className="p-4 bg-purple-50 text-[#621c6f] rounded-2xl border border-purple-100 group-hover:scale-105 transition-transform">
            <Database className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-xs border border-purple-100 flex items-center justify-between hover:border-purple-300 transition-all hover:shadow-md group">
          <div>
            <p className="text-xs font-bold text-purple-900/60 mb-1">المرضى المسجلين</p>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-[#481454]">{stats.patientsCount}</h3>
          </div>
          <div className="p-4 bg-purple-50 text-[#621c6f] rounded-2xl border border-purple-100 group-hover:scale-105 transition-transform">
            <Users className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* ALL 7 MEDICAL FORMS CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-6 bg-[#621c6f] rounded-full inline-block"></span>
              <span>النماذج الطبية المعتمدة (7 مستندات)</span>
            </h2>
            <p className="text-xs text-slate-500 mr-4">اختر النموذج المطلوب لبدء إدخال البيانات والتوثيق والطباعة</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {formsList.map((form) => {
            const Icon = form.icon;
            return (
              <div
                key={form.id}
                className="bg-white p-6 rounded-3xl shadow-xs border border-purple-100/80 hover:border-purple-300 transition-all flex flex-col justify-between space-y-4 hover:shadow-md hover:shadow-purple-900/5 group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="p-3 rounded-2xl border bg-purple-50/80 text-[#621c6f] border-purple-100 group-hover:bg-[#621c6f] group-hover:text-white transition-all duration-200">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded border border-purple-200 bg-purple-50/60 text-[#481454]">
                      {form.code}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-[#5c1d6b] transition-colors">{form.title}</h3>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5">{form.title_en}</p>
                  </div>

                  <p className="text-slate-600 text-xs leading-relaxed">{form.description}</p>
                </div>

                <Link
                  href={form.href}
                  className="inline-flex items-center justify-between w-full text-white font-bold px-4 py-2.5 rounded-xl transition-all text-xs shadow-xs bg-[#621c6f] hover:bg-[#4f1659] shadow-purple-900/20"
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
