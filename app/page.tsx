"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser, getRoleLabel, getRoleBadgeClass, UserRole } from "@/lib/supabase/auth";
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
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  PenTool,
  Sparkles,
} from "lucide-react";
import { getFormStatusInfo } from "@/lib/formStatus";
import { useFormSync } from "@/lib/syncEvents";
import SubmissionDetailModal from "@/components/submissions/SubmissionDetailModal";

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile, role, status, isAdmin, loading } = useUser();

  const [stats, setStats] = useState({
    totalSubmissions: 0,
    todaySubmissions: 0,
    patientsCount: 0,
    pendingMyRole: 0,
  });

  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  // If user is pending, redirect them to /pending. If admission, redirect to /admission
  useEffect(() => {
    if (!loading && user && !isAdmin) {
      if (status === "pending") {
        router.push("/pending");
      } else if (role === "admission") {
        router.push("/admission");
      }
    }
  }, [loading, user, isAdmin, status, role, router]);

  useEffect(() => {
    loadDashboardData();
  }, [role, isAdmin]);

  useFormSync(() => {
    loadDashboardData();
  });

  async function loadDashboardData() {
    try {
      const todayStr = new Date().toISOString().split("T")[0];

      const [
        radsRes,
        edusRes,
        fallScreenRes,
        fallAdultRes,
        fallPedRes,
        assessRes,
        transRes,
        patientsRes,
      ] = await Promise.all([
        supabase.from("radiation_exposure_logs").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("health_education_assessments").select("*, health_education_topic_entries(*)").order("created_at", { ascending: false }).limit(50),
        supabase.from("fall_risk_screenings").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("fall_risk_adult_assessments").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("fall_risk_pediatric_assessments").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("patient_assessments").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("patient_transfers").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("patients").select("id, full_name, mrn, age, gender").limit(200),
      ]);

      const patientMap = new Map((patientsRes.data || []).map((p: any) => [p.id, p]));

      function formatItem(item: any, formType: string, formTypeName: string, color: string, editUrl: string) {
        const p = item.patient_id ? patientMap.get(item.patient_id) : null;
        return {
          ...item,
          formType,
          formTypeName,
          color,
          editUrl: `${editUrl}?editId=${item.id}`,
          resolvedPatientName: item.patient_name || item.full_name || p?.full_name || "مريض غير مسجل",
          resolvedMrn: item.mrn || p?.mrn || "-",
          resolvedAge: item.age ?? p?.age ?? "-",
          resolvedGender: item.gender || p?.gender || "-",
        };
      }

      const allRecent: any[] = [
        ...(radsRes.data || []).map((r) => formatItem(r, "radiation", "جرعات الأشعة", "text-purple-600 bg-purple-50", "/forms/radiation-exposure")),
        ...(edusRes.data || []).map((e) => formatItem(e, "education", "تثقيف الأسرة", "text-rose-600 bg-rose-50", "/forms/patient-education")),
        ...(fallScreenRes.data || []).map((fs) => formatItem(fs, "fall_screen", "مسح السقوط", "text-amber-600 bg-amber-50", "/forms/fall-risk-screening")),
        ...(fallAdultRes.data || []).map((fa) => formatItem(fa, "fall_adult", "سقوط كبار", "text-orange-600 bg-orange-50", "/forms/fall-risk-adult")),
        ...(fallPedRes.data || []).map((fp) => formatItem(fp, "fall_ped", "سقوط أطفال", "text-cyan-600 bg-cyan-50", "/forms/fall-risk-pediatric")),
        ...(assessRes.data || []).map((a) => formatItem(a, "assessment", "تقييم المريض", "text-teal-600 bg-teal-50", "/forms/patient-assessment")),
        ...(transRes.data || []).map((t) => formatItem(t, "transfer", "نقل المريض", "text-sky-600 bg-sky-50", "/forms/patient-transfer")),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Calculate total & today
      const todayCount = allRecent.filter((item) => {
        const createdDate = item.created_at ? new Date(item.created_at).toISOString().split("T")[0] : "";
        return createdDate === todayStr;
      }).length;

      const myPending = allRecent.filter((item) => {
        const s = getFormStatusInfo(item);
        return !s.isComplete && (isAdmin || (role && (s.missingRoles as string[]).includes(role)));
      }).length;

      setStats({
        totalSubmissions: allRecent.length,
        todaySubmissions: todayCount,
        patientsCount: patientsRes.data?.length || 0,
        pendingMyRole: myPending,
      });

      setRecentActivities(allRecent.slice(0, 6));
    } catch (err) {
      console.error("Dashboard stats error:", err);
    }
  }

  const formsList = [
    {
      id: "fall_screen",
      title: "1. مسح مخاطر السقوط (الفحص المبدئي)",
      title_en: "Fall Risk Initial Screening",
      code: "TRC.MRS",
      href: "/forms/fall-risk-screening",
      icon: ShieldAlert,
      description: "الفحص المبدئي السريع لعدم الاتزان، استخدام الأجهزة المساعدة، إعاقات، وتطبيق شارة F والكرسي المتحرك.",
      roles: ["nurse"] as UserRole[],
    },
    {
      id: "assessment",
      title: "2. تقييم المريض (التقييم الشامل)",
      title_en: "Comprehensive Patient Assessment Form",
      code: "TRC-ICD",
      href: "/forms/patient-assessment",
      icon: ClipboardCheck,
      description: "الفحص السريري الكامل، العلامات الحيوية، فحص الحمل، التاريخ الطبي، نتائج المعمل، والوصلات الوريدية.",
      roles: ["nurse", "technician", "radiologist"] as UserRole[],
    },
    {
      id: "fall_adult",
      title: "3. تقييم مخاطر السقوط كبار (Hendrich II)",
      title_en: "Hendrich II Adult Fall Risk Assessment",
      code: "TRC-ICD",
      href: "/forms/fall-risk-adult",
      icon: ShieldAlert,
      description: "مقياس هندريش 2 الدقيق: اختبار النهوض من الكرسي، الأدوية، الارتباك، وحساب درجات الخطر آلياً.",
      roles: ["nurse"] as UserRole[],
    },
    {
      id: "fall_ped",
      title: "4. تقييم مخاطر السقوط اطفال (Humpty Dumpty)",
      title_en: "Humpty Dumpty Pediatric Fall Scale",
      code: "TRC.ICD",
      href: "/forms/fall-risk-pediatric",
      icon: Baby,
      description: "تقييم سقوط الأطفال حسب السن، التشخيص، الأدوية، الإدراك، وجدول متابعة التمريض على مدار 24 ساعة.",
      roles: ["nurse"] as UserRole[],
    },
    {
      id: "transfer",
      title: "5. نموذج نقل المريض (RSTP)",
      title_en: "Patient Transfer Form (RSTP)",
      code: "TRC.ACT",
      href: "/forms/patient-transfer",
      icon: Ambulance,
      description: "حساب معدل الخطر عند نقل المريض (RSTP) وتحديد وسيلة النقل وطاقم التمريض والأطباء المطلوب آلياً.",
      roles: ["radiologist", "nurse"] as UserRole[],
    },
    {
      id: "edu",
      title: "6. نموذج التقييم الصحي (التثقيف للأسرة)",
      title_en: "Patient & Family Health Assessment & Education",
      code: "TRC.MRS",
      href: "/forms/patient-education",
      icon: HeartPulse,
      description: "تقييم الاحتياجات التعليمية، عوائق التثقيف، تحضير الفحص، مخاطر الأشعة والصبغة، ومخاطر السقوط.",
      roles: ["nurse", "technician"] as UserRole[],
    },
    {
      id: "rad",
      title: "7. حساب جرعات الأشعة",
      title_en: "Radiation Exposure & Dose Calculation Form",
      code: "TRC.MRS",
      href: "/forms/radiation-exposure",
      icon: Activity,
      description: "توثيق الفحوصات الإشعاعية، السن، الطول، الوزن، حساب الجرعة التراكمية وطباعة النموذج الرسمي.",
      roles: ["technician"] as UserRole[],
    },
  ];

  // Filter visible forms based on user's role (admin sees all)
  const visibleForms = isAdmin
    ? formsList
    : role
    ? formsList.filter((f) => f.roles.includes(role))
    : formsList;

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner with Tiba Scan Official Brand */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#2c0b36] via-[#481454] to-[#2c0b36] text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-purple-900/50">
        <div className="relative z-10 max-w-3xl space-y-4">
          
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white p-1 shadow-lg border border-purple-200/40 flex items-center justify-center shrink-0">
              <img
                src="/tiba-scan.jpg"
                alt="Tiba Scan"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  مركز طيبة سكان للأشعة
                </h1>
                {role && (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getRoleBadgeClass(role)}`}>
                    {getRoleLabel(role)}
                  </span>
                )}
              </div>
              <p className="text-xs text-purple-300/90 font-mono">Tiba Scan Radiology Center • بيئة العمل الطبية والسريرية</p>
            </div>
          </div>

          <p className="text-purple-100/90 text-xs sm:text-sm leading-relaxed">
            منظومة إلكترونية موحدة ومترابطة لإدارة وتوثيق النماذج الطبية السبعة، حساب مؤشرات المخاطر آلياً، ومتابعة الملف الشامل لكل مريض (Patient 360) في الوقت الفعلي.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/patients"
              className="inline-flex items-center gap-2 bg-white text-[#481454] hover:bg-purple-50 px-4 py-2 rounded-xl font-extrabold text-xs transition-all shadow-md"
            >
              <Users className="w-4 h-4 text-[#481454]" />
              <span>سجل المرضى الشامل</span>
            </Link>

            <Link
              href="/submissions"
              className="inline-flex items-center gap-2 bg-[#7a2088] hover:bg-[#681974] text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md border border-purple-400/30"
            >
              <Database className="w-4 h-4" />
              <span>السجلات الطبية الموثقة</span>
            </Link>
          </div>
        </div>

        {/* Decorative Icon */}
        <Activity className="absolute -left-10 -bottom-10 w-72 h-72 text-white/5 pointer-events-none" />
      </div>

      {/* KPI Stats Section - Shift Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-purple-100 hover:border-purple-300 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500">إجمالي المرضى</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#621c6f] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-[#481454] font-mono">{stats.patientsCount}</h3>
          <span className="text-[10px] text-slate-400 block mt-1">ملف مسجل بالمنظومة</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-purple-100 hover:border-purple-300 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500">سجلات النماذج</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 font-mono">{stats.totalSubmissions}</h3>
          <span className="text-[10px] text-slate-400 block mt-1">عبر كافة النماذج السبعة</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-purple-100 hover:border-purple-300 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500">توثيقات اليوم</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-700 font-mono">{stats.todaySubmissions}</h3>
          <span className="text-[10px] text-slate-400 block mt-1">خلال الوردية الحالية</span>
        </div>

        <div className={`p-5 rounded-2xl shadow-xs border transition-all ${
          stats.pendingMyRole > 0
            ? "bg-amber-50/60 border-amber-300"
            : "bg-white border-purple-100"
        }`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-amber-900">بانتظار دورك</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-700 font-mono">{stats.pendingMyRole}</h3>
          <span className="text-[10px] text-amber-900/70 block mt-1">
            {stats.pendingMyRole > 0 ? "يتطلب توثيقك واستكمالك" : "كافة مهامك مكتملة ✓"}
          </span>
        </div>
      </div>

      {/* Live Recent Activity Bar */}
      {recentActivities.length > 0 && (
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-purple-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#621c6f]" />
              <h2 className="text-sm font-bold text-slate-900">أحدث النشاطات والتوثيقات السريرية بالمركز</h2>
            </div>
            <Link href="/submissions" className="text-xs text-[#621c6f] hover:underline font-bold">
              عرض كافة السجلات ({stats.totalSubmissions}) ←
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {recentActivities.map((act, idx) => {
              const statusInfo = getFormStatusInfo(act);
              const isMyPartPending = !statusInfo.isComplete && (
                isAdmin || (role && (statusInfo.missingRoles as string[]).includes(role))
              );

              return (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 hover:bg-white hover:border-purple-200 transition-all flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${act.color}`}>
                        {act.formTypeName}
                      </span>
                      {statusInfo.isComplete ? (
                        <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>مكتمل</span>
                        </span>
                      ) : (
                        <span className="text-[9px] text-amber-700 font-bold">
                          {statusInfo.badgeLabel}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-xs text-slate-900 truncate">
                      {act.resolvedPatientName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      MRN: {act.resolvedMrn}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isMyPartPending && (
                      <a
                        href={act.editUrl}
                        className="p-1.5 bg-[#621c6f] hover:bg-[#481454] text-white rounded-lg text-[10px] font-bold"
                        title="استكمال دورك"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => setSelectedSubmission(act)}
                      className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold"
                      title="عرض التفاصيل"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MEDICAL FORMS CARDS - Filtered by role */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 bg-[#621c6f] rounded-full inline-block"></span>
              <h2 className="text-base font-extrabold text-slate-900">
                {isAdmin
                  ? "النماذج الطبية المعتمدة (كافة النماذج - 7 مستندات)"
                  : `النماذج المتاحة لدورك الوظيفي (${visibleForms.length} نماذج)`}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mr-4 mt-0.5">
              {isAdmin
                ? "بصفتك مديراً للنظام، تملك صلاحية الوصول والتوثيق في كافة النماذج."
                : "تظهر أدناه النماذج الطبية المصرح لك بالوصول إليها وتوثيقها وفقاً لاختصاصك الوظيفي."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleForms.map((form) => {
            const Icon = form.icon;
            return (
              <div
                key={form.id}
                className="bg-white p-5 rounded-3xl shadow-xs border border-purple-100/80 hover:border-purple-300 transition-all flex flex-col justify-between space-y-4 hover:shadow-md hover:shadow-purple-900/5 group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="p-3 rounded-2xl border bg-purple-50/80 text-[#621c6f] border-purple-100 group-hover:bg-[#621c6f] group-hover:text-white transition-all duration-200">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded border border-purple-200 bg-purple-50/60 text-[#481454]">
                      {form.code}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-[#5c1d6b] transition-colors">{form.title}</h3>
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5 font-mono">{form.title_en}</p>
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

      {/* Quick Modal Preview */}
      <SubmissionDetailModal
        submission={selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        isAdmin={isAdmin}
        role={role}
      />
    </div>
  );
}
