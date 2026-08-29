"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  PlusCircle,
  Pencil,
  UserCheck,
  Calendar,
  Clock,
  Activity,
  ShieldAlert,
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

const DIRECT_HIGH_RISK_FACTORS = [
  { id: "bed_ridden", label: "مريض ملازم للفراش" },
  { id: "physical_disability", label: "وجود إعاقة جسدية" },
  { id: "mental_disability", label: "وجود إعاقة ذهنية" },
  { id: "anesthesia_first_24h", label: "مريض في أول 24 ساعة من التخدير" },
];

const PROTECTIVE_INTERVENTIONS = [
  "تمييز المريض بوضع سلسلة عليها حرف F",
  "رفع جوانب الترولي أو إمداد المريض بأجهزة المساعدة علي المشي مثل الكرسي المتحرك.",
  "التنبيه علي المريض بطلب المساعدة أثناء المشي والتنقل و دخول الحمام.",
  "تشجيع المريض علي استخدام سندات الحوائط اثناء السير.",
  "التأكد من احتياطات سالمة البيئة (جفاف األرض، عدم وجود عوائق.)",
  "التنبيه علي المريض بعدم اللجوء إلي حركات فجائية عند تغيير الوضع من النوم إلي الوقوف أو الجلوس.",
  "التنبيه علي المريض بعدم الانحناء لالتقاط أي شيء علي الأرض",
  "تثقيف المريض و أو ذويه حول الإجراءات المانعة للسقوط",
];

function normalizeGender(val: any): "ذكر" | "انثي" | "" {
  if (!val) return "";
  const cleaned = String(val).trim().toLowerCase();
  if (cleaned.includes("ذكر") || cleaned === "male" || cleaned === "m") return "ذكر";
  if (cleaned.includes("أنث") || cleaned.includes("انث") || cleaned.includes("أنثى") || cleaned.includes("انثى") || cleaned === "female" || cleaned === "f") return "انثي";
  return "";
}

function FallRiskAdultContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const mrnInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<any | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Patient Info
  const [mrn, setMrn] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [gender, setGender] = useState<"ذكر" | "انثي" | "">("");
  const [age, setAge] = useState<number | "">("");

  // Direct High Risk Factors (Without assessment)
  const [directFactors, setDirectFactors] = useState<{ [key: string]: boolean }>({
    bed_ridden: false,
    physical_disability: false,
    mental_disability: false,
    anesthesia_first_24h: false,
  });

  // Hendrich II Criteria
  const [confusion, setConfusion] = useState(false); // 4 pts
  const [depression, setDepression] = useState(false); // 2 pts
  const [alteredElimination, setAlteredElimination] = useState(false); // 1 pt
  const [dizziness, setDizziness] = useState(false); // 1 pt
  const [antiepileptics, setAntiepileptics] = useState(false); // 2 pts
  const [antidepressants, setAntidepressants] = useState(false); // 1 pt
  const [getUpAndGo, setGetUpAndGo] = useState<number | null>(null); // 0, 1, 3, or 4 (null initially)

  // Applied Interventions
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);

  // Signatures
  const [assessorSignature, setAssessorSignature] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(() => getCurrentDate());
  const [assessmentTime, setAssessmentTime] = useState(() => getCurrentTimeShort());

  // Auto-calculated Male point
  const maleScore = gender === "ذكر" ? 1 : 0;

  // Calculate Total Score
  const totalScore = useMemo(() => {
    let score = 0;
    if (confusion) score += 4;
    if (depression) score += 2;
    if (alteredElimination) score += 1;
    if (dizziness) score += 1;
    score += maleScore;
    if (antiepileptics) score += 2;
    if (antidepressants) score += 1;
    if (getUpAndGo !== null) score += Number(getUpAndGo);
    return score;
  }, [confusion, depression, alteredElimination, dizziness, maleScore, antiepileptics, antidepressants, getUpAndGo]);

  const hasDirectHighRisk = Object.values(directFactors).some(Boolean);
  const isHighRisk = hasDirectHighRisk || totalScore >= 5;

  // PDF Rule: When patient is high risk, automatically select all required protective interventions
  useEffect(() => {
    if (isHighRisk) {
      setSelectedInterventions(PROTECTIVE_INTERVENTIONS);
    } else if (!editId) {
      setSelectedInterventions([]);
    }
  }, [isHighRisk, editId]);

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
        .from("fall_risk_adult_assessments")
        .select("*, patients(id, full_name, mrn, gender, age)")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setEditId(data.id);
        setPatientId(data.patient_id);
        setPatientName(data.patients?.full_name || "");
        setMrn(data.patients?.mrn || "");
        setGender((data.gender || data.patients?.gender || "") as any);
        setAge(data.age || data.patients?.age || "");
        setDirectFactors({
          bed_ridden: data.bed_ridden || false,
          physical_disability: data.physical_disability || false,
          mental_disability: data.mental_disability || false,
          anesthesia_first_24h: data.anesthesia_first_24h || false,
        });
        setConfusion(data.confusion_disorientation_score > 0);
        setDepression(data.symptomatic_depression_score > 0);
        setAlteredElimination(data.altered_elimination_score > 0);
        setDizziness(data.dizziness_vertigo_score > 0);
        setAntiepileptics(data.antiepileptics_sedatives_score > 0);
        setAntidepressants(data.antidepressants_score > 0);
        setGetUpAndGo(data.get_up_and_go_score || 0);
        if (data.interventions && Array.isArray(data.interventions)) {
          setSelectedInterventions(data.interventions);
        }
        setAssessorSignature(data.assessor_signature || "");
        if (data.assessment_date) setAssessmentDate(data.assessment_date);
        if (data.assessment_time) setAssessmentTime(formatTime12(data.assessment_time));
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
          const [assessRes, fallScreenRes, fallPedRes, radRes] = await Promise.all([
            supabase.from("patient_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_screenings").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_pediatric_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("radiation_exposure_logs").select("age").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
          ]);

          if (!resolvedGender) {
            const cand = assessRes.data?.[0]?.gender || fallScreenRes.data?.[0]?.gender || fallPedRes.data?.[0]?.gender;
            resolvedGender = normalizeGender(cand);
          }

          if (resolvedAge === null) {
            const candAge = assessRes.data?.[0]?.age || fallScreenRes.data?.[0]?.age || fallPedRes.data?.[0]?.age || radRes.data?.[0]?.age;
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
    if (age === "" || Number(age) < 0) errors.age = "السن مطلوب";
    if (!assessorSignature.trim()) errors.assessorSignature = "توقيع القائم بالتقييم مطلوب";

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
        direct_factors: directFactors,
        has_direct_high_risk: hasDirectHighRisk,
        criteria: {
          confusion_disorientation: confusion,
          symptomatic_depression: depression,
          altered_elimination: alteredElimination,
          dizziness_vertigo: dizziness,
          male_gender: maleScore > 0,
          antiepileptics_sedatives: antiepileptics,
          antidepressants: antidepressants,
          get_up_and_go: getUpAndGo,
        },
        total_score: totalScore,
        is_high_risk: isHighRisk,
        interventions: selectedInterventions,
        assessor_signature: assessorSignature,
        assessment_date: assessmentDate,
        assessment_time: assessmentTime,
      };

      if (editId) {
        const { error: updateErr } = await supabase
          .from("fall_risk_adult_assessments")
          .update({
            gender,
            age: Number(age),
            assessment_date: assessmentDate,
            assessment_time: sanitizeSqlTime(assessmentTime),
            bed_ridden: directFactors.bed_ridden,
            physical_disability: directFactors.physical_disability,
            mental_disability: directFactors.mental_disability,
            anesthesia_first_24h: directFactors.anesthesia_first_24h,
            confusion_disorientation_score: confusion ? 4 : 0,
            symptomatic_depression_score: depression ? 2 : 0,
            altered_elimination_score: alteredElimination ? 1 : 0,
            dizziness_vertigo_score: dizziness ? 1 : 0,
            male_gender_score: maleScore,
            antiepileptics_sedatives_score: antiepileptics ? 2 : 0,
            antidepressants_score: antidepressants ? 1 : 0,
            get_up_and_go_score: getUpAndGo,
            total_score: totalScore,
            is_high_risk: isHighRisk,
            interventions: selectedInterventions,
            assessor_signature: assessorSignature,
          })
          .eq("id", editId);

        if (updateErr) throw new Error(`خطأ تحديث التقييم: ${updateErr.message}`);

        playSuccessSound();
        setLastSavedRecord({
          id: editId,
          patientName,
          mrn,
          score: totalScore,
          isHighRisk,
        });
        setIsLocked(true);
      } else {
        const { data: template } = await supabase
          .from("form_templates")
          .select("id")
          .eq("code", "TRC_ICD_FALL_ADULT")
          .single();

        let submissionId = null;
        if (template) {
          const { data: subData } = await supabase
            .from("form_submissions")
            .insert({
              patient_id: currentPid,
              template_id: template.id,
              form_code: "TRC_ICD_FALL_ADULT",
              data: payloadData,
            })
            .select()
            .single();

          if (subData) submissionId = subData.id;
        }

        const { data: savedAssessment, error: aErr } = await supabase
          .from("fall_risk_adult_assessments")
          .insert({
            submission_id: submissionId,
            patient_id: currentPid,
            gender,
            age: Number(age),
            assessment_date: assessmentDate,
            assessment_time: sanitizeSqlTime(assessmentTime),
            bed_ridden: directFactors.bed_ridden,
            physical_disability: directFactors.physical_disability,
            mental_disability: directFactors.mental_disability,
            anesthesia_first_24h: directFactors.anesthesia_first_24h,
            confusion_disorientation_score: confusion ? 4 : 0,
            symptomatic_depression_score: depression ? 2 : 0,
            altered_elimination_score: alteredElimination ? 1 : 0,
            dizziness_vertigo_score: dizziness ? 1 : 0,
            male_gender_score: maleScore,
            antiepileptics_sedatives_score: antiepileptics ? 2 : 0,
            antidepressants_score: antidepressants ? 1 : 0,
            get_up_and_go_score: getUpAndGo,
            total_score: totalScore,
            is_high_risk: isHighRisk,
            interventions: selectedInterventions,
            assessor_signature: assessorSignature,
          })
          .select()
          .single();

        if (aErr) throw new Error(`خطأ حفظ التقييم: ${aErr.message}`);

        playSuccessSound();
        setEditId(savedAssessment?.id || submissionId);
        setLastSavedRecord({
          id: savedAssessment?.id || submissionId,
          patientName,
          mrn,
          score: totalScore,
          isHighRisk,
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
    setDirectFactors({
      bed_ridden: false,
      physical_disability: false,
      mental_disability: false,
      anesthesia_first_24h: false,
    });
    setConfusion(false);
    setDepression(false);
    setAlteredElimination(false);
    setDizziness(false);
    setAntiepileptics(false);
    setAntidepressants(false);
    setGetUpAndGo(null);
    setSelectedInterventions([]);
    setAssessorSignature("");
    setAssessmentDate(getCurrentDate());
    setAssessmentTime(getCurrentTimeShort());
    setFieldErrors({});
    setErrorMsg("");
    setTimeout(() => mrnInputRef.current?.focus(), 50);
  }

  function toggleIntervention(item: string) {
    if (isLocked) return;
    setSelectedInterventions((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16 px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-slate-200/80 shadow-xs no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                تقييم مخاطر السقوط للكبار (Hendrich II)
              </h2>
              <span className="bg-slate-100 text-slate-600 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-slate-200">
                TRC-ICD
              </span>
            </div>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • Hendrich II Fall Risk Assessment</p>
          </div>
        </div>

        {editId && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
            {isLocked ? "تم الحفظ والتوثيق" : "وضع التعديل"}
          </span>
        )}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm no-print">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5 no-print">
        {/* SECTION 1: Patient Details */}
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
                      : "border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
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
                    : "border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                }`}
              />
              {fieldErrors.patientName && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.patientName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
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
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-white bg-white" : "border-slate-400"
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>}
                      </span>
                      <span>{g} {g === "ذكر" && "(+1 نقطة)"}</span>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.gender && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.gender}</p>
              )}
            </div>

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
                    : "border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                }`}
              />
              {fieldErrors.age && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.age}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: Direct High Risk Factors (Without evaluation) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              في حالة وجود أحد عوامل الخطورة التالية يكون المريض معرض لخطر السقوط دون تقييم:
            </h3>
            <p className="text-[11px] text-slate-500">Direct High Risk Criteria</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DIRECT_HIGH_RISK_FACTORS.map((df) => {
              const isChecked = directFactors[df.id];
              return (
                <div
                  key={df.id}
                  onClick={() => {
                    if (isLocked) return;
                    setDirectFactors((prev) => ({ ...prev, [df.id]: !prev[df.id] }));
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 select-none ${
                    isChecked
                      ? "bg-rose-50 border-rose-300 text-rose-950 font-bold shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className="accent-rose-600 w-4 h-4 rounded pointer-events-none shrink-0"
                  />
                  <span className="text-xs">{df.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: Hendrich II Fall Risk Scoring Matrix */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                تقييم عوامل درجات الخطر (Hendrich II Risk Factors)
              </h3>
              <p className="text-[11px] text-slate-500">حساب النقاط تلقائياً (الحد الفاصل للخطورة: 5 نقاط فأكثر)</p>
            </div>

            {/* Live Score KPI */}
            <div className="flex items-center gap-3">
              <div
                className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-xs sm:text-sm shadow-xs border ${
                  isHighRisk
                    ? "bg-rose-600 text-white border-rose-600 animate-pulse"
                    : "bg-emerald-50 text-emerald-800 border-emerald-300"
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>إجمالي درجات التقييم: {totalScore} نقاط</span>
                <span className="text-[11px] font-normal">
                  {isHighRisk ? "(عالي مخاطر السقوط ⚠️)" : "(خطر منخفض ✓)"}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">عامل الخطورة (Risk Factor)</th>
                  <th className="p-3 w-28 text-center">درجة الخطر</th>
                  <th className="p-3 w-28 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {/* 1. Confusion */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3">
                    <p className="font-bold text-slate-900">
                      ارتباك / عدم الدراية بالزمان أو المكان أو الأشخاص / اضطراب سلوك اندفاعي / هلاوس / اضطراب في الوعي / اضطراب في النوم / عدم القدرة علي تنفيذ التعليمات
                    </p>
                    <p className="text-[11px] text-slate-500">Confusion / Disorientation / Impulsivity</p>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800">4 نقاط</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setConfusion(!confusion)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        confusion
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {confusion ? "نعم (+4)" : "لا (0)"}
                    </button>
                  </td>
                </tr>

                {/* 2. Symptomatic Depression */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3">
                    <p className="font-bold text-slate-900">علامات اكتئاب (فقدان أمل / حزين / غير متفاعل / باكي)</p>
                    <p className="text-[11px] text-slate-500">Symptomatic Depression</p>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800">2 نقطتان</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setDepression(!depression)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        depression
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {depression ? "نعم (+2)" : "لا (0)"}
                    </button>
                  </td>
                </tr>

                {/* 3. Altered Elimination */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3">
                    <p className="font-bold text-slate-900">اضطراب في الإخراج (تبول لا إرادي / التبول الليلي / إسهال)</p>
                    <p className="text-[11px] text-slate-500">Altered Elimination</p>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800">1 نقطة</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setAlteredElimination(!alteredElimination)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        alteredElimination
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {alteredElimination ? "نعم (+1)" : "لا (0)"}
                    </button>
                  </td>
                </tr>

                {/* 4. Dizziness / Vertigo */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3">
                    <p className="font-bold text-slate-900">دوخة / دوار</p>
                    <p className="text-[11px] text-slate-500">Dizziness / Vertigo</p>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800">1 نقطة</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setDizziness(!dizziness)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        dizziness
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {dizziness ? "نعم (+1)" : "لا (0)"}
                    </button>
                  </td>
                </tr>

                {/* 5. Male Gender */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3">
                    <p className="font-bold text-slate-900">نوع المريض ذكر</p>
                    <p className="text-[11px] text-slate-500">Gender (Male)</p>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800">1 نقطة</td>
                  <td className="p-3 text-center font-bold">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs ${
                        maleScore > 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {maleScore > 0 ? "نعم (+1)" : "لا (0)"}
                    </span>
                  </td>
                </tr>

                {/* 6. Antiepileptics / Sedatives */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3">
                    <p className="font-bold text-slate-900">
                      تعاطي أي أدوية مضادة للصرع، أدوية مهدئة، مخدرة، مدرة للبول
                    </p>
                    <p className="text-[11px] text-slate-500">Any administered antiepileptics / sedatives / diuretics</p>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800">2 نقطتان</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setAntiepileptics(!antiepileptics)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        antiepileptics
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {antiepileptics ? "نعم (+2)" : "لا (0)"}
                    </button>
                  </td>
                </tr>

                {/* 7. Antidepressants */}
                <tr className="hover:bg-slate-50">
                  <td className="p-3">
                    <p className="font-bold text-slate-900">تعاطي أي أدوية مضادة للاكتئاب</p>
                    <p className="text-[11px] text-slate-500">Any administered antidepressant</p>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-800">1 نقطة</td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setAntidepressants(!antidepressants)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        antidepressants
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {antidepressants ? "نعم (+1)" : "لا (0)"}
                    </button>
                  </td>
                </tr>

                {/* 8. Get Up and Go Test */}
                <tr className="bg-slate-50/60">
                  <td colSpan={3} className="p-3">
                    <div className="space-y-2">
                      <p className="font-bold text-slate-900">
                        اختبار النهوض من الكرسي (Get Up and Go Test: Rising From a Chair):
                      </p>
                      <p className="text-[11px] text-slate-600">
                        يتم عمل هذا الاختبار لمريض جالس على كرسي أو على طرف سرير ويطلب منه الوقوف بدون مساعدة:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {[
                          { score: 0, text: "القدرة علي النهوض بحركة واحدة – دون فقدان التوازن بالخطوات", sub: "Ability to rise in a single movement – no loss of balance" },
                          { score: 1, text: "يدفع لأعلي، ناجحاً في محاولة واحدة", sub: "Pushes up, successful in one attempt" },
                          { score: 3, text: "محاولات متعددة لكنها ناجحة", sub: "Multiple attempts, but successful" },
                          { score: 4, text: "عدم القدرة علي النهوض دون مساعدة أثناء الاختبار", sub: "Unable to rise without assistance during test" },
                        ].map((opt) => {
                          const isSelected = getUpAndGo === opt.score;
                          return (
                            <button
                              key={opt.score}
                              type="button"
                              disabled={isLocked}
                              onClick={() => setGetUpAndGo(opt.score)}
                              className={`p-3 rounded-xl border text-right transition-all flex items-start justify-between gap-2 ${
                                isSelected
                                  ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              <div className="space-y-0.5">
                                <span className="text-xs font-bold block">{opt.text}</span>
                                <span className={`text-[10px] block ${isSelected ? "text-rose-100" : "text-slate-400"}`}>
                                  {opt.sub}
                                </span>
                              </div>
                              <span className="font-bold text-xs shrink-0 px-2 py-0.5 bg-black/10 rounded">
                                +{opt.score}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: High Risk Interventions Checklist */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                الإجراءات اللازمة لحماية المريض من خطر السقوط
              </h3>
              <p className="text-[11px] text-slate-500">Protective Fall Prevention Interventions</p>
            </div>
            <span className="text-xs text-slate-500 font-bold">
              {selectedInterventions.length} إجراءات محددة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {PROTECTIVE_INTERVENTIONS.map((item, idx) => {
              const isChecked = selectedInterventions.includes(item);
              return (
                <div
                  key={idx}
                  onClick={() => toggleIntervention(item)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                    isChecked
                      ? "bg-rose-50/70 border-rose-300 text-rose-950 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className="accent-rose-600 w-4 h-4 rounded mt-0.5 pointer-events-none shrink-0"
                  />
                  <span className="text-xs font-semibold leading-relaxed">{item}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 5: Signatures & Timestamp */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                توقيع القائم بالتقييم <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled={isLocked}
                  value={assessorSignature}
                  onChange={(e) => setAssessorSignature(e.target.value)}
                  placeholder="اسم وتوقيع القائم بالتقييم..."
                  className={`w-full pl-9 pr-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                    isLocked
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : fieldErrors.assessorSignature
                      ? "border-rose-400 bg-rose-50/40"
                      : "border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                  }`}
                />
                <UserCheck className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              </div>
              {fieldErrors.assessorSignature && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.assessorSignature}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">التاريخ</label>
              <div className="relative">
                <input
                  type="date"
                  disabled={isLocked}
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
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
                  value={assessmentTime}
                  onChange={(e) => setAssessmentTime(e.target.value)}
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
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm px-8 py-3 rounded-xl transition-all shadow-md shadow-rose-600/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editId ? "حفظ وتوثيق التعديلات" : "حفظ وتوثيق تقييم مخاطر السقوط"}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-emerald-950">
                تم حفظ التقييم بنجاح! ({lastSavedRecord?.patientName || patientName} - المجموع: {totalScore})
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
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إدخال تقييم جديد</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* PRINT VIEW SHEET (100% MATCHING تقييم مخاطر السقوط للكبار.pdf) */}
      <div className="hidden print:block bg-white p-4 text-black font-sans">
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

        <div className="flex justify-between items-center text-xs font-bold py-1 mb-2 border-b border-black">
          <div>
            الجنس :{" "}
            <span className="mr-3 font-normal">{gender === "ذكر" ? "■" : "□"} ذكر</span>
            <span className="mr-3 font-normal">{gender === "انثي" ? "■" : "□"} انثي</span>
          </div>
          <div>
            السن : <span className="font-normal underline mr-1">{age || "........."}</span>
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
            <div>{directFactors.bed_ridden ? "■" : "□"} مريض ملازم للفراش</div>
            <div>{directFactors.physical_disability ? "■" : "□"} وجود إعاقة جسدية</div>
            <div>{directFactors.mental_disability ? "■" : "□"} وجود إعاقة ذهنية</div>
            <div>{directFactors.anesthesia_first_24h ? "■" : "□"} مريض في أول 24 ساعة من التخدير</div>
          </div>
        </div>

        {/* Scored Matrix Table */}
        <table className="w-full border-collapse border border-black text-center text-[10px] mb-2">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black">
              <th className="border border-black p-1 text-right">عامل الخطورة (Risk Factor)</th>
              <th className="border border-black p-1 w-20">درجة الخطر</th>
              <th className="border border-black p-1 w-24">
                التاريخ: {assessmentDate} / الوقت: {assessmentTime}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-1 text-right">
                ارتباك / عدم الدراية بالزمان أو المكان أو الأشخاص / اضطراب سلوك اندفاعي / هلاوس / اضطراب في الوعي (Confusion / Disorientation / Impulsivity)
              </td>
              <td className="border border-black p-1 font-bold">4</td>
              <td className="border border-black p-1 font-bold">{confusion ? "4" : "0"}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">
                علامات اكتئاب (فقدان أمل / حزين / غير متفاعل / باكي) (Symptomatic Depression)
              </td>
              <td className="border border-black p-1 font-bold">2</td>
              <td className="border border-black p-1 font-bold">{depression ? "2" : "0"}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">
                اضطراب في الإخراج (تبول لا إرادي / التبول الليلي / إسهال) (Altered Elimination)
              </td>
              <td className="border border-black p-1 font-bold">1</td>
              <td className="border border-black p-1 font-bold">{alteredElimination ? "1" : "0"}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">دوخة / دوار (Dizziness / Vertigo)</td>
              <td className="border border-black p-1 font-bold">1</td>
              <td className="border border-black p-1 font-bold">{dizziness ? "1" : "0"}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">نوع المريض ذكر Gender (Male)</td>
              <td className="border border-black p-1 font-bold">1</td>
              <td className="border border-black p-1 font-bold">{maleScore}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">
                تعاطي أي أدوية مضادة للصرع، أدوية مهدئة، مخدرة، مدرة للبول (Antiepileptics / Sedatives / Diuretics)
              </td>
              <td className="border border-black p-1 font-bold">2</td>
              <td className="border border-black p-1 font-bold">{antiepileptics ? "2" : "0"}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">تعاطي أي أدوية مضادة للاكتئاب (Antidepressants)</td>
              <td className="border border-black p-1 font-bold">1</td>
              <td className="border border-black p-1 font-bold">{antidepressants ? "1" : "0"}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">
                اختبار النهوض من الكرسي Get Up and Go Test:
                <br />
                {getUpAndGo === 0 && "القدرة علي النهوض بحركة واحدة – دون فقدان التوازن"}
                {getUpAndGo === 1 && "يدفع لأعلي، ناجحاً في محاولة واحدة"}
                {getUpAndGo === 3 && "محاولات متعددة لكنها ناجحة"}
                {getUpAndGo === 4 && "عدم القدرة علي النهوض دون مساعدة أثناء الاختبار"}
              </td>
              <td className="border border-black p-1 font-bold">0 / 1 / 3 / 4</td>
              <td className="border border-black p-1 font-bold">{getUpAndGo}</td>
            </tr>
            <tr className="bg-slate-100 font-bold">
              <td className="border border-black p-1 text-right">إجمالي درجات التقييم (Total Score)</td>
              <td className="border border-black p-1">-</td>
              <td className="border border-black p-1 text-xs">{totalScore}</td>
            </tr>
          </tbody>
        </table>

        {/* Interventions in print */}
        <div className="border border-black p-2 mb-2 text-[10px]">
          <div className="font-bold underline mb-1">الإجراءات اللازمة لحماية المريض من خطر السقوط:</div>
          <div className="grid grid-cols-2 gap-1 leading-tight">
            {PROTECTIVE_INTERVENTIONS.map((item, idx) => (
              <div key={idx} className="flex items-start gap-1">
                <span>{selectedInterventions.includes(item) ? "■" : "□"}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-black">
          <div>
            توقيع القائم بالتقييم: <span className="font-normal underline">{assessorSignature || "...................."}</span>
          </div>
          <div>
            النتيجة:{" "}
            <span className="font-bold underline">
              {isHighRisk ? "عالي مخاطر السقوط (5 نقاط فأكثر)" : "منخفض المخاطر"}
            </span>
          </div>
        </div>

        <div className="text-center text-[10px] font-mono text-slate-500 mt-4 pt-1 border-t border-slate-300">
          Hendrich II Fall Risk Model • TRC-ICD
        </div>
      </div>
    </div>
  );
}

export default function FallRiskAdultPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">جاري التحميل...</div>}>
      <FallRiskAdultContent />
    </Suspense>
  );
}
