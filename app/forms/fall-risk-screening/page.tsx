"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ShieldAlert,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  PlusCircle,
  Pencil,
  UserCheck,
  Clock,
  Calendar,
} from "lucide-react";

import { getCurrentTimeShort, getCurrentDate, sanitizeSqlTime, formatTime12 } from "@/lib/timeUtils";

function playSuccessSound() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

const RISK_FACTORS = [
  {
    id: "gait_disturbance",
    label_ar: "عدم الاتزان (يتثاقل ، يهتز ، يتمايل)",
    label_en: "Gait Disturbance (Shuffling, Jerking, Or Swaying)",
  },
  {
    id: "use_mobility_aids",
    label_ar: "استخدام أجهزة مساعدة الحركة",
    label_en: "Use mobility aids",
  },
  {
    id: "bed_ridden",
    label_ar: "ملازم للفراش",
    label_en: "Bed Ridden",
  },
  {
    id: "mental_disability",
    label_ar: "إعاقة ذهنية",
    label_en: "Mental disability",
  },
  {
    id: "sensory_impairment",
    label_ar: "خلل في السمع أو البصر",
    label_en: "Hearing and / or visual impairment",
  },
  {
    id: "child_under_15",
    label_ar: "طفل أقل من 15 عام",
    label_en: "Child less than 15 years",
  },
];

function normalizeGender(val: any): "ذكر" | "انثي" | "" {
  if (!val) return "";
  const cleaned = String(val).trim().toLowerCase();
  if (cleaned.includes("ذكر") || cleaned === "male" || cleaned === "m") return "ذكر";
  if (cleaned.includes("أنث") || cleaned.includes("انث") || cleaned.includes("أنثى") || cleaned.includes("انثى") || cleaned === "female" || cleaned === "f") return "انثي";
  return "";
}

function FallRiskScreeningContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const mrnInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<any | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Patient Header
  const [mrn, setMrn] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [gender, setGender] = useState<"ذكر" | "انثي" | "">("");
  const [age, setAge] = useState<number | "">("");

  // Risk Factors (Boolean flags)
  const [factors, setFactors] = useState<{ [key: string]: boolean }>({
    gait_disturbance: false,
    use_mobility_aids: false,
    bed_ridden: false,
    mental_disability: false,
    sensory_impairment: false,
    child_under_15: false,
  });

  // Action Checkboxes
  const [fBadgeApplied, setFBadgeApplied] = useState(false);
  const [wheelchairUsed, setWheelchairUsed] = useState(false);
  const [educationProvided, setEducationProvided] = useState(false);

  // Screener Sign & Time
  const [screenerSignature, setScreenerSignature] = useState("");
  const [screeningDate, setScreeningDate] = useState(() => getCurrentDate());
  const [screeningTime, setScreeningTime] = useState(() => getCurrentTimeShort());

  const hasAnyRisk = Object.values(factors).some(Boolean);

  // When any risk factor is selected, automatically apply all 3 required actions per PDF
  useEffect(() => {
    if (hasAnyRisk) {
      setFBadgeApplied(true);
      setEducationProvided(true);
      setWheelchairUsed(true);
    } else if (!editId) {
      setFBadgeApplied(false);
      setEducationProvided(false);
      setWheelchairUsed(false);
    }
  }, [hasAnyRisk, editId]);

  // Auto detect child < 15 when age is typed
  useEffect(() => {
    if (age !== "") {
      const isChild = Number(age) < 15;
      setFactors((prev) => ({ ...prev, child_under_15: isChild }));
    }
  }, [age]);

  // Load from editId if present
  useEffect(() => {
    const id = searchParams.get("editId");
    if (id) {
      loadRecordForEdit(id);
    }
  }, [searchParams]);

  async function loadRecordForEdit(id: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fall_risk_screenings")
        .select("*, patients(id, full_name, mrn, gender, age)")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setEditId(data.id);
        setPatientId(data.patient_id);
        setPatientName(data.patients?.full_name || "");
        setMrn(data.patients?.mrn || "");
        setGender(normalizeGender(data.gender || data.patients?.gender));
        setAge(data.age || data.patients?.age || "");
        setFactors({
          gait_disturbance: data.gait_disturbance || false,
          use_mobility_aids: data.use_mobility_aids || false,
          bed_ridden: data.bed_ridden || false,
          mental_disability: data.mental_disability || false,
          sensory_impairment: data.sensory_impairment || false,
          child_under_15: data.child_under_15 || false,
        });
        setFBadgeApplied(data.f_badge_applied !== undefined ? data.f_badge_applied : true);
        setWheelchairUsed(data.wheelchair_used || false);
        setEducationProvided(data.education_provided !== undefined ? data.education_provided : true);
        setScreenerSignature(data.screener_signature || "");
        if (data.screening_date) setScreeningDate(data.screening_date);
        if (data.screening_time) setScreeningTime(formatTime12(data.screening_time));
        setIsLocked(false);
      }
    } catch (err: any) {
      setErrorMsg("تعذر تحميل بيانات السجل للتعديل: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchPatientByMrn(searchMrn: string) {
    const cleanMrn = searchMrn ? searchMrn.trim() : "";
    if (!cleanMrn || editId) return;
    try {
      const { data: patient, error } = await supabase
        .from("patients")
        .select("*")
        .ilike("mrn", cleanMrn)
        .maybeSingle();

      if (patient) {
        setPatientId(patient.id);
        setPatientName(patient.full_name || "");

        let resolvedGender = normalizeGender(patient.gender);
        let resolvedAge = (patient.age !== null && patient.age !== undefined && patient.age !== "") ? patient.age : null;

        // Fallback search across past tables if gender or age is missing
        if (!resolvedGender || resolvedAge === null) {
          const [screenLogsRes, assessRes, fallAdultRes, fallPedRes, radRes] = await Promise.all([
            supabase.from("fall_risk_screenings").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("patient_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_adult_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_pediatric_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("radiation_exposure_logs").select("age").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
          ]);

          if (!resolvedGender) {
            const cand = screenLogsRes.data?.[0]?.gender || assessRes.data?.[0]?.gender || fallAdultRes.data?.[0]?.gender || fallPedRes.data?.[0]?.gender;
            resolvedGender = normalizeGender(cand);
          }

          if (resolvedAge === null) {
            const candAge = screenLogsRes.data?.[0]?.age || assessRes.data?.[0]?.age || fallAdultRes.data?.[0]?.age || fallPedRes.data?.[0]?.age || radRes.data?.[0]?.age;
            if (candAge !== null && candAge !== undefined && candAge !== "") {
              resolvedAge = candAge;
            }
          }
        }

        if (resolvedGender) {
          setGender(resolvedGender);
        }
        if (resolvedAge !== null) {
          setAge(resolvedAge);
        }
      }
    } catch (err) {
      console.error("searchPatientByMrn error:", err);
    }
  }

  function validateForm() {
    const errors: { [key: string]: string } = {};
    if (!mrn.trim()) errors.mrn = "رقم الملف الطبي مطلوب";
    if (!patientName.trim()) errors.patientName = "اسم المريض رباعي مطلوب";
    if (!gender) errors.gender = "يرجى تحديد الجنس";
    if (age === "" || Number(age) < 0) errors.age = "يرجى تحديد السن";
    if (!screenerSignature.trim()) errors.screenerSignature = "توقيع القائم بالمسح مطلوب";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!validateForm()) {
      setErrorMsg("يرجى استكمال البيانات الإجبارية الموضحة باللون الأحمر.");
      return;
    }

    setLoading(true);

    try {
      // 1. Ensure Patient Record
      let currentPid = patientId;
      if (!currentPid) {
        const { data: newPatient, error: pError } = await supabase
          .from("patients")
          .upsert(
            {
              mrn: mrn.trim(),
              full_name: patientName.trim(),
              gender: gender || null,
              age: age !== "" ? Number(age) : null,
            },
            { onConflict: "mrn" }
          )
          .select()
          .single();

        if (pError) throw new Error(`خطأ بيانات المريض: ${pError.message}`);
        currentPid = newPatient.id;
        setPatientId(currentPid);
      } else {
        await supabase
          .from("patients")
          .update({
            full_name: patientName.trim(),
            mrn: mrn.trim(),
            gender: gender || null,
            age: age !== "" ? Number(age) : null,
          })
          .eq("id", currentPid);
      }

      const payloadData = {
        mrn,
        patient_name: patientName,
        gender,
        age: Number(age),
        factors,
        has_any_risk: hasAnyRisk,
        actions: {
          f_badge_applied: fBadgeApplied,
          wheelchair_used: wheelchairUsed,
          education_provided: educationProvided,
        },
        screener_signature: screenerSignature,
        screening_date: screeningDate,
        screening_time: screeningTime,
      };

      if (editId) {
        // UPDATE EXISTING
        const { error: updateErr } = await supabase
          .from("fall_risk_screenings")
          .update({
            gender,
            age: Number(age),
            gait_disturbance: factors.gait_disturbance,
            use_mobility_aids: factors.use_mobility_aids,
            bed_ridden: factors.bed_ridden,
            mental_disability: factors.mental_disability,
            sensory_impairment: factors.sensory_impairment,
            child_under_15: factors.child_under_15,
            is_high_risk: hasAnyRisk,
            f_badge_applied: fBadgeApplied,
            wheelchair_used: wheelchairUsed,
            education_provided: educationProvided,
            screener_signature: screenerSignature,
            screening_date: screeningDate,
            screening_time: sanitizeSqlTime(screeningTime),
          })
          .eq("id", editId);

        if (updateErr) throw new Error(`خطأ تحديث المسح: ${updateErr.message}`);

        playSuccessSound();
        setLastSavedRecord({
          id: editId,
          patientName,
          mrn,
          isHighRisk: hasAnyRisk,
        });
        setIsLocked(true);
      } else {
        // INSERT NEW
        const { data: template } = await supabase
          .from("form_templates")
          .select("id")
          .eq("code", "TRC_MRS_FALL_SCREEN")
          .single();

        let submissionId = null;
        if (template) {
          const { data: subData } = await supabase
            .from("form_submissions")
            .insert({
              patient_id: currentPid,
              template_id: template.id,
              form_code: "TRC_MRS_FALL_SCREEN",
              data: payloadData,
            })
            .select()
            .single();

          if (subData) submissionId = subData.id;
        }

        const { data: savedScreening, error: sErr } = await supabase
          .from("fall_risk_screenings")
          .insert({
            submission_id: submissionId,
            patient_id: currentPid,
            gender,
            age: Number(age),
            gait_disturbance: factors.gait_disturbance,
            use_mobility_aids: factors.use_mobility_aids,
            bed_ridden: factors.bed_ridden,
            mental_disability: factors.mental_disability,
            sensory_impairment: factors.sensory_impairment,
            child_under_15: factors.child_under_15,
            is_high_risk: hasAnyRisk,
            f_badge_applied: fBadgeApplied,
            wheelchair_used: wheelchairUsed,
            education_provided: educationProvided,
            screener_signature: screenerSignature,
            screening_date: screeningDate,
            screening_time: sanitizeSqlTime(screeningTime),
          })
          .select()
          .single();

        if (sErr) throw new Error(`خطأ حفظ المسح: ${sErr.message}`);

        playSuccessSound();
        setEditId(savedScreening?.id || submissionId);
        setLastSavedRecord({
          id: savedScreening?.id || submissionId,
          patientName,
          mrn,
          isHighRisk: hasAnyRisk,
        });
        setIsLocked(true);
      }

      setFieldErrors({});
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ أثناء الحفظ.");
    } finally {
      setLoading(false);
    }
  }

  function handleNewForm() {
    setLastSavedRecord(null);
    setIsLocked(false);
    setEditId(null);
    setMrn("");
    setPatientName("");
    setPatientId(null);
    setGender("");
    setAge("");
    setFactors({
      gait_disturbance: false,
      use_mobility_aids: false,
      bed_ridden: false,
      mental_disability: false,
      sensory_impairment: false,
      child_under_15: false,
    });
    setFBadgeApplied(false);
    setWheelchairUsed(false);
    setEducationProvided(false);
    setScreenerSignature("");
    setScreeningDate(getCurrentDate());
    setScreeningTime(getCurrentTimeShort());
    setFieldErrors({});
    setErrorMsg("");
    setTimeout(() => mrnInputRef.current?.focus(), 50);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16 px-2 sm:px-0">
      {/* Top Header Card */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-3xl border border-purple-100 shadow-sm no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white p-0.5 shadow-sm border border-purple-200 flex items-center justify-center shrink-0">
            <img src="/tiba-scan.jpg" alt="Tiba Scan" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-[#481454]">
                المسح (الفحص المبدئي) لخطر السقوط
              </h2>
              <span className="bg-purple-50 text-purple-900 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-purple-200">
                TRC.MRS
              </span>
            </div>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • Fall Risk Screening</p>
          </div>
        </div>

        {editId && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
            {isLocked ? "تم الحفظ والتوثيق" : "وضع التعديل"}
          </span>
        )}
      </div>

      {/* Error Box */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm no-print">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Main Interactive Form */}
      <form onSubmit={handleSubmit} className="space-y-5 no-print">
        {/* SECTION 1: Patient Header */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم الملف الطبي <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={mrnInputRef}
                  type="text"
                  disabled={isLocked}
                  value={mrn}
                  onChange={(e) => {
                    setMrn(e.target.value);
                    searchPatientByMrn(e.target.value);
                  }}
                  placeholder="رقم الملف الطبي..."
                  className={`w-full pl-9 pr-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm font-mono transition-all ${
                    isLocked
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : fieldErrors.mrn
                      ? "border-rose-400 bg-rose-50/40"
                      : "border-slate-300 focus:border-[#1d8a98] focus:ring-2 focus:ring-[#1d8a98]/20"
                  }`}
                />
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              </div>
              {fieldErrors.mrn && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.mrn}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم المريض رباعي <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="اسم المريض رباعي..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.patientName
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-[#1d8a98] focus:ring-2 focus:ring-[#1d8a98]/20"
                }`}
              />
              {fieldErrors.patientName && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.patientName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Gender */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الجنس <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                {["ذكر", "انثي"].map((g) => {
                  const isSelected = normalizeGender(gender) === normalizeGender(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setGender(normalizeGender(g))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border ${
                        isSelected
                          ? "bg-[#1d8a98] text-white border-[#1d8a98] shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-white bg-white" : "border-slate-400"
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#1d8a98]"></span>}
                      </span>
                      <span>{g}</span>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.gender && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.gender}</p>
              )}
            </div>

            {/* Age */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                السن <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                disabled={isLocked}
                value={age}
                onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
                placeholder="السن بالسنوات..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.age
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-[#1d8a98] focus:ring-2 focus:ring-[#1d8a98]/20"
                }`}
              />
              {fieldErrors.age && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.age}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: Screening Checklist */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                ضع علامة ( ✓ ) إذا كان المريض يعاني من أحد عوامل الخطورة التالية:
              </h3>
              <p className="text-[11px] text-slate-500">Fall Risk Screening Checklist</p>
            </div>
            {hasAnyRisk ? (
              <span className="bg-rose-100 text-rose-800 text-xs font-bold px-3 py-1 rounded-full border border-rose-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>مريض عالي الخطورة (F)</span>
              </span>
            ) : (
              <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>خطر منخفض / عادي</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RISK_FACTORS.map((rf) => {
              const isChecked = !!factors[rf.id];
              return (
                <div
                  key={rf.id}
                  onClick={() => {
                    if (isLocked) return;
                    setFactors((prev) => ({ ...prev, [rf.id]: !prev[rf.id] }));
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                    isChecked
                      ? "bg-amber-50/70 border-amber-300 text-amber-950 shadow-xs"
                      : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100"
                  } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className="accent-amber-600 w-4 h-4 rounded mt-0.5 pointer-events-none shrink-0"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold block">{rf.label_ar}</span>
                    <span className="text-[11px] text-slate-500 font-medium block">{rf.label_en}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fall Risk Interventions Banner */}
          {hasAnyRisk && (
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border-2 border-amber-300 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-amber-950">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>في حالة وجود أي من عوامل الخطورة السابقة يتم عمل الآتي فوراً:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <label className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-amber-200 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isLocked}
                    checked={fBadgeApplied}
                    onChange={(e) => setFBadgeApplied(e.target.checked)}
                    className="accent-amber-600 w-4 h-4 rounded"
                  />
                  <span>وضع حرف (F) للمريض</span>
                </label>

                <label className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-amber-200 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isLocked}
                    checked={wheelchairUsed}
                    onChange={(e) => setWheelchairUsed(e.target.checked)}
                    className="accent-amber-600 w-4 h-4 rounded"
                  />
                  <span>استخدام كرسي متحرك للمريض</span>
                </label>

                <label className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-amber-200 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isLocked}
                    checked={educationProvided}
                    onChange={(e) => setEducationProvided(e.target.checked)}
                    className="accent-amber-600 w-4 h-4 rounded"
                  />
                  <span>تثقيف صحي للوقاية من السقوط</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Signatures & Timestamp */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                توقيع القائم بالمسح <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled={isLocked}
                  value={screenerSignature}
                  onChange={(e) => setScreenerSignature(e.target.value)}
                  placeholder="اسم وتوقيع القائم بالمسح..."
                  className={`w-full pl-9 pr-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                    isLocked
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : fieldErrors.screenerSignature
                      ? "border-rose-400 bg-rose-50/40"
                      : "border-slate-300 focus:border-[#1d8a98] focus:ring-2 focus:ring-[#1d8a98]/20"
                  }`}
                />
                <UserCheck className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              </div>
              {fieldErrors.screenerSignature && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.screenerSignature}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">التاريخ</label>
              <div className="relative">
                <input
                  type="date"
                  disabled={isLocked}
                  value={screeningDate}
                  onChange={(e) => setScreeningDate(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl outline-none text-xs sm:text-sm bg-white"
                />
                <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الوقت</label>
              <div className="relative">
                <input
                  type="text"
                  disabled={isLocked}
                  value={screeningTime}
                  onChange={(e) => setScreeningTime(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 border border-slate-300 rounded-xl outline-none text-xs sm:text-sm bg-white font-mono"
                />
                <Clock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION AREA */}
        {!isLocked ? (
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1d8a98] hover:bg-[#167480] text-white font-bold text-sm px-8 py-3 rounded-xl transition-all shadow-md shadow-[#1d8a98]/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editId ? "حفظ وتوثيق التعديلات" : "حفظ وتوثيق مسح خطر السقوط"}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-emerald-950">
                تم الحفظ والتوثيق بنجاح! ({lastSavedRecord?.patientName || patientName})
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>طباعة</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLocked(false)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
              >
                <Pencil className="w-4 h-4 text-amber-700" />
                <span>تعديل</span>
              </button>

              <button
                type="button"
                onClick={handleNewForm}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-[#1d8a98] hover:bg-[#167480] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إدخال فحص جديد</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* PRINT VIEW SHEET (100% MATCHING المسح (الفحص المبدئي) لخطر السقوط.pdf) */}
      <div className="hidden print:block bg-white p-4 text-black font-sans">
        <div className="flex justify-between items-center pb-2 mb-2 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <img src="/tiba-scan.jpg" alt="Tiba Scan" className="h-11 w-auto object-contain" />
            <div className="text-right">
              <h2 className="text-sm font-bold">Tiba Scan Radiology Center</h2>
              <h3 className="text-xs font-bold">مركز طيبة سكان للأشعة</h3>
            </div>
          </div>
          <div className="border border-black px-2 py-0.5 font-bold text-xs font-mono">
            TRC.MRS
          </div>
        </div>

        <div className="flex justify-between items-center text-xs font-bold py-2 mb-1 border-b border-black">
          <div>
            اسم المريض رباعي :{" "}
            <span className="font-normal underline mr-1">
              {patientName || "......................................................."}
            </span>
          </div>
          <div>
            رقم الملف الطبي :{" "}
            <span className="font-normal underline mr-1">
              {mrn || "......................................................."}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs font-bold py-1.5 mb-2 border-b border-black">
          <div>
            الجنس :{" "}
            <span className="mr-3 font-normal">
              {gender === "ذكر" ? "■" : "□"} ذكر
            </span>
            <span className="mr-3 font-normal">
              {gender === "انثي" ? "■" : "□"} انثي
            </span>
          </div>
          <div>
            السن : <span className="font-normal underline mr-1">{age || "........."}</span>
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
            {RISK_FACTORS.map((rf) => (
              <div key={rf.id} className="flex items-start gap-2">
                <span className="font-bold font-mono text-sm">
                  {factors[rf.id] ? "☑" : "☐"}
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
            توقيع القائم بالمسح: <span className="font-normal underline">{screenerSignature || "...................."}</span>
          </div>
          <div>
            التاريخ: <span className="font-normal underline">{screeningDate}</span>
          </div>
          <div>
            الوقت: <span className="font-normal underline">{screeningTime}</span>
          </div>
        </div>

        <div className="text-center text-xs font-mono font-bold mt-8 pt-2 border-t border-black">
          TRC.MRS
        </div>
      </div>
    </div>
  );
}

export default function FallRiskScreeningPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">جاري التحميل...</div>}>
      <FallRiskScreeningContent />
    </Suspense>
  );
}
