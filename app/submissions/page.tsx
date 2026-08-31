"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Database,
  Search,
  Activity,
  HeartPulse,
  Printer,
  Eye,
  X,
  Trash2,
  Pencil,
  User,
  FileText,
  ShieldAlert,
  Baby,
  ClipboardCheck,
  Ambulance,
  CheckCircle2,
  Calendar,
  Clock,
  Heart,
  Stethoscope,
  Pill,
  AlertOctagon,
  Check,
  AlertCircle,
} from "lucide-react";
import { formatTime12 } from "@/lib/timeUtils";
import { getMrnSearchVariants } from "@/lib/numberUtils";

export default function SubmissionsPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    fetchSubmissions();
  }, []);

  async function fetchSubmissions() {
    setLoading(true);

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
        supabase
          .from("radiation_exposure_logs")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("health_education_assessments")
          .select("*, health_education_topic_entries(*)")
          .order("created_at", { ascending: false }),
        supabase
          .from("fall_risk_screenings")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("fall_risk_adult_assessments")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("fall_risk_pediatric_assessments")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("patient_assessments")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("patient_transfers")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("patients").select("*"),
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

      setRadLogs((radsRes.data || []).map((r) => resolvePatient(r, "radiation", "تسجيل جرعات الأشعة", "TRC.MRS", "/forms/radiation-exposure", Activity, "text-purple-600 bg-purple-50")));
      setEduLogs((edusRes.data || []).map((e) => resolvePatient(e, "education", "التثقيف الصحي للأسرة", "TRC.MRS", "/forms/patient-education", HeartPulse, "text-rose-600 bg-rose-50")));
      setFallScreenLogs((fallScreenRes.data || []).map((fs) => resolvePatient(fs, "fall_screen", "المسح المبدئي لخطر السقوط", "TRC.MRS", "/forms/fall-risk-screening", ShieldAlert, "text-amber-600 bg-amber-50")));
      setFallAdultLogs((fallAdultRes.data || []).map((fa) => resolvePatient(fa, "fall_adult", "مخاطر السقوط للكبار (Hendrich II)", "TRC-ICD", "/forms/fall-risk-adult", ShieldAlert, "text-orange-600 bg-orange-50")));
      setFallPedLogs((fallPedRes.data || []).map((fp) => resolvePatient(fp, "fall_ped", "مقياس مخاطر سقوط الأطفال (Humpty Dumpty)", "TRC.ICD", "/forms/fall-risk-pediatric", Baby, "text-cyan-600 bg-cyan-50")));
      setAssessmentLogs((assessRes.data || []).map((a) => resolvePatient(a, "assessment", "نموذج تقييم المريض الشامل", "TRC-ICD", "/forms/patient-assessment", ClipboardCheck, "text-teal-600 bg-teal-50")));
      setTransferLogs((transRes.data || []).map((t) => resolvePatient(t, "transfer", "نموذج نقل المريض (RSTP)", "TRC.ACT", "/forms/patient-transfer", Ambulance, "text-sky-600 bg-sky-50")));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRecord(item: any) {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف هذا النموذج (${item.formTypeName} - ${item.resolvedPatientName})؟`)) return;

    setDeletingId(item.id);
    let table = "";
    if (item.formType === "radiation") table = "radiation_exposure_logs";
    if (item.formType === "education") table = "health_education_assessments";
    if (item.formType === "fall_screen") table = "fall_risk_screenings";
    if (item.formType === "fall_adult") table = "fall_risk_adult_assessments";
    if (item.formType === "fall_ped") table = "fall_risk_pediatric_assessments";
    if (item.formType === "assessment") table = "patient_assessments";
    if (item.formType === "transfer") table = "patient_transfers";

    try {
      const { error } = await supabase.from(table).delete().eq("id", item.id);
      if (error) throw error;
      fetchSubmissions();
      setSelectedSubmission(null);
    } catch (err: any) {
      alert(`حدث خطأ أثناء الحذف: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  const allLogs = [
    ...radLogs,
    ...eduLogs,
    ...fallScreenLogs,
    ...fallAdultLogs,
    ...fallPedLogs,
    ...assessmentLogs,
    ...transferLogs,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
  ).filter(matchesQuery);

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
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • عرض وتعديل وطباعة تفاصيل كافة النماذج السبعة كاملة</p>
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-purple-100 space-y-4 no-print">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          {/* Tabs */}
          <div className="flex bg-purple-50/70 p-1.5 rounded-2xl self-start overflow-x-auto max-w-full gap-1 border border-purple-100/80">
            {[
              { id: "all", label: `الكل (${allLogs.length})` },
              { id: "radiation", label: `الجرعات (${radLogs.length})` },
              { id: "education", label: `التثقيف (${eduLogs.length})` },
              { id: "fall_screen", label: `مسح السقوط (${fallScreenLogs.length})` },
              { id: "fall_adult", label: `سقوط كبار (${fallAdultLogs.length})` },
              { id: "fall_ped", label: `سقوط أطفال (${fallPedLogs.length})` },
              { id: "assessment", label: `تقييم المريض (${assessmentLogs.length})` },
              { id: "transfer", label: `نقل المريض (${transferLogs.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[#621c6f] text-white shadow-xs"
                    : "text-purple-950/70 hover:text-[#621c6f] hover:bg-purple-100/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="تصفية بالاسم، رقم الملف MRN، أو الإجراء..."
              className="w-full pl-10 pr-4 py-2 border border-purple-200 rounded-xl outline-none text-xs focus:ring-2 focus:ring-[#621c6f]"
            />
            <Search className="w-4 h-4 absolute left-3 top-3 text-purple-400" />
          </div>
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
                  <th className="p-3">التفاصيل / النتيجة</th>
                  <th className="p-3 text-center">عرض كامل</th>
                  <th className="p-3 text-center">تعديل</th>
                  <th className="p-3 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedList.map((item, idx) => {
                  const Icon = item.icon || Activity;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
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
                      <td className="p-3 text-slate-700 font-medium">
                        {item.formType === "radiation" && `${item.procedure_name} (جرعة: ${item.radiation_dose} mGy)`}
                        {item.formType === "education" && `${item.procedure_name || "تثقيف عام"} (${item.education_level || "غير محدد"})`}
                        {item.formType === "fall_screen" && (item.is_high_risk ? "⚠️ عالي الخطورة (F)" : "✓ منخفض")}
                        {item.formType === "fall_adult" && `مجموع النقاط: ${item.total_score} (${item.is_high_risk ? "عالي خطورة" : "منخفض"})`}
                        {item.formType === "fall_ped" && (
                          <span className="inline-flex items-center gap-1.5">
                            <span>مجموع: {item.total_score}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.risk_level === "عالية المخاطر"
                                ? "bg-rose-100 text-rose-700 border border-rose-200"
                                : item.risk_level === "متوسط المخاطر"
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            }`}>
                              {item.risk_level}
                            </span>
                          </span>
                        )}
                        {item.formType === "assessment" && `${item.procedure_name || "-"} | التشخيص: ${item.diagnosis || "-"}`}
                        {item.formType === "transfer" && `من: ${item.from_location} إلى: ${item.to_location} (${item.recommended_vehicle})`}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedSubmission(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition-colors inline-flex items-center gap-1"
                          title="عرض كامل تفاصيل النموذج"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>تفاصيل</span>
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <Link
                          href={item.editUrl}
                          className="inline-flex p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors"
                          title="تعديل هذا النموذج"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteRecord(item)}
                          disabled={deletingId === item.id}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors disabled:opacity-40"
                          title="حذف هذا السجل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE FULL-DETAIL MODAL VIEW */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 no-print overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${selectedSubmission.color}`}>
                  {selectedSubmission.icon && <selectedSubmission.icon className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                      {selectedSubmission.formTypeName}
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {selectedSubmission.headerCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • تفاصيل النموذج الكاملة</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedSubmission(null)}
                className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Patient Header Banner */}
            <div className="bg-gradient-to-r from-[#2c0b36] via-[#481454] to-[#2c0b36] text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md border border-purple-800/50">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-white">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-300 font-semibold block">اسم المريض رباعي</span>
                  <h4 className="text-base sm:text-lg font-extrabold text-white">
                    {selectedSubmission.resolvedPatientName}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                    <span>الجنس: {selectedSubmission.resolvedGender}</span>
                    <span>•</span>
                    <span>السن: {selectedSubmission.resolvedAge} سنة</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 text-xs">
                <div className="bg-white/10 px-3 py-1 rounded-xl border border-white/10 flex items-center gap-1.5 font-mono">
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span className="font-bold">MRN: {selectedSubmission.resolvedMrn}</span>
                </div>
                <div className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    التسجيل: {new Date(selectedSubmission.created_at).toLocaleDateString("ar-EG")}
                  </span>
                </div>
              </div>
            </div>

            {/* FULL DETAILS BY FORM TYPE */}
            <div className="space-y-4 text-xs">
              
              {/* ================= FORM 1: RADIATION EXPOSURE ================= */}
              {selectedSubmission.formType === "radiation" && (
                <div className="space-y-4">
                  <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-100 space-y-3">
                    <h5 className="font-bold text-sky-950 flex items-center gap-2 text-xs">
                      <Activity className="w-4 h-4 text-sky-600" />
                      <span>بيانات الفحص والجرعات الإشعاعية</span>
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-sky-100">
                      <div><span className="text-slate-400 block text-[11px]">اسم الإجراء:</span><strong className="text-slate-900">{selectedSubmission.procedure_name}</strong></div>
                      <div><span className="text-slate-400 block text-[11px]">المكان / الجهاز:</span><strong className="text-slate-900">{selectedSubmission.procedure_location || "-"}</strong></div>
                      <div><span className="text-slate-400 block text-[11px]">تاريخ الفحص:</span><strong className="text-slate-900 font-mono">{selectedSubmission.exposure_date}</strong></div>
                      <div><span className="text-slate-400 block text-[11px]">وقت الفحص:</span><strong className="text-slate-900 font-mono">{selectedSubmission.exposure_time}</strong></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 flex justify-between items-center">
                      <div>
                        <span className="text-amber-800 text-[11px] font-bold block">جرعة الفحص الحالية (Current Dose)</span>
                        <h4 className="text-2xl font-extrabold text-amber-950 font-mono mt-1">
                          {selectedSubmission.radiation_dose} <span className="text-xs font-normal">mGy</span>
                        </h4>
                      </div>
                      <Activity className="w-8 h-8 text-amber-600/50" />
                    </div>

                    <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 flex justify-between items-center">
                      <div>
                        <span className="text-indigo-800 text-[11px] font-bold block">الجرعة التراكمية الإجمالية (Cumulative Dose)</span>
                        <h4 className="text-2xl font-extrabold text-indigo-950 font-mono mt-1">
                          {selectedSubmission.cumulative_dose} <span className="text-xs font-normal">mGy</span>
                        </h4>
                      </div>
                      <ShieldAlert className="w-8 h-8 text-indigo-600/50" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border">
                    <div><span className="text-slate-500 block text-[11px]">الطول:</span><strong>{selectedSubmission.height_cm ? `${selectedSubmission.height_cm} سم` : "-"}</strong></div>
                    <div><span className="text-slate-500 block text-[11px]">الوزن:</span><strong>{selectedSubmission.weight_kg ? `${selectedSubmission.weight_kg} كجم` : "-"}</strong></div>
                    <div><span className="text-slate-500 block text-[11px]">توقيع الفني المسؤول:</span><strong className="text-slate-900">{selectedSubmission.tech_signature}</strong></div>
                  </div>
                </div>
              )}

              {/* ================= FORM 2: HEALTH EDUCATION ================= */}
              {selectedSubmission.formType === "education" && (
                <div className="space-y-4">
                  <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 space-y-3">
                    <h5 className="font-bold text-emerald-950 flex items-center gap-2 text-xs">
                      <HeartPulse className="w-4 h-4 text-emerald-600" />
                      <span>تقييم الاحتياجات التعليمية والقابلية للتعلم</span>
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-emerald-100">
                      <div><span className="text-slate-400 block text-[11px]">المستوى التعليمي:</span><strong>{selectedSubmission.education_level || "-"}</strong></div>
                      <div><span className="text-slate-400 block text-[11px]">القابلية للتعلم:</span><strong>{selectedSubmission.learning_receptivity || "-"}</strong></div>
                      <div><span className="text-slate-400 block text-[11px]">المتلقي للتثقيف:</span><strong>{selectedSubmission.target_recipient || "-"}</strong></div>
                      <div><span className="text-slate-400 block text-[11px]">الإجراء المطلوب:</span><strong>{selectedSubmission.procedure_name || "-"}</strong></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3.5 rounded-2xl border space-y-2">
                      <span className="font-bold text-slate-800 block text-xs">عوائق التثقيف المرصودة (Barriers):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedSubmission.barriers && selectedSubmission.barriers.length > 0) ? (
                          selectedSubmission.barriers.map((b: string) => (
                            <span key={b} className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-semibold text-[11px]">
                              {b}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">لا توجد عوائق</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border space-y-2">
                      <span className="font-bold text-slate-800 block text-xs">طرق ووسائل التثقيف المستخدمة:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedSubmission.education_method && selectedSubmission.education_method.length > 0) ? (
                          selectedSubmission.education_method.map((m: string) => (
                            <span key={m} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-semibold text-[11px]">
                              {m}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">غير محدد</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Topics Entries Table */}
                  <div className="space-y-2">
                    <span className="font-bold text-slate-800 block text-xs">مواضيع التثقيف الصحي الموثقة:</span>
                    {selectedSubmission.health_education_topic_entries && selectedSubmission.health_education_topic_entries.length > 0 ? (
                      <div className="overflow-x-auto border rounded-xl">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-emerald-50 text-emerald-950 font-bold border-b">
                            <tr>
                              <th className="p-2.5">الموضوع التثقيفي</th>
                              <th className="p-2.5">القائم بالتثقيف</th>
                              <th className="p-2.5 text-center">تم الاستيعاب؟</th>
                              <th className="p-2.5 text-center">إعادة التثقيف؟</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {selectedSubmission.health_education_topic_entries.map((t: any) => (
                              <tr key={t.id}>
                                <td className="p-2.5 font-bold">{t.topic_name}</td>
                                <td className="p-2.5">{t.educator_name}</td>
                                <td className="p-2.5 text-center font-bold">{t.is_comprehended ? "✓ نعم" : "✗ لا"}</td>
                                <td className="p-2.5 text-center font-bold">{t.reeducation_required ? "⚠️ نعم" : "لا"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic text-[11px]">لا توجد مواضيع إضافية مسجلة.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ================= FORM 3: FALL RISK SCREENING ================= */}
              {selectedSubmission.formType === "fall_screen" && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                    selectedSubmission.is_high_risk
                      ? "bg-rose-50 border-rose-300 text-rose-950"
                      : "bg-emerald-50 border-emerald-300 text-emerald-950"
                  }`}>
                    <div className="flex items-center gap-3">
                      <ShieldAlert className={`w-8 h-8 ${selectedSubmission.is_high_risk ? "text-rose-600" : "text-emerald-600"}`} />
                      <div>
                        <h4 className="font-extrabold text-sm sm:text-base">
                          {selectedSubmission.is_high_risk ? "المريض عالي مخاطر السقوط (High Fall Risk)" : "المريض منخفض مخاطر السقوط (Low Risk)"}
                        </h4>
                        <span className="text-xs opacity-90">
                          {selectedSubmission.is_high_risk ? "تم تطبيق شارة F الصفراء والاحتياطات الوقائية" : "لا تتطلب حالة المريض تدابير مشددة"}
                        </span>
                      </div>
                    </div>
                    {selectedSubmission.is_high_risk && (
                      <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center border-2 border-amber-600 shadow-md">
                        F
                      </div>
                    )}
                  </div>

                  {/* 6 Criteria Checklist */}
                  <div className="bg-slate-50 p-4 rounded-2xl border space-y-2">
                    <span className="font-bold text-slate-800 block text-xs">نتائج الفحص المبدئي (Checklist):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className={`p-2.5 rounded-xl border flex justify-between items-center ${selectedSubmission.gait_disturbance ? "bg-rose-50 border-rose-200 text-rose-900 font-bold" : "bg-white border-slate-200"}`}>
                        <span>1. اضطراب في المشي / عدم اتزان:</span>
                        <span>{selectedSubmission.gait_disturbance ? "✓ نعم" : "✗ لا"}</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border flex justify-between items-center ${selectedSubmission.use_mobility_aids ? "bg-rose-50 border-rose-200 text-rose-900 font-bold" : "bg-white border-slate-200"}`}>
                        <span>2. استخدام وسائل مساعدة (عصا/عكاز):</span>
                        <span>{selectedSubmission.use_mobility_aids ? "✓ نعم" : "✗ لا"}</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border flex justify-between items-center ${selectedSubmission.bed_ridden ? "bg-rose-50 border-rose-200 text-rose-900 font-bold" : "bg-white border-slate-200"}`}>
                        <span>3. ملازم للفراش:</span>
                        <span>{selectedSubmission.bed_ridden ? "✓ نعم" : "✗ لا"}</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border flex justify-between items-center ${selectedSubmission.mental_disability ? "bg-rose-50 border-rose-200 text-rose-900 font-bold" : "bg-white border-slate-200"}`}>
                        <span>4. إعاقة ذهنية أو تشوش إدراكي:</span>
                        <span>{selectedSubmission.mental_disability ? "✓ نعم" : "✗ لا"}</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border flex justify-between items-center ${selectedSubmission.sensory_impairment ? "bg-rose-50 border-rose-200 text-rose-900 font-bold" : "bg-white border-slate-200"}`}>
                        <span>5. ضعف شديد في الحواس (بصر/سمع):</span>
                        <span>{selectedSubmission.sensory_impairment ? "✓ نعم" : "✗ لا"}</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border flex justify-between items-center ${selectedSubmission.child_under_15 ? "bg-rose-50 border-rose-200 text-rose-900 font-bold" : "bg-white border-slate-200"}`}>
                        <span>6. طفل أقل من 15 عام:</span>
                        <span>{selectedSubmission.child_under_15 ? "✓ نعم" : "✗ لا"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-2xl border">
                    <div><span className="text-slate-400 block text-[11px]">تاريخ ووقت الفحص:</span><strong className="font-mono">{selectedSubmission.screening_date} ({selectedSubmission.screening_time})</strong></div>
                    <div><span className="text-slate-400 block text-[11px]">استخدام كرسي متحرك:</span><strong>{selectedSubmission.wheelchair_used ? "✓ نعم" : "لا"}</strong></div>
                    <div><span className="text-slate-400 block text-[11px]">توقيع القائم بالمسح:</span><strong className="text-slate-900">{selectedSubmission.screener_signature}</strong></div>
                  </div>
                </div>
              )}

              {/* ================= FORM 4: ADULT FALL RISK (HENDRICH II) ================= */}
              {selectedSubmission.formType === "fall_adult" && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                    selectedSubmission.is_high_risk
                      ? "bg-rose-50 border-rose-300 text-rose-950"
                      : "bg-emerald-50 border-emerald-300 text-emerald-950"
                  }`}>
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base">
                        مجموع نقاط مقياس هندريش 2: {selectedSubmission.total_score} نقطة
                      </h4>
                      <span className="text-xs opacity-90">
                        {selectedSubmission.is_high_risk ? "⚠️ المريض عالي الخطورة (5 نقاط فأكثر أو عامل مباشر)" : "✓ المريض منخفض الخطورة (أقل من 5 نقاط)"}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                      selectedSubmission.is_high_risk ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                    }`}>
                      {selectedSubmission.is_high_risk ? "خطر عالي" : "خطر منخفض"}
                    </span>
                  </div>

                  {/* Scored Criteria */}
                  <div className="bg-slate-50 p-4 rounded-2xl border space-y-2">
                    <span className="font-bold text-slate-800 block text-xs">تفاصيل درجات المقياس (Hendrich II Breakdown):</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border"><span>الارتباك/التشوش:</span> <strong className="font-mono text-rose-700">+{selectedSubmission.confusion_disorientation_score || 0}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span>الاكتئاب المصحوب بأعراض:</span> <strong className="font-mono text-rose-700">+{selectedSubmission.symptomatic_depression_score || 0}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span>تغير في الإخراج:</span> <strong className="font-mono text-rose-700">+{selectedSubmission.altered_elimination_score || 0}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span>الدوار / الدوخة:</span> <strong className="font-mono text-rose-700">+{selectedSubmission.dizziness_vertigo_score || 0}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span>الجنس ذكر:</span> <strong className="font-mono text-rose-700">+{selectedSubmission.male_gender_score || 0}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span>أدوية الصرع والمهدئات:</span> <strong className="font-mono text-rose-700">+{selectedSubmission.antiepileptics_sedatives_score || 0}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span>مضادات الاكتئاب:</span> <strong className="font-mono text-rose-700">+{selectedSubmission.antidepressants_score || 0}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span>اختبار النهوض والجلوس:</span> <strong className="font-mono text-rose-700">+{selectedSubmission.get_up_and_go_score || 0}</strong></div>
                    </div>
                  </div>

                  {/* Interventions */}
                  {selectedSubmission.interventions && selectedSubmission.interventions.length > 0 && (
                    <div className="bg-slate-50 p-4 rounded-2xl border space-y-2">
                      <span className="font-bold text-slate-800 block text-xs">الإجراءات الوقائية المطبقة:</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                        {selectedSubmission.interventions.map((intv: string, i: number) => (
                          <li key={i}>{intv}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border">
                    <div><span className="text-slate-400 block text-[11px]">تاريخ ووقت التقييم:</span><strong className="font-mono">{selectedSubmission.assessment_date} ({selectedSubmission.assessment_time})</strong></div>
                    <div><span className="text-slate-400 block text-[11px]">توقيع القائم بالتقييم:</span><strong>{selectedSubmission.assessor_signature}</strong></div>
                  </div>
                </div>
              )}

              {/* ================= FORM 5: PEDIATRIC FALL RISK (HUMPTY DUMPTY) ================= */}
              {selectedSubmission.formType === "fall_ped" && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                    selectedSubmission.risk_level === "عالية المخاطر"
                      ? "bg-rose-50 border-rose-300 text-rose-950"
                      : selectedSubmission.risk_level === "متوسط المخاطر"
                      ? "bg-amber-50 border-amber-300 text-amber-950"
                      : "bg-emerald-50 border-emerald-300 text-emerald-950"
                  }`}>
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base">
                        مجموع مقياس هامبتي دمبتي: {selectedSubmission.total_score} نقطة
                      </h4>
                      <span className="text-xs opacity-90">
                        مستوى الخطورة: <strong>{selectedSubmission.risk_level}</strong>
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                      selectedSubmission.risk_level === "عالية المخاطر"
                        ? "bg-rose-600 text-white shadow-xs"
                        : selectedSubmission.risk_level === "متوسط المخاطر"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "bg-emerald-600 text-white shadow-xs"
                    }`}>
                      {selectedSubmission.risk_level}
                    </span>
                  </div>

                  {/* Humpty 7 criteria breakdown */}
                  <div className="bg-slate-50 p-4 rounded-2xl border space-y-2">
                    <span className="font-bold text-slate-800 block text-xs">تفاصيل درجات المقياس السبعة:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-white p-2 rounded-xl border"><span>1. العمر (Age):</span> <strong className="font-mono text-slate-800">+{selectedSubmission.age_score}</strong></div>
                      <div className="bg-white p-2 rounded-xl border"><span>2. الجنس (Gender):</span> <strong className="font-mono text-slate-800">+{selectedSubmission.gender_score}</strong></div>
                      <div className="bg-white p-2 rounded-xl border"><span>3. التشخيص (Diagnosis):</span> <strong className="font-mono text-slate-800">+{selectedSubmission.diagnosis_score}</strong></div>
                      <div className="bg-white p-2 rounded-xl border"><span>4. الإدراك (Cognition):</span> <strong className="font-mono text-slate-800">+{selectedSubmission.cognitive_score}</strong></div>
                      <div className="bg-white p-2 rounded-xl border"><span>5. البيئة المحيطة:</span> <strong className="font-mono text-slate-800">+{selectedSubmission.environmental_score}</strong></div>
                      <div className="bg-white p-2 rounded-xl border"><span>6. الجراحة والتخدير:</span> <strong className="font-mono text-slate-800">+{selectedSubmission.surgery_anesthesia_score}</strong></div>
                      <div className="bg-white p-2 rounded-xl border"><span>7. الأدوية المستعملة:</span> <strong className="font-mono text-slate-800">+{selectedSubmission.medications_score}</strong></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border">
                    <div><span className="text-slate-400 block text-[11px]">تاريخ ووقت التقييم:</span><strong className="font-mono">{selectedSubmission.assessment_date} ({selectedSubmission.assessment_time})</strong></div>
                    <div><span className="text-slate-400 block text-[11px]">توقيع التمريض:</span><strong>{selectedSubmission.nurse_signature}</strong></div>
                  </div>
                </div>
              )}

              {/* ================= FORM 6: COMPREHENSIVE PATIENT ASSESSMENT ================= */}
              {selectedSubmission.formType === "assessment" && (
                <div className="space-y-4">
                  {/* Vitals Matrix */}
                  <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 space-y-2">
                    <h5 className="font-bold text-indigo-950 flex items-center gap-2 text-xs">
                      <Heart className="w-4 h-4 text-indigo-600" />
                      <span>العلامات الحيوية (Vital Signs)</span>
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                      <div className="bg-white p-2.5 rounded-xl border"><span className="text-slate-400 block text-[10px]">ضغط الدم</span><strong className="font-mono">{selectedSubmission.blood_pressure || "-"}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span className="text-slate-400 block text-[10px]">الحرارة</span><strong className="font-mono">{selectedSubmission.temperature ? `${selectedSubmission.temperature} °C` : "-"}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span className="text-slate-400 block text-[10px]">النبض</span><strong className="font-mono">{selectedSubmission.heart_rate ? `${selectedSubmission.heart_rate} bpm` : "-"}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span className="text-slate-400 block text-[10px]">التنفس</span><strong className="font-mono">{selectedSubmission.respiratory_rate ? `${selectedSubmission.respiratory_rate}/m` : "-"}</strong></div>
                      <div className="bg-white p-2.5 rounded-xl border"><span className="text-slate-400 block text-[10px]">الأكسجين</span><strong className="font-mono">{selectedSubmission.oxygen_saturation ? `${selectedSubmission.oxygen_saturation} %` : "-"}</strong></div>
                    </div>
                  </div>

                  {/* Clinical & Labs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3.5 rounded-2xl border space-y-1.5">
                      <span className="font-bold text-slate-800 block text-xs">التشخيص والتاريخ المرضي:</span>
                      <div><strong>الإجراء:</strong> {selectedSubmission.procedure_name || "-"}</div>
                      <div><strong>التشخيص:</strong> {selectedSubmission.diagnosis || "-"}</div>
                      <div><strong>التاريخ المرضي/الجراحي:</strong> {selectedSubmission.medical_surgical_history || "-"}</div>
                      <div><strong>الحساسية:</strong> {selectedSubmission.allergy_types ? selectedSubmission.allergy_types.join("، ") : "لا يوجد"} {selectedSubmission.allergy_details ? `(${selectedSubmission.allergy_details})` : ""}</div>
                      <div><strong>الحركة والتدخين:</strong> {selectedSubmission.mobility_status || "-"} | {selectedSubmission.is_smoker ? "مدخن" : "لا يدخن"}</div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border space-y-1.5">
                      <span className="font-bold text-slate-800 block text-xs">نتائج المعمل (Lab Results):</span>
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                        <div className="bg-white p-1.5 rounded-lg border">Creatinine: <strong>{selectedSubmission.lab_creatinine || "-"}</strong></div>
                        <div className="bg-white p-1.5 rounded-lg border">GFR: <strong>{selectedSubmission.lab_gfr || "-"}</strong></div>
                        <div className="bg-white p-1.5 rounded-lg border">Urea: <strong>{selectedSubmission.lab_urea || "-"}</strong></div>
                        <div className="bg-white p-1.5 rounded-lg border">BUN: <strong>{selectedSubmission.lab_bun || "-"}</strong></div>
                        <div className="bg-white p-1.5 rounded-lg border">Na+: <strong>{selectedSubmission.lab_sodium || "-"}</strong></div>
                        <div className="bg-white p-1.5 rounded-lg border">K+: <strong>{selectedSubmission.lab_potassium || "-"}</strong></div>
                      </div>
                      <div className="pt-1 text-[11px] text-slate-600">
                        {selectedSubmission.pacemaker && <span className="text-rose-600 font-bold block">⚠️ منظم ضربات القلب (Pacemaker)</span>}
                        {selectedSubmission.aneurysm_clip && <span className="text-rose-600 font-bold block">⚠️ مشبك أوعية دماغية (Aneurysm Clip)</span>}
                        {selectedSubmission.kidney_disease && <span className="block">أمراض كلى: {selectedSubmission.kidney_disease_details || "نعم"}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Connections */}
                  {selectedSubmission.connections && selectedSubmission.connections.length > 0 && (
                    <div className="border rounded-2xl p-3 bg-white space-y-2">
                      <span className="font-bold text-slate-800 block text-xs">الوصلات الوريدية (Connections):</span>
                      <div className="space-y-1 text-[11px]">
                        {selectedSubmission.connections.map((c: any, i: number) => (
                          <div key={i} className="p-2 bg-slate-50 rounded-lg flex justify-between">
                            <span>{c.name} ({c.size}) - المكان: {c.site}</span>
                            <span className="text-slate-500">تم التركيب: {c.inserted_at} بواسطة: {c.inserted_by}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medications */}
                  {selectedSubmission.medications && selectedSubmission.medications.length > 0 && (
                    <div className="border rounded-2xl p-3 bg-white space-y-2">
                      <span className="font-bold text-slate-800 block text-xs">الأدوية المنصرفة (Medications):</span>
                      <div className="space-y-1 text-[11px]">
                        {selectedSubmission.medications.map((m: any, i: number) => (
                          <div key={i} className="p-2 bg-slate-50 rounded-lg flex justify-between">
                            <span>{m.name} ({m.dose}) - طريق: {m.route}</span>
                            <span className="text-slate-500">بواسطة: {m.administered_by} | الطبيب: {m.ordering_doctor}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-2xl border text-xs">
                    <div><span className="text-slate-400 block text-[11px]">الطبيب المعالج:</span><strong>{selectedSubmission.attending_physician || "-"} ({selectedSubmission.physician_phone || "-"})</strong></div>
                    <div><span className="text-slate-400 block text-[11px]">توقيع التمريض:</span><strong>{selectedSubmission.nurse_signature || "-"}</strong></div>
                    <div><span className="text-slate-400 block text-[11px]">توقيع الطبيب:</span><strong>{selectedSubmission.physician_signature || "-"}</strong></div>
                  </div>
                </div>
              )}

              {/* ================= FORM 7: PATIENT TRANSFER ================= */}
              {selectedSubmission.formType === "transfer" && (
                <div className="space-y-4">
                  {/* RSTP Result Banner */}
                  <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md space-y-3">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                      <div>
                        <span className="text-blue-300 text-[11px]">معدل الخطر عند نقل المريض (RSTP Score)</span>
                        <h4 className="text-xl font-extrabold">{selectedSubmission.total_rstp_score} نقطة</h4>
                      </div>
                      <span className="px-3 py-1 bg-blue-500/30 border border-blue-400/40 rounded-xl font-bold text-xs">
                        المجموعة {selectedSubmission.group_code} (Group {selectedSubmission.group_code})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="bg-white/10 p-2.5 rounded-xl">
                        <span className="text-blue-200 block text-[10px]">وسيلة النقل:</span>
                        <strong className="block text-sm">{selectedSubmission.recommended_vehicle}</strong>
                      </div>
                      <div className="bg-white/10 p-2.5 rounded-xl">
                        <span className="text-blue-200 block text-[10px]">طاقم النقل المرافق:</span>
                        <strong className="block text-sm">{selectedSubmission.recommended_staff}</strong>
                      </div>
                      <div className="bg-white/10 p-2.5 rounded-xl">
                        <span className="text-blue-200 block text-[10px]">المتابعة المستمرة:</span>
                        <strong className="block text-sm">{selectedSubmission.continuous_monitoring_applicable ? "مطبق ✓" : "غير مطبق (NA)"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border space-y-2">
                    <span className="font-bold text-slate-800 block text-xs">مسار النقل وسببه:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border">
                      <div><span className="text-slate-400 block text-[11px]">من:</span><strong>{selectedSubmission.from_location}</strong></div>
                      <div><span className="text-slate-400 block text-[11px]">إلى:</span><strong>{selectedSubmission.to_location}</strong></div>
                      <div><span className="text-slate-400 block text-[11px]">التاريخ والوقت:</span><strong className="font-mono">{selectedSubmission.transfer_date} ({selectedSubmission.transfer_time} {selectedSubmission.transfer_period})</strong></div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border">
                      <span className="text-slate-400 block text-[11px]">سبب النقل:</span>
                      <strong>{selectedSubmission.transfer_reason}</strong>
                    </div>
                    {selectedSubmission.transfer_instructions && (
                      <div className="bg-white p-3 rounded-xl border">
                        <span className="text-slate-400 block text-[11px]">تعليمات النقل:</span>
                        <p className="text-slate-800">{selectedSubmission.transfer_instructions}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border">
                    <div><span className="text-slate-400 block text-[11px]">توقيع الممرض/ة المحول له:</span><strong>{selectedSubmission.receiving_nurse_signature || "-"}</strong></div>
                    <div><span className="text-slate-400 block text-[11px]">توقيع الطبيب المستلم:</span><strong>{selectedSubmission.receiving_physician_signature || "-"}</strong></div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Bottom Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-[#621c6f] hover:bg-[#4f1659] text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة النموذج الرسمية</span>
                </button>

                <Link
                  href={selectedSubmission.editUrl}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-all"
                >
                  <Pencil className="w-4 h-4" />
                  <span>تعديل السجل</span>
                </Link>

                <button
                  onClick={() => handleDeleteRecord(selectedSubmission)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedSubmission(null)}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200 transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL OFFICIAL MEDICAL DOCUMENT PRINT VIEWS (100% EXACT REPLICA OF EACH FORM PAGE) */}
      {selectedSubmission && (
        <div className="hidden print:block bg-white text-black font-sans text-xs">
          
          {/* ================= 1. RADIATION EXPOSURE (TRC.MRS) ================= */}
          {selectedSubmission.formType === "radiation" && (
            <div className="p-4">
              <div className="relative text-center pb-2 mb-2">
                <div className="absolute left-0 top-0 border-2 border-black px-2 py-0.5 font-bold text-xs font-mono tracking-widest">
                  TIBA
                </div>
                <h2 className="text-base font-bold">Tiba Scan Radiology Center</h2>
                <h3 className="text-sm font-bold">مركز طيبة سكان للأشعة</h3>
              </div>

              <div className="flex justify-between items-center text-xs font-bold py-2 mb-2 border-b border-black">
                <div>
                  اسم المريض رباعي:{" "}
                  <span className="font-normal underline mr-1">
                    {selectedSubmission.resolvedPatientName || "......................................................."}
                  </span>
                </div>
                <div>
                  رقم الملف الطبي:{" "}
                  <span className="font-normal underline mr-1 font-mono">
                    {selectedSubmission.resolvedMrn || "......................................................."}
                  </span>
                </div>
              </div>

              <div className="text-center py-1.5 bg-slate-200 border border-black font-bold text-sm mb-3">
                نموذج تسجيل التعرض لجرعات الاشعة
              </div>

              <table className="w-full border-collapse border border-black text-center text-xs">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-black">
                    <th className="border border-black p-2">التاريخ</th>
                    <th className="border border-black p-2">الوقت</th>
                    <th className="border border-black p-2">الطول</th>
                    <th className="border border-black p-2">الوزن</th>
                    <th className="border border-black p-2">السن</th>
                    <th className="border border-black p-2">الاجراء مكان الاجراء</th>
                    <th className="border border-black p-2">جرعة الاشعاع</th>
                    <th className="border border-black p-2">الجرعة التراكمية</th>
                    <th className="border border-black p-2">توقيع فني الاشعة</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-medium">
                    <td className="border border-black p-2">{selectedSubmission.exposure_date || new Date(selectedSubmission.created_at).toLocaleDateString("ar-EG")}</td>
                    <td className="border border-black p-2 font-mono">
                      {formatTime12(selectedSubmission.exposure_time) || new Date(selectedSubmission.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="border border-black p-2">{selectedSubmission.height_cm ? `${selectedSubmission.height_cm}` : "-"}</td>
                    <td className="border border-black p-2">{selectedSubmission.weight_kg ? `${selectedSubmission.weight_kg}` : "-"}</td>
                    <td className="border border-black p-2">{selectedSubmission.age || selectedSubmission.resolvedAge || "-"}</td>
                    <td className="border border-black p-2">
                      {selectedSubmission.procedure_name} {selectedSubmission.procedure_location ? `(${selectedSubmission.procedure_location})` : ""}
                    </td>
                    <td className="border border-black p-2 font-bold">{selectedSubmission.radiation_dose || 0}</td>
                    <td className="border border-black p-2 font-bold">{selectedSubmission.cumulative_dose || 0}</td>
                    <td className="border border-black p-2">{selectedSubmission.tech_signature || "فني الأشعة"}</td>
                  </tr>
                </tbody>
              </table>

              <div className="text-center text-xs font-mono font-bold mt-12 pt-4 border-t border-black">
                TRC.MRS
              </div>
            </div>
          )}

          {/* ================= 2. HEALTH EDUCATION (TRC.MRS) ================= */}
          {selectedSubmission.formType === "education" && (
            <div className="p-4">
              <div className="relative text-center pb-2 mb-2">
                <div className="absolute left-0 top-0 border-2 border-black px-2 py-0.5 font-bold text-xs font-mono tracking-widest">
                  TIBA
                </div>
                <h2 className="text-base font-bold">Tiba Scan Radiology Center</h2>
                <h3 className="text-sm font-bold">مركز طيبة سكان للأشعة</h3>
              </div>

              <div className="flex justify-between items-center text-xs font-bold py-2 mb-2 border-b border-black">
                <div>
                  اسم المريض رباعي :{" "}
                  <span className="font-normal underline mr-1">
                    {selectedSubmission.resolvedPatientName || "................................................................"}
                  </span>
                </div>
                <div>
                  رقم الملف الطبي ..:{" "}
                  <span className="font-normal underline mr-1 font-mono">
                    {selectedSubmission.resolvedMrn || "........................................................."}
                  </span>
                </div>
              </div>

              <div className="text-center py-1.5 bg-slate-200 border border-black font-bold text-sm mb-3">
                نموذج التثقيف الصحي للمريض والأسرة
              </div>

              <div className="flex justify-between items-center text-xs font-bold mb-3">
                <div>
                  الإجراء:{" "}
                  <span className="font-normal underline mr-1">
                    {selectedSubmission.procedure_name || "........................................................"}
                  </span>
                </div>
                <div>
                  مكان الإجراء:{" "}
                  <span className="font-normal underline mr-1">
                    {selectedSubmission.procedure_location || "........................................................................."}
                  </span>
                </div>
              </div>

              <div className="border border-black p-2.5 mb-3 text-[11px] space-y-1.5 leading-relaxed">
                <div className="font-bold underline mb-1">
                  تقييم مبدئي للاحتياجات التعليمية للمريض / الأسرة:
                </div>
                <div>
                  <strong>التعليم :</strong>{" "}
                  {["مؤهل عالي", "مؤهل متوسط", "يقرأ ويكتب", "أمي"].map((opt) => (
                    <span key={opt} className="ml-3">
                      {selectedSubmission.education_level === opt ? "■" : "□"} {opt}
                    </span>
                  ))}
                </div>
                <div>
                  <strong>القابلية للتعلم :</strong>{" "}
                  {["يريد ويستجيب", "لا يريد ولا يستجيب"].map((opt) => (
                    <span key={opt} className="ml-3">
                      {selectedSubmission.learning_receptivity === opt ? "■" : "□"} {opt}
                    </span>
                  ))}
                </div>
                <div>
                  <strong>عوائق التثقيف:</strong>{" "}
                  <span className="ml-3">{(selectedSubmission.barriers || []).includes("عضوي") ? "■" : "□"} عضوي (السمع ، الكلام ، أخري)</span>
                  <span className="ml-3">{(selectedSubmission.barriers || []).includes("معرفي") ? "■" : "□"} معرفي (مستوي الذكاء ، الاستيعاب)</span>
                </div>
                <div>
                  <strong>بناءا علي المعوقات السابقة سيتم تقديم التثقيف ل :</strong>{" "}
                  <span className="ml-3">{selectedSubmission.target_recipient === "المريض" ? "■" : "□"} المريض</span>
                  <span className="ml-3">{selectedSubmission.target_recipient === "الأسرة" ? "■" : "□"} الأسرة</span>
                </div>
                <div>
                  <strong>طريقة التثقيف:</strong>{" "}
                  <span className="ml-3">{selectedSubmission.methods?.includes("شفهية") || selectedSubmission.education_method === "شفهية" ? "■" : "□"} شفهية</span>
                  <span className="ml-3">{selectedSubmission.methods?.includes("مكتوبة") || selectedSubmission.education_method === "مكتوبة" ? "■" : "□"} مكتوبة</span>
                  <span className="ml-3">
                    {selectedSubmission.education_method === "أخري (أذكر)" ? "■" : "□"} أخري (أذكر) : {selectedSubmission.other_method_text || ".............."}
                  </span>
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-center text-xs">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-black">
                    <th rowSpan={2} className="border border-black p-1.5 w-20">التاريخ</th>
                    <th rowSpan={2} className="border border-black p-1.5">الموضوع التثقيفي</th>
                    <th className="border border-black p-1.5 w-32">القائم بالتثقيف</th>
                    <th colSpan={3} className="border border-black p-1.5">تقييم عملية التثقيف</th>
                  </tr>
                  <tr className="bg-slate-100 font-bold border-b border-black text-[11px]">
                    <th className="border border-black p-1">توقيع القائم بالتثقيف</th>
                    <th className="border border-black p-1 w-12">نعم</th>
                    <th className="border border-black p-1 w-12">لا</th>
                    <th className="border border-black p-1 w-16">إعادة التثقيف</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedSubmission.health_education_topic_entries || []).map((t: any, idx: number) => {
                    return (
                      <tr key={idx}>
                        <td className="border border-black p-1.5">{selectedSubmission.education_date || new Date(selectedSubmission.created_at).toLocaleDateString("ar-EG")}</td>
                        <td className="border border-black p-1.5 text-right leading-snug">
                          {t.topic_name}
                        </td>
                        <td className="border border-black p-1.5">{t.educator_name || selectedSubmission.educator_signature || ""}</td>
                        <td className="border border-black p-1.5 font-bold">{t.is_comprehended === true ? "✓" : ""}</td>
                        <td className="border border-black p-1.5 font-bold">{t.is_comprehended === false ? "✓" : ""}</td>
                        <td className="border border-black p-1.5">{t.reeducation_required ? "✓" : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="text-center text-xs font-mono font-bold mt-8 pt-2 border-t border-black">
                TRC.MRS
              </div>
            </div>
          )}

          {/* ================= 3. FALL RISK SCREENING (TRC.MRS) ================= */}
          {selectedSubmission.formType === "fall_screen" && (
            <div className="p-4">
              <div className="relative text-center pb-2 mb-2">
                <div className="absolute left-0 top-0 border-2 border-black px-2 py-0.5 font-bold text-xs font-mono tracking-widest">
                  TIBA
                </div>
                <h2 className="text-base font-bold">Tiba Scan Radiology Center</h2>
                <h3 className="text-sm font-bold">مركز طيبة سكان للأشعة</h3>
              </div>

              <div className="flex justify-between items-center text-xs font-bold py-2 mb-1 border-b border-black">
                <div>
                  اسم المريض رباعي :{" "}
                  <span className="font-normal underline mr-1">
                    {selectedSubmission.resolvedPatientName || "......................................................."}
                  </span>
                </div>
                <div>
                  رقم الملف الطبي :{" "}
                  <span className="font-normal underline mr-1 font-mono">
                    {selectedSubmission.resolvedMrn || "......................................................."}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-bold py-1.5 mb-2 border-b border-black">
                <div>
                  الجنس :{" "}
                  <span className="mr-3 font-normal">
                    {selectedSubmission.gender === "ذكر" || selectedSubmission.resolvedGender === "ذكر" ? "■" : "□"} ذكر
                  </span>
                  <span className="mr-3 font-normal">
                    {selectedSubmission.gender === "انثي" || selectedSubmission.resolvedGender === "انثي" ? "■" : "□"} انثي
                  </span>
                </div>
                <div>
                  السن : <span className="font-normal underline mr-1">{selectedSubmission.age || selectedSubmission.resolvedAge || "........."}</span>
                </div>
              </div>

              <div className="text-center py-1.5 bg-slate-200 border border-black font-bold text-sm mb-3">
                المسح (الفحص المبدئي) لخطر السقوط / Fall Risk Screening
              </div>

              <div className="border border-black p-3 mb-4 space-y-2 text-xs">
                <div className="font-bold mb-2">
                  ضع علامة ( ✅ ) إذا كان المريض يعاني من أحد عوامل الخطورة التالية:
                </div>

                <div className="space-y-2">
                  {[
                    { id: "gait_disturbance", label_ar: "عدم الاتزان (يتثاقل ، يهتز ، يتمايل)", label_en: "Gait Disturbance (Shuffling, Jerking, Or Swaying)" },
                    { id: "use_mobility_aids", label_ar: "استخدام أجهزة مساعدة الحركة", label_en: "Use mobility aids" },
                    { id: "bed_ridden", label_ar: "ملازم للفراش", label_en: "Bed Ridden" },
                    { id: "mental_disability", label_ar: "إعاقة ذهنية", label_en: "Mental disability" },
                    { id: "sensory_impairment", label_ar: "خلل في السمع أو البصر", label_en: "Hearing and / or visual impairment" },
                    { id: "child_under_15", label_ar: "طفل أقل من 15 عام", label_en: "Child less than 15 years" },
                  ].map((rf) => (
                    <div key={rf.id} className="flex items-start gap-2">
                      <span className="font-bold font-mono text-sm">
                        {selectedSubmission[rf.id] ? "☑" : "☐"}
                      </span>
                      <div>
                        <span className="font-bold">{rf.label_en}</span> — <span>{rf.label_ar}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-black p-3 mb-4 text-xs space-y-1.5 leading-relaxed bg-slate-50">
                <div className="font-bold underline mb-1">في حالة وجود أي من عوامل الخطورة السابقة يتم عمل الآتي:</div>
                <div className="flex items-center gap-2">
                  <span>•</span>
                  <span>وضع حرف <strong>F</strong> للمريض.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>•</span>
                  <span>استخدام كرسي متحرك للمريض إذا لزم الأمر.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>•</span>
                  <span>عمل تثقيف صحي للمريض و أو ذويه بشأن الوقاية من مخاطر السقوط.</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs font-bold pt-4 border-t border-black">
                <div>
                  توقيع القائم بالمسح: <span className="font-normal underline">{selectedSubmission.screener_signature || "...................."}</span>
                </div>
                <div>
                  التاريخ: <span className="font-normal underline">{selectedSubmission.screening_date || "...................."}</span>
                </div>
                <div>
                  الوقت: <span className="font-normal underline font-mono">{selectedSubmission.screening_time ? formatTime12(selectedSubmission.screening_time) : "...................."}</span>
                </div>
              </div>

              <div className="text-center text-xs font-mono font-bold mt-8 pt-2 border-t border-black">
                TRC.MRS
              </div>
            </div>
          )}

          {/* ================= 4. HENDRICH II ADULT FALL RISK (TRC-ICD) ================= */}
          {selectedSubmission.formType === "fall_adult" && (
            <div className="p-4">
              <div className="relative text-center pb-2 mb-2">
                <div className="absolute left-0 top-0 border-2 border-black px-2 py-0.5 font-bold text-xs font-mono tracking-widest">
                  TRC-ICD
                </div>
                <h2 className="text-base font-bold">Tiba Scan Radiology Center</h2>
                <h3 className="text-sm font-bold">مركز طيبة سكان للأشعة</h3>
              </div>

              <div className="flex justify-between items-center text-xs font-bold py-2 mb-1 border-b border-black">
                <div>
                  اسم المريض رباعي :{" "}
                  <span className="font-normal underline mr-1">
                    {selectedSubmission.resolvedPatientName || "......................................................."}
                  </span>
                </div>
                <div>
                  رقم الملف الطبي :{" "}
                  <span className="font-normal underline mr-1 font-mono">
                    {selectedSubmission.resolvedMrn || "......................................................."}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-bold py-1 mb-2 border-b border-black">
                <div>
                  الجنس :{" "}
                  <span className="mr-3 font-normal">{selectedSubmission.gender === "ذكر" || selectedSubmission.resolvedGender === "ذكر" ? "■" : "□"} ذكر</span>
                  <span className="mr-3 font-normal">{selectedSubmission.gender === "انثي" || selectedSubmission.resolvedGender === "انثي" ? "■" : "□"} انثي</span>
                </div>
                <div>
                  السن : <span className="font-normal underline mr-1">{selectedSubmission.age || selectedSubmission.resolvedAge || "........."}</span>
                </div>
              </div>

              <div className="text-center py-1 bg-slate-200 border border-black font-bold text-sm mb-2">
                تقييم مخاطر السقوط للكبار Hendrich II Fall Risk Assessment
              </div>

              {/* Direct Factors Box */}
              <div className="border border-black p-2 mb-2 text-[11px] leading-snug">
                <div className="font-bold underline mb-1">
                  في حالة وجود أحد عوامل الخطورة التالية يكون المريض معرض لخطر السقوط ويتم اتخاذ كافة الإجراءات اللازمة لحمايته دون تقييم:
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>{selectedSubmission.direct_factors?.bed_ridden ? "■" : "□"} مريض ملازم للفراش</div>
                  <div>{selectedSubmission.direct_factors?.physical_disability ? "■" : "□"} وجود إعاقة جسدية</div>
                  <div>{selectedSubmission.direct_factors?.mental_disability ? "■" : "□"} وجود إعاقة ذهنية</div>
                  <div>{selectedSubmission.direct_factors?.anesthesia_first_24h ? "■" : "□"} مريض في أول 24 ساعة من التخدير</div>
                </div>
              </div>

              {/* Scored Matrix Table */}
              <table className="w-full border-collapse border border-black text-center text-[10px] mb-2">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-black">
                    <th className="border border-black p-1 text-right">عامل الخطورة (Risk Factor)</th>
                    <th className="border border-black p-1 w-20">درجة الخطر</th>
                    <th className="border border-black p-1 w-24">
                      التاريخ: {selectedSubmission.assessment_date} / الوقت: {selectedSubmission.assessment_time}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-1 text-right">
                      ارتباك / عدم الدراية بالزمان أو المكان أو الأشخاص / اضطراب سلوك اندفاعي / هلاوس / اضطراب في الوعي (Confusion / Disorientation / Impulsivity)
                    </td>
                    <td className="border border-black p-1 font-bold">4</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.confusion ? "4" : "0"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">
                      علامات اكتئاب (فقدان أمل / حزين / غير متفاعل / باكي) (Symptomatic Depression)
                    </td>
                    <td className="border border-black p-1 font-bold">2</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.depression ? "2" : "0"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">
                      اضطراب في الإخراج (تبول لا إرادي / التبول الليلي / إسهال) (Altered Elimination)
                    </td>
                    <td className="border border-black p-1 font-bold">1</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.altered_elimination ? "1" : "0"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">دوخة / دوار (Dizziness / Vertigo)</td>
                    <td className="border border-black p-1 font-bold">1</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.dizziness ? "1" : "0"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">نوع المريض ذكر Gender (Male)</td>
                    <td className="border border-black p-1 font-bold">1</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.gender === "ذكر" || selectedSubmission.resolvedGender === "ذكر" ? "1" : "0"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">
                      تعاطي أي أدوية مضادة للصرع، أدوية مهدئة، مخدرة، مدرة للبول (Antiepileptics / Sedatives / Diuretics)
                    </td>
                    <td className="border border-black p-1 font-bold">2</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.antiepileptics ? "2" : "0"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">تعاطي أي أدوية مضادة للاكتئاب (Antidepressants)</td>
                    <td className="border border-black p-1 font-bold">1</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.antidepressants ? "1" : "0"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">
                      اختبار النهوض من الكرسي Get Up and Go Test:
                      <br />
                      {selectedSubmission.get_up_and_go_score === 0 && "القدرة علي النهوض بحركة واحدة – دون فقدان التوازن"}
                      {selectedSubmission.get_up_and_go_score === 1 && "يدفع لأعلي، ناجحاً في محاولة واحدة"}
                      {selectedSubmission.get_up_and_go_score === 3 && "محاولات متعددة لكنها ناجحة"}
                      {selectedSubmission.get_up_and_go_score === 4 && "عدم القدرة علي النهوض دون مساعدة أثناء الاختبار"}
                    </td>
                    <td className="border border-black p-1 font-bold">0 / 1 / 3 / 4</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.get_up_and_go_score ?? 0}</td>
                  </tr>
                  <tr className="bg-slate-100 font-bold">
                    <td className="border border-black p-1 text-right">إجمالي درجات التقييم (Total Score)</td>
                    <td className="border border-black p-1">-</td>
                    <td className="border border-black p-1 text-xs">{selectedSubmission.total_score}</td>
                  </tr>
                </tbody>
              </table>

              {/* Interventions in print */}
              <div className="border border-black p-2 mb-2 text-[10px]">
                <div className="font-bold underline mb-1">الإجراءات اللازمة لحماية المريض من خطر السقوط:</div>
                <div className="grid grid-cols-2 gap-1 leading-tight">
                  {[
                    "تمييز المريض بوضع سلسلة عليها حرف F",
                    "رفع جوانب الترولي أو إمداد المريض بأجهزة المساعدة علي المشي مثل الكرسي المتحرك.",
                    "التنبيه علي المريض بطلب المساعدة أثناء المشي والتنقل و دخول الحمام.",
                    "تشجيع المريض علي استخدام سندات الحوائط اثناء السير.",
                    "التأكد من احتياطات سالمة البيئة (جفاف األرض، عدم وجود عوائق.)",
                    "التنبيه علي المريض بعدم اللجوء إلي حركات فجائية عند تغيير الوضع من النوم إلي الوقوف أو الجلوس.",
                    "التنبيه علي المريض بعدم الانحناء لالتقاط أي شيء علي الأرض",
                    "تثقيف المريض و أو ذويه حول الإجراءات المانعة للسقوط",
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <span>{(selectedSubmission.interventions || []).includes(item) ? "■" : "□"}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-black">
                <div>
                  توقيع القائم بالتقييم: <span className="font-normal underline">{selectedSubmission.assessor_signature || "...................."}</span>
                </div>
                <div>
                  النتيجة:{" "}
                  <span className="font-bold underline">
                    {selectedSubmission.is_high_risk ? "عالي مخاطر السقوط (5 نقاط فأكثر)" : "منخفض المخاطر"}
                  </span>
                </div>
              </div>

              <div className="text-center text-[10px] font-mono text-slate-500 mt-4 pt-1 border-t border-slate-300">
                Hendrich II Fall Risk Model • TRC-ICD
              </div>
            </div>
          )}

          {/* ================= 5. HUMPTY DUMPTY PEDIATRIC FALL RISK (TRC.ICD) ================= */}
          {selectedSubmission.formType === "fall_ped" && (
            <div className="p-4">
              <div className="relative text-center pb-2 mb-2">
                <div className="absolute left-0 top-0 border-2 border-black px-2 py-0.5 font-bold text-xs font-mono tracking-widest">
                  TIBA
                </div>
                <h2 className="text-base font-bold">Tiba Scan Radiology Center</h2>
                <h3 className="text-sm font-bold">مركز طيبة سكان للأشعة</h3>
              </div>

              <div className="flex justify-between items-center text-xs font-bold py-2 mb-1 border-b border-black">
                <div>
                  اسم المريض رباعي :{" "}
                  <span className="font-normal underline mr-1">
                    {selectedSubmission.resolvedPatientName || "......................................................."}
                  </span>
                </div>
                <div>
                  رقم الملف الطبي :{" "}
                  <span className="font-normal underline mr-1 font-mono">
                    {selectedSubmission.resolvedMrn || "......................................................."}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-bold py-1 mb-2 border-b border-black">
                <div>
                  الجنس :{" "}
                  <span className="mr-3 font-normal">{selectedSubmission.gender === "ذكر" || selectedSubmission.resolvedGender === "ذكر" ? "■" : "□"} ذكر</span>
                  <span className="mr-3 font-normal">{selectedSubmission.gender === "انثي" || selectedSubmission.resolvedGender === "انثي" ? "■" : "□"} انثي</span>
                </div>
                <div>
                  السن : <span className="font-normal underline mr-1">{selectedSubmission.age || selectedSubmission.resolvedAge || "........."}</span>
                </div>
              </div>

              <div className="text-center py-1 bg-slate-200 border border-black font-bold text-sm mb-2">
                مقياس مخاطر سقوط الأطفال (Humpty Dumpty Scale)
              </div>

              <div className="border border-black p-2 mb-2 text-[10px] leading-tight">
                <div className="font-bold underline mb-1">
                  يعتبر المريض معرض للسقوط بدرجة عالية في حالة وجود أي من تلك العوامل:
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>{selectedSubmission.direct_factors?.bed_ridden ? "■" : "□"} ملازم الفراش (Bed Ridden)</div>
                  <div>{selectedSubmission.direct_factors?.critical_unit ? "■" : "□"} مرضى الرعاية والعمليات (Critical Units)</div>
                  <div>{selectedSubmission.direct_factors?.anesthesia_48h ? "■" : "□"} تخدير خلال 48 ساعة</div>
                  <div>{selectedSubmission.direct_factors?.mental_disability ? "■" : "□"} إعاقة ذهنية (داون، توحد)</div>
                  <div>{selectedSubmission.direct_factors?.neonate ? "■" : "□"} حديث ولادة (Neonate)</div>
                  <div>{selectedSubmission.direct_factors?.physical_disability ? "■" : "□"} إعاقة جسدية (كفيف، بتر)</div>
                </div>
              </div>

              {/* Humpty Dumpty Table */}
              <table className="w-full border-collapse border border-black text-center text-[10px] mb-2">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-black">
                    <th className="border border-black p-1 text-right">المعيار</th>
                    <th className="border border-black p-1">الدرجة</th>
                    <th className="border border-black p-1">النتيجة المسجلة</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-1 text-right">السن (Age)</td>
                    <td className="border border-black p-1">1 - 4</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.age_score ?? "-"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">النوع (Gender)</td>
                    <td className="border border-black p-1">1 - 2</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.gender_score ?? "-"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">التشخيص (Diagnosis)</td>
                    <td className="border border-black p-1">1 - 4</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.diagnosis_score ?? "-"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">العوامل البيئية (Environmental)</td>
                    <td className="border border-black p-1">1 - 4</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.environmental_score ?? "-"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">الأدوية المستخدمة (Medications)</td>
                    <td className="border border-black p-1">1 - 3</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.medications_score ?? "-"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">مشاكل في الإدراك (Cognitive)</td>
                    <td className="border border-black p-1">1 - 3</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.cognitive_score ?? "-"}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-1 text-right">عملية جراحية / تخدير (Surgery / Anesthesia)</td>
                    <td className="border border-black p-1">1 - 3</td>
                    <td className="border border-black p-1 font-bold">{selectedSubmission.surgery_score ?? "-"}</td>
                  </tr>
                  <tr className="bg-slate-100 font-bold">
                    <td className="border border-black p-1 text-right">المجموع الكلي (Total Score)</td>
                    <td className="border border-black p-1">-</td>
                    <td className="border border-black p-1 text-xs">{selectedSubmission.total_score}</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-between items-center text-xs font-bold p-2 border border-black mb-2 bg-slate-50">
                <div>
                  مستوى الخطورة:{" "}
                  <span className="underline mr-1 font-extrabold">{selectedSubmission.risk_level}</span>
                </div>
                <div className="text-[10px] text-slate-700 font-normal">
                  (منخفض: 0-6 | متوسط: 7-11 | عالي: 12 فأكثر)
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-black">
                <div>
                  توقيع التمريض: <span className="font-normal underline">{selectedSubmission.nurse_signature || "...................."}</span>
                </div>
                <div>
                  التاريخ والوقت: <span className="font-normal underline">{selectedSubmission.assessment_date} {selectedSubmission.assessment_time}</span>
                </div>
              </div>

              <div className="text-center text-[10px] font-mono text-slate-500 mt-4 pt-1 border-t border-slate-300">
                Humpty Dumpty Fall Scale • TRC.ICD
              </div>
            </div>
          )}

          {/* ================= 6. COMPREHENSIVE PATIENT ASSESSMENT (TRC-ICD) ================= */}
          {selectedSubmission.formType === "assessment" && (
            <div className="p-6">
              <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
                <div>
                  <h2 className="text-base font-bold">Tiba Scan Radiology Center</h2>
                  <h3 className="text-sm font-bold">مركز طيبة سكان للأشعة</h3>
                </div>
                <div className="font-mono font-bold text-sm">TRC-ICD</div>
              </div>

              <div className="text-center py-1 bg-slate-200 border border-black font-bold text-sm mb-3">
                نموذج تقييم المريض / Patient Assessment Form
              </div>

              {/* Patient & Visit Grid */}
              <div className="border border-black p-2 mb-3 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <div>
                    اسم المريض رباعي: <span className="underline font-bold">{selectedSubmission.resolvedPatientName || "..................................................."}</span>
                  </div>
                  <div>
                    رقم الملف الطبي: <span className="underline font-bold font-mono">{selectedSubmission.resolvedMrn || "......................."}</span>
                  </div>
                </div>
                <div className="flex justify-between pt-1">
                  <div>تاريخ الزيارة: {selectedSubmission.visit_date} / وقت الزيارة: {selectedSubmission.visit_time}</div>
                  <div>الطبيب المعالج: {selectedSubmission.attending_physician || "-"} ({selectedSubmission.physician_phone || "-"})</div>
                </div>
                <div className="flex justify-between pt-1">
                  <div>الجنس: {selectedSubmission.gender || selectedSubmission.resolvedGender || "-"} | السن: {selectedSubmission.age || selectedSubmission.resolvedAge || "-"} سنة</div>
                  <div>الوزن: {selectedSubmission.weight_kg ? `${selectedSubmission.weight_kg} كجم` : "-"} | الطول: {selectedSubmission.height_cm ? `${selectedSubmission.height_cm} سم` : "-"}</div>
                </div>
              </div>

              {/* Vitals */}
              <div className="border border-black p-2 mb-3">
                <div className="font-bold underline mb-1">العلامات الحيوية (Vital Signs):</div>
                <div className="grid grid-cols-5 text-center font-semibold text-[11px]">
                  <div>ضغط الدم: {selectedSubmission.blood_pressure || "-"}</div>
                  <div>الحرارة: {selectedSubmission.temperature ? `${selectedSubmission.temperature} °C` : "-"}</div>
                  <div>النبض: {selectedSubmission.heart_rate ? `${selectedSubmission.heart_rate} bpm` : "-"}</div>
                  <div>التنفس: {selectedSubmission.respiratory_rate ? `${selectedSubmission.respiratory_rate}/min` : "-"}</div>
                  <div>الأكسجين SaO2: {selectedSubmission.oxygen_saturation ? `${selectedSubmission.oxygen_saturation} %` : "-"}</div>
                </div>
              </div>

              {/* Clinical Info */}
              <div className="border border-black p-2 mb-3 space-y-1 text-[11px]">
                <div><strong>الإجراء المطلوب:</strong> <span className="underline font-bold">{selectedSubmission.procedure_name || "-"}</span></div>
                <div><strong>التشخيص:</strong> {selectedSubmission.diagnosis || "-"}</div>
                <div><strong>التاريخ المرضي والجراحي:</strong> {selectedSubmission.medical_surgical_history || "-"}</div>
                <div><strong>الحساسية:</strong> {(selectedSubmission.allergy_types || []).join(" ، ") || "لا يوجد"} {selectedSubmission.allergy_details ? `(${selectedSubmission.allergy_details})` : ""}</div>
                <div><strong>حركة المريض:</strong> {selectedSubmission.mobility_status || "-"} | <strong>التدخين:</strong> {selectedSubmission.is_smoker ? "مدخن" : "لا يدخن"}</div>
              </div>

              {/* Labs & Checklist */}
              <div className="border border-black p-2 mb-3 text-[11px]">
                <div className="font-bold underline mb-1">نتائج المعمل والمراجعة الإكلينيكية:</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>Creatinine: {selectedSubmission.lab_creatinine || "-"}</div>
                  <div>GFR: {selectedSubmission.lab_gfr || "-"}</div>
                  <div>Urea: {selectedSubmission.lab_urea || "-"}</div>
                </div>
                <div className="pt-2 grid grid-cols-2 gap-1 text-[10px]">
                  <div>أمراض الكلى: {selectedSubmission.kidney_disease ? `نعم (${selectedSubmission.kidney_details || ""})` : "لا"}</div>
                  <div>أمراض القلب: {selectedSubmission.heart_disease ? `نعم (${selectedSubmission.heart_details || ""})` : "لا"}</div>
                  <div>أدوية مضادة للتجلط: {selectedSubmission.anticoagulants ? `نعم (${selectedSubmission.anticoagulant_details || ""})` : "لا"}</div>
                  <div>جهاز تنظيم ضربات القلب: {selectedSubmission.pacemaker ? "نعم ⚠️" : "لا"}</div>
                </div>
              </div>

              {/* Connections & Medications */}
              {selectedSubmission.connections && selectedSubmission.connections.length > 0 && (
                <div className="border border-black p-2 mb-3 text-[11px]">
                  <div className="font-bold underline mb-1">الوصلات الوريدية (Connections):</div>
                  {selectedSubmission.connections.map((c: any, i: number) => (
                    <div key={i}>{c.name} ({c.size}) - المكان: {c.site} - التركيب: {c.inserted_at} بواسطة: {c.inserted_by}</div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t-2 border-black text-xs font-bold">
                <div>توقيع التمريض: <span className="font-normal underline">{selectedSubmission.nurse_signature || "...................."}</span></div>
                <div>توقيع الطبيب: <span className="font-normal underline">{selectedSubmission.physician_signature || "...................."}</span></div>
                <div>التاريخ: {selectedSubmission.visit_date}</div>
              </div>

              <div className="text-center text-[10px] font-mono text-slate-500 mt-4 pt-1 border-t border-slate-300">
                TRC-ICD
              </div>
            </div>
          )}

          {/* ================= 7. PATIENT TRANSFER (TRC.ACT) ================= */}
          {selectedSubmission.formType === "transfer" && (
            <div className="p-6">
              <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
                <div>
                  <h2 className="text-base font-bold">Tiba Scan Radiology Center</h2>
                  <h3 className="text-sm font-bold">مركز طيبة سكان للأشعة</h3>
                </div>
                <div className="text-left font-mono font-bold">
                  <p>TRC.ACT</p>
                  <p className="text-[10px]">Page 1 of 2</p>
                </div>
              </div>

              <div className="text-center py-1.5 bg-slate-200 border border-black font-bold text-sm mb-3">
                نقل مريض / Patient Transfer
              </div>

              {/* Transfer Header Grid */}
              <div className="border border-black p-2.5 mb-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <div>اسم المريض رباعي: <span className="underline font-bold">{selectedSubmission.resolvedPatientName || "..................................................."}</span></div>
                  <div>رقم الملف الطبي: <span className="underline font-bold font-mono">{selectedSubmission.resolvedMrn || "......................."}</span></div>
                </div>
                <div className="flex justify-between pt-1">
                  <div>Date of Transfer: <span className="underline">{selectedSubmission.transfer_date}</span></div>
                  <div>Time الوقت: <span className="underline">{selectedSubmission.transfer_time} ({selectedSubmission.transfer_period})</span></div>
                  <div>From من: <span className="underline">{selectedSubmission.from_location || "................."}</span> إلى To: <span className="underline">{selectedSubmission.to_location || "................."}</span></div>
                </div>
                <div>سبب النقل: <span className="underline">{selectedSubmission.transfer_reason || "...................................................................................................."}</span></div>
              </div>

              {/* Interpretation Table */}
              <div className="mb-3">
                <div className="font-bold underline mb-1">طريقة النقل المطلوبة (Interpretation of RSTP):</div>
                <table className="w-full border-collapse border border-black text-center text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-black">
                      <th className="border border-black p-1">Tick</th>
                      <th className="border border-black p-1">Points الدرجات</th>
                      <th className="border border-black p-1">Group المجموعة</th>
                      <th className="border border-black p-1">Vehicle وسيلة النقل</th>
                      <th className="border border-black p-1">Staff الموظفين</th>
                      <th className="border border-black p-1">Continuous Monitoring Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-1 font-bold">{selectedSubmission.total_rstp_score <= 2 ? "✓" : ""}</td>
                      <td className="border border-black p-1">0–2</td>
                      <td className="border border-black p-1">0</td>
                      <td className="border border-black p-1">Wheelchair – Walking (كرسي متحرك – مشي)</td>
                      <td className="border border-black p-1">Nurse Aid (مساعد تمريض)</td>
                      <td className="border border-black p-1">NA (غير مطبق)</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 font-bold">{selectedSubmission.total_rstp_score >= 3 && selectedSubmission.total_rstp_score <= 6 ? "✓" : ""}</td>
                      <td className="border border-black p-1">3–6</td>
                      <td className="border border-black p-1">I</td>
                      <td className="border border-black p-1">Bed – Trolley (سرير – حامل متحرك)</td>
                      <td className="border border-black p-1">Nurse Aid, Nurse (مساعد تمريض - ممرضة)</td>
                      <td className="border border-black p-1">Applicable (مطبق)</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1 font-bold">{selectedSubmission.total_rstp_score > 6 ? "✓" : ""}</td>
                      <td className="border border-black p-1">Over 6</td>
                      <td className="border border-black p-1">II</td>
                      <td className="border border-black p-1">Bed – Trolley (سرير – حامل متحرك)</td>
                      <td className="border border-black p-1">Nurse Aid, Nurse and Physician (مساعد - ممرضة - طبيب)</td>
                      <td className="border border-black p-1">Applicable (مطبق)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* RSTP Summary Table */}
              <div className="mb-3">
                <div className="font-bold underline mb-1">معدل الخطر عند نقل المريض (RSTP Score: {selectedSubmission.total_rstp_score}):</div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {[
                    { id: "hemodynamic_score", title_ar: "الديناميكا الدموية (ضغط الدم)", title_en: "Hemodynamic" },
                    { id: "arrhythmias_score", title_ar: "اضطراب ضربات القلب", title_en: "Arrhythmias" },
                    { id: "ecg_monitoring_score", title_ar: "رسم القلب المستمر", title_en: "ECG Monitoring" },
                    { id: "iv_line_score", title_ar: "الخطوط والمحاليل الوريدية", title_en: "I.V Line" },
                    { id: "pacemaker_score", title_ar: "منظم ضربات القلب", title_en: "Pacemaker" },
                    { id: "respiration_score", title_ar: "التنفس ونسبة الأكسجين", title_en: "Respiration" },
                    { id: "airway_score", title_ar: "المجرى الهوائي", title_en: "Airway" },
                    { id: "respiratory_support_score", title_ar: "الدعم التنفسي وأجهزة التنفس", title_en: "Respiratory Support" },
                    { id: "neurological_score", title_ar: "الحالة العصبية والوعي", title_en: "Neurological" },
                    { id: "prematurely_score", title_ar: "الأطفال المبتسرين وحديثي الولادة", title_en: "Prematurely" },
                    { id: "techno_pharmacological_score", title_ar: "المضخات والأدوية التقنية", title_en: "Techno-Pharmacological Support" },
                  ].map((p) => (
                    <div key={p.id} className="border border-black p-1 flex justify-between">
                      <span>{p.title_ar} ({p.title_en})</span>
                      <span className="font-bold">+{selectedSubmission[p.id] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedSubmission.transfer_instructions && (
                <div className="border border-black p-2 mb-3 text-[10px]">
                  <div className="font-bold underline mb-1">تعليمات النقل:</div>
                  <p>{selectedSubmission.transfer_instructions}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-black text-[11px] font-bold">
                <div>
                  توقيع الممرض/ة المحول له: <span className="font-normal underline">{selectedSubmission.receiving_nurse_signature || "...................."}</span>
                </div>
                <div>
                  توقيع الطبيب المستلم: <span className="font-normal underline">{selectedSubmission.receiving_physician_signature || "...................."}</span>
                </div>
                <div>التاريخ: {selectedSubmission.transfer_date}</div>
                <div>الوقت: {formatTime12(selectedSubmission.transfer_time)}</div>
              </div>

              <div className="text-center text-[10px] font-mono text-slate-500 mt-4 pt-1 border-t border-slate-300">
                TRC.ACT
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

