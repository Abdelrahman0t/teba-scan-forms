"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
} from "lucide-react";
import { formatTime12 } from "@/lib/timeUtils";
import { buildPatientSearchFilter } from "@/lib/numberUtils";
import { useUser, UserRole } from "@/lib/supabase/auth";
import { useFormSync, notifyFormSubmission } from "@/lib/syncEvents";
import { getFormStatusInfo } from "@/lib/formStatus";
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

export default function PatientsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { role, isAdmin, loading: authLoading } = useUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Patient Details Timeline
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [patientTimeline, setPatientTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineCategory, setTimelineCategory] = useState<TimelineCategory>("all");

  // Full Details Modal State
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  const expandedPatientIdRef = useRef<string | null>(expandedPatientId);
  expandedPatientIdRef.current = expandedPatientId;

  const patientsRef = useRef<any[]>(patients);
  patientsRef.current = patients;

  // Protect page: admission role has no access to clinical records
  useEffect(() => {
    if (!authLoading && role === "admission" && !isAdmin) {
      router.push("/admission");
    }
  }, [role, isAdmin, authLoading, router]);

  useEffect(() => {
    fetchPatients("", false);
  }, []);

  async function fetchPatients(query = "", silent = false) {
    if (!silent) setLoading(true);
    let builder = supabase.from("patients").select("*").order("created_at", { ascending: false });

    if (query.trim()) {
      const filter = buildPatientSearchFilter(query);
      builder = builder.or(filter);
    }

    const [patientsRes, subsRes] = await Promise.all([
      builder,
      supabase
        .from("form_submissions")
        .select("id, patient_id, form_code, created_at")
        .order("created_at", { ascending: false }),
    ]);

    const subsByPatient = new Map<string, { count: number; latest: string }>();
    (subsRes.data || []).forEach((s: any) => {
      if (!s.patient_id) return;
      const existing = subsByPatient.get(s.patient_id);
      if (!existing) {
        subsByPatient.set(s.patient_id, { count: 1, latest: s.created_at });
      } else {
        existing.count += 1;
      }
    });

    const enriched = (patientsRes.data || []).map((p: any) => {
      const subInfo = subsByPatient.get(p.id);
      return {
        ...p,
        submissionsCount: subInfo?.count || 0,
        latestActivity: subInfo?.latest || null,
      };
    });

    // Sort by latest activity (or patient registration date)
    enriched.sort((a: any, b: any) => {
      const timeA = new Date(a.latestActivity || a.created_at).getTime();
      const timeB = new Date(b.latestActivity || b.created_at).getTime();
      return timeB - timeA;
    });

    setPatients(enriched);
    if (!silent) setLoading(false);
  }

  async function fetchPatientTimelineData(patient: any, silent = false) {
    const pid = patient.id;
    if (!silent) setLoadingTimeline(true);

    try {
      const [
        radsRes,
        edusRes,
        fallScreenRes,
        fallAdultRes,
        fallPedRes,
        assessRes,
        transRes,
      ] = await Promise.all([
        supabase.from("radiation_exposure_logs").select("*").eq("patient_id", pid).order("created_at", { ascending: false }),
        supabase.from("health_education_assessments").select("*, health_education_topic_entries(*)").eq("patient_id", pid).order("created_at", { ascending: false }),
        supabase.from("fall_risk_screenings").select("*").eq("patient_id", pid).order("created_at", { ascending: false }),
        supabase.from("fall_risk_adult_assessments").select("*").eq("patient_id", pid).order("created_at", { ascending: false }),
        supabase.from("fall_risk_pediatric_assessments").select("*").eq("patient_id", pid).order("created_at", { ascending: false }),
        supabase.from("patient_assessments").select("*").eq("patient_id", pid).order("created_at", { ascending: false }),
        supabase.from("patient_transfers").select("*").eq("patient_id", pid).order("created_at", { ascending: false }),
      ]);

      function attachMeta(
        item: any,
        formType: string,
        formTypeName: string,
        category: TimelineCategory,
        headerCode: string,
        editUrl: string,
        icon: any,
        color: string
      ) {
        return {
          ...item,
          formType,
          formTypeName,
          category,
          headerCode,
          editUrl: `${editUrl}?editId=${item.id}`,
          icon,
          color,
          resolvedPatientName: patient.full_name,
          resolvedMrn: patient.mrn,
          resolvedGender: patient.gender || "-",
          resolvedAge: patient.age || "-",
        };
      }

      const allItems = [
        ...(radsRes.data || []).map((r) => attachMeta(r, "radiation", "تسجيل جرعات الأشعة", "radiation", "TRC.MRS", "/forms/radiation-exposure", Activity, "text-sky-600 bg-sky-50")),
        ...(edusRes.data || []).map((e) => attachMeta(e, "education", "التثقيف الصحي للمريض والأسرة", "education", "TRC.MRS", "/forms/patient-education", HeartPulse, "text-emerald-600 bg-emerald-50")),
        ...(fallScreenRes.data || []).map((f) => attachMeta(f, "fall_screen", "المسح المبدئي لخطر السقوط", "fall_screen", "TRC.MRS", "/forms/fall-risk-screening", ShieldAlert, "text-amber-600 bg-amber-50")),
        ...(fallAdultRes.data || []).map((fa) => attachMeta(fa, "fall_adult", "تقييم مخاطر السقوط للكبار (Hendrich II)", "fall_adult", "TRC-ICD", "/forms/fall-risk-adult", ShieldAlert, "text-rose-600 bg-rose-50")),
        ...(fallPedRes.data || []).map((fp) => attachMeta(fp, "fall_ped", "مقياس مخاطر سقوط الأطفال (Humpty Dumpty)", "fall_ped", "TRC.ICD", "/forms/fall-risk-pediatric", Baby, "text-cyan-600 bg-cyan-50")),
        ...(assessRes.data || []).map((a) => {
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
          return attachMeta({ ...a, physician_signature: resolvedDocSig, tech_signature: resolvedTechSig }, "assessment", "نموذج تقييم المريض الشامل", "assessment", "TRC-ICD", "/forms/patient-assessment", ClipboardCheck, "text-indigo-600 bg-indigo-50");
        }),
        ...(transRes.data || []).map((t) => attachMeta(t, "transfer", "نموذج نقل المريض (RSTP)", "transfer", "TRC.ACT", "/forms/patient-transfer", Ambulance, "text-blue-600 bg-blue-50")),
      ];

      // Sort chronological descending
      allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPatientTimeline(allItems);
    } catch (err) {
      console.error("Error fetching patient timeline:", err);
    } finally {
      if (!silent) setLoadingTimeline(false);
    }
  }

  // Real-time live synchronization (No Refresh Needed)
  useFormSync(() => {
    fetchPatients(searchQuery, true);
    const currExpandedId = expandedPatientIdRef.current;
    if (currExpandedId) {
      const activePatient = patientsRef.current.find((p) => p.id === currExpandedId) || { id: currExpandedId };
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
    await fetchPatientTimelineData(patient, false);
  }

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
          <span>إجمالي المرضى: <strong className="text-slate-900 font-mono text-sm">{patients.length}</strong></span>
        </div>
      </div>

      {/* Instant Search Bar */}
      <div className="relative bg-white p-3 rounded-2xl shadow-xs border border-slate-200/80 no-print">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            fetchPatients(e.target.value);
          }}
          placeholder="ابحث باسم المريض رباعي أو برقم الملف الطبي (MRN)..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#621c6f] outline-none text-xs sm:text-sm transition-all"
        />
        <Search className="w-4 h-4 absolute left-6 top-5.5 text-slate-400" />
      </div>

      {/* Patient Cards List */}
      {loading ? (
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
        <div className="space-y-3.5 no-print">
          {patients.map((patient) => {
            const isExpanded = expandedPatientId === patient.id;
            
            // Build quick form URLs with patient context pre-filled
            const patientParams = new URLSearchParams();
            if (patient.mrn) patientParams.set("mrn", patient.mrn);
            if (patient.full_name) patientParams.set("name", patient.full_name);
            if (patient.gender) patientParams.set("gender", patient.gender);
            if (patient.age !== undefined && patient.age !== null && patient.age !== "") patientParams.set("age", String(patient.age));
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
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded ? "border-slate-400 shadow-md ring-1 ring-slate-300" : "border-slate-200 hover:border-slate-300 shadow-2xs"
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
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                        isExpanded
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
                          { id: "fall_screen", label: `مسح السقوط (${patientTimeline.filter(t => t.category === "fall_screen").length})` },
                          { id: "assessment", label: `التقييم الشامل (${patientTimeline.filter(t => t.category === "assessment").length})` },
                          { id: "fall_adult", label: `سقوط كبار (${patientTimeline.filter(t => t.category === "fall_adult").length})` },
                          { id: "fall_ped", label: `سقوط أطفال (${patientTimeline.filter(t => t.category === "fall_ped").length})` },
                          { id: "transfer", label: `نقل المريض (${patientTimeline.filter(t => t.category === "transfer").length})` },
                          { id: "radiation", label: `جرعات الأشعة (${patientTimeline.filter(t => t.category === "radiation").length})` },
                          { id: "education", label: `التثقيف الصحي (${patientTimeline.filter(t => t.category === "education").length})` },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setTimelineCategory(cat.id as TimelineCategory)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                              timelineCategory === cat.id
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
                              className={`rounded-2xl border p-4 shadow-2xs transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                                isMyPartPending
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
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        item.risk_level === "عالية المخاطر" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      }`}>
                                        {item.risk_level} {item.total_score ? `(${item.total_score} نقطة)` : ""}
                                      </span>
                                    )}

                                    {item.formType === "fall_adult" && (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        item.is_high_risk ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
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
