"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  Activity,
  HeartPulse,
  Calendar,
  ShieldAlert,
  Baby,
  ClipboardCheck,
  Ambulance,
  Eye,
  Clock,
  Printer,
  X,
  User,
  FileText,
  Heart,
  PenTool,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Filter,
  Sparkles,
  Loader2,
} from "lucide-react";
import { formatTime12 } from "@/lib/timeUtils";
import { useUser, UserRole } from "@/lib/supabase/auth";
import { useFormSync } from "@/lib/syncEvents";
import { getFormStatusInfo } from "@/lib/formStatus";
import {
  RECORDS_PAGE_SIZE,
  ClinicalFormType,
  ClinicalRecordRow,
  KeysetCursor,
  MissingMigrationError,
  PatientWithActivity,
  appendUnique,
  fetchClinicalRecordsPage,
  fetchPatientsPage,
  normalizeRecordData,
} from "@/lib/clinicalRecords";
import SubmissionDetailModal from "@/components/submissions/SubmissionDetailModal";
import SubmissionPrintLayout from "@/components/submissions/SubmissionPrintLayout";

type TimelineCategory =
  | "all"
  | "fall_screen"
  | "assessment"
  | "fall_adult"
  | "fall_ped"
  | "transfer"
  | "radiation"
  | "education";

const TIMELINE_META: Record<ClinicalFormType, { name: string; headerCode: string; editUrl: string; icon: any; color: string }> = {
  radiation: { name: "تسجيل جرعات الأشعة", headerCode: "TRC.MRS", editUrl: "/forms/radiation-exposure", icon: Activity, color: "text-sky-600 bg-sky-50" },
  education: { name: "التثقيف الصحي للمريض والأسرة", headerCode: "TRC.MRS", editUrl: "/forms/patient-education", icon: HeartPulse, color: "text-emerald-600 bg-emerald-50" },
  fall_screen: { name: "المسح المبدئي لخطر السقوط", headerCode: "TRC.MRS", editUrl: "/forms/fall-risk-screening", icon: ShieldAlert, color: "text-amber-600 bg-amber-50" },
  fall_adult: { name: "تقييم مخاطر السقوط للكبار (Hendrich II)", headerCode: "TRC-ICD", editUrl: "/forms/fall-risk-adult", icon: ShieldAlert, color: "text-rose-600 bg-rose-50" },
  fall_ped: { name: "مقياس مخاطر سقوط الأطفال (Humpty Dumpty)", headerCode: "TRC.ICD", editUrl: "/forms/fall-risk-pediatric", icon: Baby, color: "text-cyan-600 bg-cyan-50" },
  assessment: { name: "نموذج تقييم المريض الشامل", headerCode: "TRC-ICD", editUrl: "/forms/patient-assessment", icon: ClipboardCheck, color: "text-indigo-600 bg-indigo-50" },
  transfer: { name: "نموذج نقل المريض (RSTP)", headerCode: "TRC.ACT", editUrl: "/forms/patient-transfer", icon: Ambulance, color: "text-blue-600 bg-blue-50" },
};

// A single patient's full history is small; load it in one call.
const TIMELINE_LIMIT = 1000;

function toTimelineItem(row: ClinicalRecordRow, patient: any) {
  const meta = TIMELINE_META[row.formType];
  const p = patient || row.patient;
  return {
    ...normalizeRecordData(row.formType, row.record),
    formType: row.formType,
    formTypeName: meta.name,
    category: row.formType as TimelineCategory,
    headerCode: meta.headerCode,
    editUrl: `${meta.editUrl}?editId=${row.id}`,
    icon: meta.icon,
    color: meta.color,
    patient: p,
    gender: p?.gender,
    resolvedPatientName: p?.full_name || row.patient?.full_name,
    resolvedMrn: p?.mrn || row.patient?.mrn,
    resolvedGender: p?.gender || row.patient?.gender || "-",
    resolvedAge: p?.age || row.patient?.age || "-",
  };
}

export default function PatientsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { role, isAdmin, loading: authLoading } = useUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [patients, setPatients] = useState<PatientWithActivity[]>([]);
  const [cursor, setCursor] = useState<KeysetCursor | null>(null);
  const [totalPatients, setTotalPatients] = useState(0);
  // Search term whose results are on screen (null = nothing loaded yet)
  const [loadedSearch, setLoadedSearch] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Patient Details Timeline
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [patientTimeline, setPatientTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineCategory, setTimelineCategory] = useState<TimelineCategory>("all");

  // Full Details Modal State
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  const loading = loadedSearch === null;
  const fetching = !loading && loadedSearch !== appliedSearch;

  // Latest values for the live-sync callback (kept in sync after each render)
  const liveRef = useRef({ expandedPatientId, patients, search: appliedSearch });
  useEffect(() => {
    liveRef.current = { expandedPatientId, patients, search: appliedSearch };
  }, [expandedPatientId, patients, appliedSearch]);

  // Every reload bumps the sequence; responses for an older search are dropped.
  const requestSeq = useRef(0);
  const timelineSeq = useRef(0);

  // Protect page: admission role has no access to clinical records
  useEffect(() => {
    if (!authLoading && role === "admission" && !isAdmin) {
      router.push("/admission");
    }
  }, [role, isAdmin, authLoading, router]);

  const submitSearch = () => setAppliedSearch(searchQuery.trim());

  /** Loads the first page; `limit` is raised by live refreshes so loaded pages don't collapse. */
  const fetchPatients = useCallback(async (search: string, limit = RECORDS_PAGE_SIZE) => {
    const seq = ++requestSeq.current;
    try {
      const page = await fetchPatientsPage(supabase, search, { limit });
      if (seq !== requestSeq.current) return;
      setPatients(page.rows);
      setCursor(page.nextCursor);
      setTotalPatients(page.total ?? 0);
      setError(null);
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      console.error("Error fetching patients:", err);
      setError(err instanceof MissingMigrationError ? err.message : "تعذر تحميل سجلات المرضى، حاول مرة أخرى.");
    } finally {
      if (seq === requestSeq.current) {
        setLoadedSearch(search);
        setLoadingMore(false);
      }
    }
  }, [supabase]);

  async function loadMorePatients() {
    if (!cursor || loadingMore) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const page = await fetchPatientsPage(supabase, appliedSearch, { cursor });
      if (seq !== requestSeq.current) return;
      setPatients((prev) => appendUnique(prev, page.rows, (p) => p.id));
      setCursor(page.nextCursor);
      if (page.total !== null) setTotalPatients(page.total);
    } catch (err) {
      console.error("Error loading more patients:", err);
    } finally {
      if (seq === requestSeq.current) setLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchPatients(appliedSearch);
  }, [appliedSearch, fetchPatients]);

  async function fetchPatientTimelineData(patient: any, silent = false) {
    const seq = ++timelineSeq.current;
    if (!silent) setLoadingTimeline(true);

    try {
      const { rows } = await fetchClinicalRecordsPage(supabase, { patientId: patient.id }, { limit: TIMELINE_LIMIT });
      if (seq !== timelineSeq.current) return;
      // Already sorted newest first by the database
      setPatientTimeline(rows.map((r) => toTimelineItem(r, patient)));
    } catch (err) {
      console.error("Error fetching patient timeline:", err);
    } finally {
      if (!silent && seq === timelineSeq.current) setLoadingTimeline(false);
    }
  }

  // Real-time live synchronization (No Refresh Needed)
  useFormSync(() => {
    const live = liveRef.current;
    fetchPatients(live.search, Math.max(RECORDS_PAGE_SIZE, live.patients.length));
    const currExpandedId = live.expandedPatientId;
    if (currExpandedId) {
      const activePatient = live.patients.find((p) => p.id === currExpandedId) || { id: currExpandedId };
      fetchPatientTimelineData(activePatient, true);
    }
  });

  async function togglePatientDetails(patient: any) {
    const pid = patient.id;
    if (expandedPatientId === pid) {
      setExpandedPatientId(null);
      return;
    }

    setExpandedPatientId(pid);
    setTimelineCategory("all");
    setPatientTimeline([]);
    await fetchPatientTimelineData(patient, false);
  }

  const timelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of patientTimeline) counts[t.category] = (counts[t.category] || 0) + 1;
    return counts;
  }, [patientTimeline]);

  // Filtered timeline entries
  const filteredTimeline = useMemo(() => {
    if (timelineCategory === "all") return patientTimeline;
    return patientTimeline.filter((item) => item.category === timelineCategory);
  }, [patientTimeline, timelineCategory]);

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-6 rounded-3xl shadow-xs border border-slate-200/80 no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 p-2.5 shadow-sm flex items-center justify-center shrink-0 text-white">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              سجل المرضى والملفات السريرية (Patient Hub)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مركز طيبة سكان للأشعة • استعراض السجل الطبي الشامل والخط الزمني لتوثيق الرعاية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
          <Sparkles className="w-4 h-4 text-[#621c6f]" />
          <span>{appliedSearch ? "نتائج البحث" : "إجمالي المرضى"}: <strong className="text-slate-900 font-mono text-sm">{totalPatients}</strong></span>
        </div>
      </div>

      {/* Search — only runs after بحث / Enter, not while typing */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
        className="flex items-center gap-2 bg-white p-3 rounded-2xl shadow-xs border border-slate-200/80 no-print"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم المريض رباعي أو برقم الملف الطبي (MRN)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#621c6f] outline-none text-xs sm:text-sm transition-all"
          />
          {fetching && !loading ? (
            <Loader2 className="w-4 h-4 absolute left-3.5 top-3.5 text-[#621c6f] animate-spin" />
          ) : (
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          )}
        </div>
        <button
          type="submit"
          className="shrink-0 px-5 py-2.5 rounded-xl bg-[#621c6f] text-white text-xs sm:text-sm font-bold hover:bg-[#481454] transition-all"
        >
          بحث
        </button>
      </form>

      {/* Patient Cards List */}
      {error ? (
        <div className="bg-rose-50 p-6 text-center rounded-2xl border border-rose-200 text-rose-800 text-sm font-bold no-print">
          {error}
        </div>
      ) : loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="animate-spin w-8 h-8 border-3 border-[#621c6f] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-bold">جاري تحميل سجلات المرضى...</p>
        </div>
      ) : patients.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 space-y-2">
          <p className="text-sm font-bold text-slate-700">لا يوجد مرضى مطابقين لنتائج البحث</p>
          <p className="text-xs text-slate-400">تأكد من كتابة الاسم أو رقم الملف بشكل صحيح.</p>
        </div>
      ) : (
        <div className={`space-y-3.5 no-print transition-opacity ${fetching ? "opacity-60" : ""}`}>
          {patients.map((patient) => {
            const isExpanded = expandedPatientId === patient.id;

            // Build quick form URLs with patient context pre-filled
            const patientParams = new URLSearchParams();
            if (patient.mrn) patientParams.set("mrn", patient.mrn);
            if (patient.full_name) patientParams.set("name", patient.full_name);
            if (patient.gender) patientParams.set("gender", patient.gender);
            if (patient.age !== undefined && patient.age !== null) patientParams.set("age", String(patient.age));
            const patientQuery = patientParams.toString() ? `?${patientParams.toString()}` : "";

            const QUICK_ADD_FORMS = [
              { id: "rad", title: "+ جرعة إشعاع", href: "/forms/radiation-exposure", roles: ["technician"] as UserRole[], color: "hover:bg-sky-50 text-sky-700 border-sky-200" },
              { id: "fall_ped", title: "+ سقوط أطفال", href: "/forms/fall-risk-pediatric", roles: ["nurse"] as UserRole[], color: "hover:bg-cyan-50 text-cyan-700 border-cyan-200" },
              { id: "fall_adult", title: "+ سقوط كبار", href: "/forms/fall-risk-adult", roles: ["nurse"] as UserRole[], color: "hover:bg-rose-50 text-rose-700 border-rose-200" },
              { id: "fall_screen", title: "+ مسح سقوط", href: "/forms/fall-risk-screening", roles: ["nurse"] as UserRole[], color: "hover:bg-amber-50 text-amber-700 border-amber-200" },
              { id: "assessment", title: "+ تقييم شامل", href: "/forms/patient-assessment", roles: ["nurse", "technician", "radiologist"] as UserRole[], color: "hover:bg-indigo-50 text-indigo-700 border-indigo-200" },
              { id: "edu", title: "+ تثقيف صحي", href: "/forms/patient-education", roles: ["nurse", "technician"] as UserRole[], color: "hover:bg-emerald-50 text-emerald-700 border-emerald-200" },
              { id: "transfer", title: "+ نقل مريض", href: "/forms/patient-transfer", roles: ["radiologist", "nurse"] as UserRole[], color: "hover:bg-blue-50 text-blue-700 border-blue-200" },
            ];

            const visibleForms = isAdmin
              ? QUICK_ADD_FORMS
              : role
                ? QUICK_ADD_FORMS.filter((f) => f.roles.includes(role))
                : QUICK_ADD_FORMS;

            return (
              <div
                key={patient.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${isExpanded ? "border-slate-400 shadow-md ring-1 ring-slate-300" : "border-slate-200 hover:border-slate-300 shadow-2xs [content-visibility:auto] [contain-intrinsic-size:auto_110px]"
                  }`}
              >
                {/* Main Patient Card Summary Bar */}
                <div
                  onClick={() => togglePatientDetails(patient)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 cursor-pointer select-none"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                        {patient.full_name}
                      </span>
                      <span className="bg-slate-100 text-slate-800 font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg border border-slate-200">
                        MRN: {patient.mrn}
                      </span>
                      {patient.gender && (
                        <span className="text-xs bg-slate-50 text-slate-600 font-medium px-2 py-0.5 rounded-md border border-slate-200">
                          {patient.gender}
                        </span>
                      )}
                      {patient.age !== undefined && patient.age !== null && (
                        <span className="text-xs bg-slate-50 text-slate-600 font-medium px-2 py-0.5 rounded-md border border-slate-200">
                          {patient.age} سنة
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {patient.submissionsCount > 0 ? (
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1.5 text-[11px]">
                          <FileText className="w-3 h-3 text-emerald-600" />
                          <span>{patient.submissionsCount} {patient.submissionsCount === 1 ? "نموذج موثق" : "نماذج موثقة"}</span>
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-md text-[11px]">
                          لا توجد نماذج بعد
                        </span>
                      )}

                      <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3" />
                        <span>التسجيل: {new Date(patient.created_at).toLocaleDateString("ar-EG")}</span>
                      </span>

                      {patient.latestActivity && (
                        <span className="text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span>آخر توثيق: {new Date(patient.latestActivity).toLocaleDateString("ar-EG")}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <button
                      type="button"
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${isExpanded
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                    >
                      <span>{isExpanded ? "إغلاق السجل" : "عرض السجل الطبي"}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* ================= EXPANDED CLINICAL WORKSPACE ================= */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-6 space-y-5 animate-in fade-in duration-150">

                    {/* Quick Launch Action Bar */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-[#621c6f]" />
                          <span>توثيق استمارة جديدة لهذا المريض:</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {visibleForms.map((f) => (
                          <Link
                            key={f.id}
                            href={`${f.href}${patientQuery}`}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors bg-white shadow-2xs ${f.color}`}
                          >
                            {f.title}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Timeline Category Filters */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-center gap-1.5 no-scrollbar pb-1 max-w-full">
                        <span className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1">
                          <Filter className="w-3.5 h-3.5" />
                          <span>تصفية:</span>
                        </span>
                        {[
                          { id: "all", label: `الكل (${patientTimeline.length})` },
                          { id: "fall_screen", label: `مسح السقوط (${timelineCounts.fall_screen || 0})` },
                          { id: "assessment", label: `التقييم الشامل (${timelineCounts.assessment || 0})` },
                          { id: "fall_adult", label: `سقوط كبار (${timelineCounts.fall_adult || 0})` },
                          { id: "fall_ped", label: `سقوط أطفال (${timelineCounts.fall_ped || 0})` },
                          { id: "transfer", label: `نقل المريض (${timelineCounts.transfer || 0})` },
                          { id: "radiation", label: `جرعات الأشعة (${timelineCounts.radiation || 0})` },
                          { id: "education", label: `التثقيف الصحي (${timelineCounts.education || 0})` },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setTimelineCategory(cat.id as TimelineCategory)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${timelineCategory === cat.id
                                ? "bg-[#621c6f] text-white shadow-xs"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                              }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* UNIFIED CLINICAL TIMELINE FEED */}
                    {loadingTimeline ? (
                      <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
                        <div className="animate-spin w-6 h-6 border-2 border-[#621c6f] border-t-transparent rounded-full mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-bold">جاري تحميل الخط الزمني السريري...</p>
                      </div>
                    ) : filteredTimeline.length === 0 ? (
                      <div className="bg-white p-8 text-center rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                        <p className="text-xs font-bold text-slate-700">لا توجد استمارات في هذا التصنيف لهذا المريض</p>
                        <p className="text-[11px] text-slate-400">يمكنك البدء بإضافة أول استمارة عبر الأزرار السريعة بالأعلى.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredTimeline.map((item) => {
                          const ItemIcon = item.icon || FileText;
                          const signer = item.nurse_signature || item.assessor_signature || item.tech_signature || item.created_by_name || "الكادر الطبي";
                          const rawDate = item.exposure_date || item.assessment_date || item.screening_date || item.transfer_date || item.created_at;
                          const formattedDate = rawDate ? new Date(rawDate).toISOString().split("T")[0] : "-";
                          const formattedTime = item.exposure_time || item.assessment_time || (item.created_at ? formatTime12(new Date(item.created_at).toTimeString().slice(0, 5)) : "");

                          const statusInfo = getFormStatusInfo(item);
                          const isMyPartPending = !statusInfo.isComplete && (
                            isAdmin || (role && (statusInfo.missingRoles as string[]).includes(role))
                          );

                          return (
                            <div
                              key={item.id}
                              className={`rounded-2xl border p-4 shadow-2xs transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${isMyPartPending
                                  ? "bg-amber-50/40 border-amber-300 hover:border-amber-400 hover:shadow-xs"
                                  : "bg-white border-slate-200/90 hover:bg-slate-50/80 hover:shadow-xs"
                                }`}
                            >
                              <div className="flex items-start gap-3 flex-1">
                                <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${item.color || "bg-slate-100 text-slate-700"}`}>
                                  <ItemIcon className="w-5 h-5" />
                                </div>

                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                      {item.formTypeName}
                                    </h4>
                                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                      {item.headerCode}
                                    </span>

                                    {/* Overall Completion Status Badge */}
                                    {statusInfo.isComplete ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold whitespace-nowrap shadow-2xs">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>مكتمل</span>
                                      </span>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold whitespace-nowrap shadow-2xs">
                                          <AlertCircle className="w-3 h-3 text-amber-600" />
                                          <span>{statusInfo.badgeLabel}</span>
                                        </span>
                                        {statusInfo.missingLabels.length > 0 && (
                                          <span className="text-[10px] text-amber-900 bg-amber-100/80 border border-amber-300/60 px-2 py-0.5 rounded-md font-bold">
                                            بانتظار: {statusInfo.missingLabels.join(" + ")}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Clinical badges */}
                                    {item.formType === "fall_ped" && (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.risk_level === "عالية المخاطر" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        }`}>
                                        {item.risk_level} {item.total_score ? `(${item.total_score} نقطة)` : ""}
                                      </span>
                                    )}

                                    {item.formType === "fall_adult" && (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.is_high_risk ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        }`}>
                                        {item.is_high_risk ? "خطر عالي" : "خطر منخفض"} {item.total_score ? `(${item.total_score} نقطة)` : ""}
                                      </span>
                                    )}

                                    {item.formType === "radiation" && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                        جرعة: {item.radiation_dose} mGy (تراكمي: {item.cumulative_dose})
                                      </span>
                                    )}

                                    {item.formType === "transfer" && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                        RSTP: {item.total_rstp_score} نقطة • المجموعة {item.group_code}
                                      </span>
                                    )}

                                    {item.procedure_name && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        الإجراء المطلوب: {item.procedure_name}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                                    <span className="flex items-center gap-1 font-mono">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>{formattedDate} {formattedTime ? `(${formattedTime})` : ""}</span>
                                    </span>
                                    <span>•</span>
                                    {item.formType === "transfer" ? (
                                      <span>
                                        طبيب الأشعة: <strong className="text-slate-700">{item.receiving_physician_signature || "بانتظار الطبيب"}</strong>
                                        {" • "}
                                        التمريض: <strong className="text-slate-700">{item.receiving_nurse_signature || "بانتظار التمريض"}</strong>
                                      </span>
                                    ) : (
                                      <span>التوثيق بواسطة: <strong className="text-slate-700">{signer}</strong></span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Timeline Card Actions */}
                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                {isMyPartPending && (
                                  <a
                                    href={item.editUrl}
                                    className="px-3.5 py-1.5 bg-[#621c6f] hover:bg-[#481454] text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md transition-all inline-flex items-center gap-1.5 whitespace-nowrap animate-pulse hover:animate-none cursor-pointer"
                                    title="اضغط هنا لاستكمال دورك في هذا النموذج"
                                  >
                                    <PenTool className="w-3.5 h-3.5" />
                                    <span>أكمل دورك</span>
                                  </a>
                                )}

                                {!statusInfo.isComplete && !isMyPartPending && (
                                  <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg font-bold whitespace-nowrap hidden sm:inline-block">
                                    دورك مكتمل
                                  </span>
                                )}

                                <button
                                  onClick={() => setSelectedSubmission(item)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                  title="عرض تفاصيل النموذج والطباعة"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                                  <span>عرض التفاصيل والطباعة</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 bg-white rounded-2xl border border-slate-200">
            <span className="text-xs text-slate-500 font-bold">
              عرض <span className="font-mono text-slate-900">{patients.length}</span> من أصل{" "}
              <span className="font-mono text-slate-900">{Math.max(totalPatients, patients.length)}</span> مريض
            </span>
            {cursor && (
              <button
                onClick={loadMorePatients}
                disabled={loadingMore}
                className="px-4 py-2 bg-[#621c6f] hover:bg-[#481454] disabled:opacity-70 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5"
              >
                {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>
                  {loadingMore
                    ? "جاري التحميل..."
                    : `عرض ${Math.min(RECORDS_PAGE_SIZE, Math.max(totalPatients - patients.length, 0)) || RECORDS_PAGE_SIZE} مريض إضافي`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Shared Detail Modal */}
      <SubmissionDetailModal
        submission={selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        isAdmin={isAdmin}
        role={role}
      />

      {/* Shared Official Document Print View */}
      <SubmissionPrintLayout submission={selectedSubmission} />
    </div>
  );
}
