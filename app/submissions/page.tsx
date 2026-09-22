"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/auth";
import {
  Activity,
  HeartPulse,
  Eye,
  ShieldAlert,
  Baby,
  ClipboardCheck,
  Ambulance,
  CheckCircle2,
  AlertCircle,
  PenTool,
  Search,
} from "lucide-react";
import { getMrnSearchVariants } from "@/lib/numberUtils";
import { useFormSync } from "@/lib/syncEvents";
import { getFormStatusInfo, FormStatusInfo } from "@/lib/formStatus";
import SubmissionDetailModal from "@/components/submissions/SubmissionDetailModal";
import SubmissionPrintLayout from "@/components/submissions/SubmissionPrintLayout";

export { getFormStatusInfo };
export type { FormStatusInfo };

export default function SubmissionsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { role, isAdmin, loading: authLoading } = useUser();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("month");

  // Protect page: admission role has no access to clinical records
  useEffect(() => {
    if (!authLoading && role === "admission" && !isAdmin) {
      router.push("/admission");
    }
  }, [role, isAdmin, authLoading, router]);

  // Submissions Data States for all 7 forms
  const [radLogs, setRadLogs] = useState<any[]>([]);
  const [eduLogs, setEduLogs] = useState<any[]>([]);
  const [fallScreenLogs, setFallScreenLogs] = useState<any[]>([]);
  const [fallAdultLogs, setFallAdultLogs] = useState<any[]>([]);
  const [fallPedLogs, setFallPedLogs] = useState<any[]>([]);
  const [assessmentLogs, setAssessmentLogs] = useState<any[]>([]);
  const [transferLogs, setTransferLogs] = useState<any[]>([]);

  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  useEffect(() => {
    fetchSubmissions(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  // Real-time live synchronization (No Refresh Needed)
  useFormSync(() => {
    fetchSubmissions(true);
  });

  /** Returns the ISO start timestamp for the current date range, or null for "all time". */
  function getStartDate(range: "today" | "week" | "month" | "all"): string | null {
    if (range === "all") return null;
    const now = new Date();
    if (range === "today") {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    }
    const d = new Date(now);
    d.setDate(d.getDate() - (range === "week" ? 7 : 30));
    return d.toISOString();
  }

  async function fetchSubmissions(silent = false) {
    if (!silent) setLoading(true);
    const startDate = getStartDate(dateRange);

    /** Builds a query with a server-side date filter + row limit applied. */
    function buildQuery(table: string, selectStr: string): Promise<{ data: any[] | null; error: any }> {
      let q: any = supabase
        .from(table as any)
        .select(selectStr)
        .order("created_at", { ascending: false })
        .limit(100);
      if (startDate) q = q.gte("created_at", startDate);
      return q;
    }

    try {
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
        buildQuery("radiation_exposure_logs", "*"),
        buildQuery("health_education_assessments", "*, health_education_topic_entries(*)"),
        buildQuery("fall_risk_screenings", "*"),
        buildQuery("fall_risk_adult_assessments", "*"),
        buildQuery("fall_risk_pediatric_assessments", "*"),
        buildQuery("patient_assessments", "*"),
        buildQuery("patient_transfers", "*"),
        // Patients table is tiny — just IDs/names for lookup. No date filter needed.
        supabase.from("patients").select("id, full_name, mrn, age, gender"),
      ]);

      const patientMap = new Map((patientsRes.data || []).map((p: any) => [p.id, p]));

      function resolvePatient(item: any, formType: string, formTypeName: string, headerCode: string, editUrl: string, icon: any, color: string) {
        const p = item.patient_id ? patientMap.get(item.patient_id) : null;
        return {
          ...item,
          formType,
          formTypeName,
          headerCode,
          editUrl: `${editUrl}?editId=${item.id}`,
          icon,
          color,
          resolvedPatientName: item.patient_name || item.full_name || p?.full_name || "مريض غير مسجل بالاسم",
          resolvedMrn: item.mrn || p?.mrn || "بدون ملف",
          resolvedGender: item.gender || p?.gender || "-",
          resolvedAge: item.age !== undefined && item.age !== null ? item.age : p?.age || "-",
        };
      }

      setRadLogs((radsRes.data || []).map((r: any) => resolvePatient(r, "radiation", "تسجيل جرعات الأشعة", "TRC.MRS", "/forms/radiation-exposure", Activity, "text-purple-600 bg-purple-50")));
      setEduLogs((edusRes.data || []).map((e: any) => resolvePatient(e, "education", "التثقيف الصحي للأسرة", "TRC.MRS", "/forms/patient-education", HeartPulse, "text-rose-600 bg-rose-50")));
      setFallScreenLogs((fallScreenRes.data || []).map((fs: any) => resolvePatient(fs, "fall_screen", "المسح المبدئي لخطر السقوط", "TRC.MRS", "/forms/fall-risk-screening", ShieldAlert, "text-amber-600 bg-amber-50")));
      setFallAdultLogs((fallAdultRes.data || []).map((fa: any) => {
        const isHighRisk = Boolean(
          fa.is_high_risk ||
          fa.bed_ridden ||
          fa.physical_disability ||
          fa.mental_disability ||
          fa.anesthesia_first_24h ||
          fa.direct_factors?.bed_ridden ||
          fa.direct_factors?.physical_disability ||
          fa.direct_factors?.mental_disability ||
          fa.direct_factors?.anesthesia_first_24h ||
          (fa.total_score >= 5)
        );
        const resolvedRiskLevel = fa.risk_level || (isHighRisk ? "عالية المخاطر" : "منخفض المخاطر");
        return resolvePatient(
          { ...fa, risk_level: resolvedRiskLevel },
          "fall_adult",
          "مخاطر السقوط للكبار (Hendrich II)",
          "TRC-ICD",
          "/forms/fall-risk-adult",
          ShieldAlert,
          "text-orange-600 bg-orange-50"
        );
      }));
      setFallPedLogs((fallPedRes.data || []).map((fp: any) => {
        const isHighRisk = Boolean(
          fp.is_high_risk ||
          fp.bed_ridden ||
          fp.critical_unit ||
          fp.anesthesia_48h ||
          fp.mental_disability ||
          fp.neonate ||
          fp.physical_disability ||
          (fp.total_score >= 12)
        );
        const resolvedRiskLevel = fp.risk_level || (isHighRisk ? "عالية المخاطر" : ((fp.total_score || 0) >= 7 ? "متوسط المخاطر" : "منخفض المخاطر"));
        return resolvePatient(
          { ...fp, risk_level: resolvedRiskLevel },
          "fall_ped",
          "مقياس مخاطر سقوط الأطفال (Humpty Dumpty)",
          "TRC.ICD",
          "/forms/fall-risk-pediatric",
          Baby,
          "text-cyan-600 bg-cyan-50"
        );
      }));
      setAssessmentLogs((assessRes.data || []).map((a: any) => {
        const plans = Array.isArray(a.plan_of_care) ? a.plan_of_care : [];
        const techPlan = plans.find((p: any) =>
          !p?.responsible?.some((r: string) => r?.includes("طبيب") || r?.includes("أخصائي")) &&
          (
            p?.responsible?.includes("فني الأشعة") ||
            p?.problem?.includes("السلامة والجرعة") ||
            p?.interventions?.some((i: string) => i?.includes("جرعة الإشعاع") || i?.includes("دليل الاجراءات"))
          )
        );
        const docPlan = plans.find((p: any) =>
          p?.responsible?.includes("أخصائي الأشعة") ||
          p?.responsible?.includes("طبيب الأشعة") ||
          p?.interventions?.some((i: string) => i?.includes("فوائد ومخاطر")) ||
          (p?.problem?.includes("التصوير") && !p?.problem?.includes("السلامة والجرعة"))
        );
        const resolvedDocSig = a.physician_signature || docPlan?.confirmed_by || null;
        const resolvedTechSig = techPlan?.confirmed_by || (a.tech_signature && a.tech_signature !== resolvedDocSig ? a.tech_signature : null) || null;
        return resolvePatient({ ...a, physician_signature: resolvedDocSig, tech_signature: resolvedTechSig }, "assessment", "نموذج تقييم المريض الشامل", "TRC-ICD", "/forms/patient-assessment", ClipboardCheck, "text-teal-600 bg-teal-50");
      }));
      setTransferLogs((transRes.data || []).map((t: any) => resolvePatient(t, "transfer", "نموذج نقل المريض (RSTP)", "TRC.ACT", "/forms/patient-transfer", Ambulance, "text-sky-600 bg-sky-50")));
    } catch (err) {
      console.error("Error fetching submissions:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const [statusFilter, setStatusFilter] = useState<"all" | "pending_my_role" | "incomplete" | "complete">("all");

  const allLogs = [
    ...radLogs,
    ...eduLogs,
    ...fallScreenLogs,
    ...fallAdultLogs,
    ...fallPedLogs,
    ...assessmentLogs,
    ...transferLogs,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const incompleteCount = allLogs.filter((item) => !getFormStatusInfo(item).isComplete).length;
  const completeCount = allLogs.filter((item) => getFormStatusInfo(item).isComplete).length;
  const myPendingCount = allLogs.filter((item) => {
    const s = getFormStatusInfo(item);
    return !s.isComplete && (isAdmin || (role && (s.missingRoles as string[]).includes(role)));
  }).length;

  function matchesQuery(item: any) {
    const rawQ = searchQuery.trim().toLowerCase();
    if (!rawQ) return true;
    const variants = getMrnSearchVariants(rawQ).map((v) => v.toLowerCase());

    const name = (item.resolvedPatientName || "").toLowerCase();
    const rawMrn = (item.resolvedMrn || "").toLowerCase();
    const mrnVariants = getMrnSearchVariants(rawMrn).map((v) => v.toLowerCase());
    const proc = (item.procedure_name || item.from_location || item.diagnosis || "").toLowerCase();

    const mrnMatches = variants.some((qv) =>
      mrnVariants.some((mv) => mv.includes(qv)) || rawMrn.includes(qv)
    );

    return name.includes(rawQ) || mrnMatches || proc.includes(rawQ);
  }

  const displayedList = (
    activeTab === "all"
      ? allLogs
      : activeTab === "radiation"
      ? radLogs
      : activeTab === "education"
      ? eduLogs
      : activeTab === "fall_screen"
      ? fallScreenLogs
      : activeTab === "fall_adult"
      ? fallAdultLogs
      : activeTab === "fall_ped"
      ? fallPedLogs
      : activeTab === "assessment"
      ? assessmentLogs
      : transferLogs
  )
    .filter(matchesQuery)
    .filter((item) => {
      const s = getFormStatusInfo(item);
      if (statusFilter === "pending_my_role") {
        return !s.isComplete && (isAdmin || (role && (s.missingRoles as string[]).includes(role)));
      }
      if (statusFilter === "incomplete") {
        return !s.isComplete;
      }
      if (statusFilter === "complete") {
        return s.isComplete;
      }
      return true;
    });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-purple-100 no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-sm border border-purple-200/70 flex items-center justify-center shrink-0">
            <img src="/tiba-scan.jpg" alt="Tiba Scan" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#481454]">استعراض وإدارة كافة النماذج والمستندات المحفوظة</h2>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • استعراض وطباعة تفاصيل كافة النماذج السبعة كاملة</p>
          </div>
        </div>

        {role && (
          <div className="bg-purple-50 border border-purple-200/70 px-4 py-2 rounded-2xl flex items-center gap-2.5 text-xs text-purple-950 font-bold">
            <span>{isAdmin ? "👑" : role === "nurse" ? "🟦" : role === "technician" ? "🟨" : "🟩"}</span>
            <span>
              {isAdmin ? "مسؤول النظام (Admin)" : role === "nurse" ? "تمريض (Nurse)" : role === "technician" ? "فني أشعة (Technician)" : "طبيب أشعة (Radiologist)"}
            </span>
            {myPendingCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-bounce">
                {myPendingCount} بحاجة لتوثيقك
              </span>
            )}
          </div>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="bg-white px-5 py-3.5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-wrap items-center gap-2.5 no-print">
        <span className="text-xs font-bold text-slate-500">الفترة الزمنية:</span>
        {([
          { id: "today", label: "اليوم فقط" },
          { id: "week",  label: "آخر 7 أيام" },
          { id: "month", label: "آخر 30 يوم" },
          { id: "all",   label: "كل السجلات" },
        ] as const).map((r) => (
          <button
            key={r.id}
            onClick={() => setDateRange(r.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              dateRange === r.id
                ? "bg-[#621c6f] text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            {r.label}
          </button>
        ))}
        <span className="text-[11px] text-slate-400 mr-auto">
          • عرض آخر 100 سجل لكل نوع نموذج {dateRange === "all" ? "من كل الوقت" : "ضمن الفترة المحددة"}
        </span>
      </div>

      {/* Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-purple-100 space-y-3.5 no-print">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-purple-50/70 p-1.5 rounded-2xl border border-purple-100/80 no-scrollbar">
            {[
              { id: "all", label: `الكل (${allLogs.length})` },
              { id: "fall_screen", label: `مسح السقوط (${fallScreenLogs.length})` },
              { id: "assessment", label: `تقييم المريض (${assessmentLogs.length})` },
              { id: "fall_adult", label: `سقوط كبار (${fallAdultLogs.length})` },
              { id: "fall_ped", label: `سقوط أطفال (${fallPedLogs.length})` },
              { id: "transfer", label: `نقل المريض (${transferLogs.length})` },
              { id: "radiation", label: `جرعات الأشعة (${radLogs.length})` },
              { id: "education", label: `التثقيف الصحي (${eduLogs.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[#621c6f] text-white shadow-sm"
                    : "text-purple-950/70 hover:text-[#481454] hover:bg-white/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative min-w-[240px] sm:w-72">
            <input
              type="text"
              placeholder="بحث بالاسم أو رقم الملف (MRN)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#621c6f] focus:bg-white outline-hidden transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-bold ml-1">حالة التوثيق:</span>

          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            جميع الحالات ({allLogs.length})
          </button>

          {(isAdmin || role) && myPendingCount > 0 && (
            <button
              onClick={() => setStatusFilter("pending_my_role")}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition-all flex items-center gap-1.5 ${
                statusFilter === "pending_my_role"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-amber-100/80 text-amber-900 border border-amber-300 hover:bg-amber-200/80"
              }`}
            >
              <span>⚡ بانتظار دورك</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "pending_my_role" ? "bg-white/25 text-white" : "bg-amber-500 text-white font-mono"}`}>
                {myPendingCount}
              </span>
            </button>
          )}

          <button
            onClick={() => setStatusFilter("incomplete")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === "incomplete"
                ? "bg-amber-700 text-white shadow-xs"
                : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            <span>غير مكتملة</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "incomplete" ? "bg-white/25 text-white" : "bg-amber-200 text-amber-950 font-mono"}`}>
              {incompleteCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter("complete")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === "complete"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
            }`}
          >
            <span>مكتملة</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "complete" ? "bg-white/25 text-white" : "bg-emerald-200 text-emerald-950 font-mono"}`}>
              {completeCount}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">جاري تحميل سجلات النماذج...</div>
      ) : displayedList.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
          لا توجد نماذج مسجلة تطابق التصفية الحالية.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden no-print">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">نوع النموذج</th>
                  <th className="p-3">اسم المريض رباعي</th>
                  <th className="p-3">رقم الملف (MRN)</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3">التفاصيل / النتيجة</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedList.map((item, idx) => {
                  const Icon = item.icon || Activity;
                  const statusInfo = getFormStatusInfo(item);
                  const isMyPartPending = !statusInfo.isComplete && (
                    isAdmin || (role && (statusInfo.missingRoles as string[]).includes(role))
                  );

                  return (
                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isMyPartPending ? "bg-amber-50/20" : ""}`}>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${item.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{item.formTypeName}</span>
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{item.resolvedPatientName}</td>
                      <td className="p-3 font-mono font-semibold text-slate-600">{item.resolvedMrn}</td>
                      <td className="p-3 text-slate-500 font-mono">
                        {item.exposure_date || item.screening_date || item.assessment_date || item.transfer_date || item.visit_date || new Date(item.created_at).toISOString().split("T")[0]}
                      </td>

                      {/* Status Badge */}
                      <td className="p-3 text-center">
                        {statusInfo.isComplete ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold whitespace-nowrap shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>مكتمل</span>
                          </span>
                        ) : (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-bold whitespace-nowrap shadow-2xs">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>{statusInfo.badgeLabel}</span>
                            </span>
                            {statusInfo.missingLabels.length > 0 && (
                              <span className="text-[10px] text-amber-900/80 font-medium">
                                بانتظار: {statusInfo.missingLabels.join(" + ")}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Details Column */}
                      <td className="p-3 text-slate-600 max-w-xs truncate">
                        {item.formType === "radiation" && `${item.exam_type || "-"} | DLP: ${item.dlp || "-"} | CTDIvol: ${item.ctdivol || "-"}`}
                        {item.formType === "education" && (item.topics_discussed || "تثقيف وتوعية المريض والأسرة")}
                        {item.formType === "fall_screen" && (
                          <span>
                            النتيجة: <strong>{item.total_score} نقطة</strong> —{" "}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.risk_level === "High" ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-emerald-100 text-emerald-700"}`}>
                              {item.risk_level === "High" ? "خطر مرتفع" : "خطر منخفض"}
                            </span>
                          </span>
                        )}
                        {(item.formType === "fall_adult" || item.formType === "fall_ped") && (() => {
                          const directReasons: string[] = [];
                          const effectiveRisk = item.risk_level || (item.is_high_risk ? "عالية المخاطر" : "منخفض المخاطر");
                          if (item.formType === "fall_adult" && effectiveRisk === "عالية المخاطر") {
                            if (item.bed_ridden || item.direct_factors?.bed_ridden) directReasons.push("ملازم للفراش");
                            if (item.physical_disability || item.direct_factors?.physical_disability) directReasons.push("إعاقة جسدية");
                            if (item.mental_disability || item.direct_factors?.mental_disability) directReasons.push("إعاقة ذهنية");
                            if (item.anesthesia_first_24h || item.direct_factors?.anesthesia_first_24h) directReasons.push("تخدير حديث");
                          }
                          return (
                            <span>
                              الدرجة: <strong>{item.total_score ?? 0}</strong> —{" "}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                effectiveRisk === "عالية المخاطر"
                                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                                  : effectiveRisk === "متوسط المخاطر"
                                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              }`}>
                                {effectiveRisk}
                              </span>
                              {directReasons.length > 0 && (
                                <span className="text-[10px] text-rose-600 block mt-0.5 font-medium">
                                  ({directReasons.join(" • ")})
                                </span>
                              )}
                            </span>
                          );
                        })()}
                        {item.formType === "assessment" && `${item.procedure_name || "-"} | التشخيص: ${item.diagnosis || "-"}`}
                        {item.formType === "transfer" && `من: ${item.from_location} إلى: ${item.to_location} (${item.recommended_vehicle})`}
                      </td>

                      {/* Actions Column */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isMyPartPending ? (
                            <a
                              href={item.editUrl}
                              className="px-3 py-1.5 bg-[#621c6f] hover:bg-[#481454] text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md transition-all inline-flex items-center gap-1.5 whitespace-nowrap animate-pulse hover:animate-none"
                              title="اضغط هنا لاستكمال دورك في هذا النموذج"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              <span>استكمال دورك</span>
                            </a>
                          ) : !statusInfo.isComplete ? (
                            <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg font-medium whitespace-nowrap hidden sm:inline-block">
                              دورك مكتمل
                            </span>
                          ) : null}

                          <button
                            onClick={() => setSelectedSubmission(item)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors inline-flex items-center gap-1 text-xs"
                            title="عرض كامل تفاصيل النموذج"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>تفاصيل</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reusable Submission Detail Modal */}
      <SubmissionDetailModal
        submission={selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        isAdmin={isAdmin}
        role={role}
      />

      {/* Standardized Print Layout */}
      <SubmissionPrintLayout submission={selectedSubmission} />
    </div>
  );
}
