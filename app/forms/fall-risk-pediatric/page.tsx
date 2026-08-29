"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Baby,
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
  { id: "bed_ridden", label: "ملازم الفراش (Bed Ridden as disease or treatment plan)" },
  { id: "critical_unit", label: "مرضى الرعاية المركزة والطوارئ وغرف العمليات (ICU / ER / OR)" },
  { id: "anesthesia_48h", label: "مريض خضع لتخدير خلال 48 ساعة (Anaesthesia within 48h)" },
  { id: "mental_disability", label: "إعاقة ذهنية (داون، توحد...) (Down Syndrome, Autism...)" },
  { id: "neonate", label: "حديث ولادة (Neonate)" },
  { id: "physical_disability", label: "إعاقة جسدية (كفيف، بتر...) (Physical Disability)" },
];

function normalizeGender(val: any): "ذكر" | "انثي" | "" {
  if (!val) return "";
  const cleaned = String(val).trim().toLowerCase();
  if (cleaned.includes("ذكر") || cleaned === "male" || cleaned === "m") return "ذكر";
  if (cleaned.includes("أنث") || cleaned.includes("انث") || cleaned.includes("أنثى") || cleaned.includes("انثى") || cleaned === "female" || cleaned === "f") return "انثي";
  return "";
}

function FallRiskPediatricContent() {
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

  // Direct High Risk Factors
  const [directFactors, setDirectFactors] = useState<{ [key: string]: boolean }>({
    bed_ridden: false,
    critical_unit: false,
    anesthesia_48h: false,
    mental_disability: false,
    neonate: false,
    physical_disability: false,
  });

  // Humpty Dumpty 7 Parameters (null initially so nothing is pre-selected)
  const [ageScore, setAgeScore] = useState<number | null>(null);
  const [diagnosisScore, setDiagnosisScore] = useState<number | null>(null);
  const [environmentalScore, setEnvironmentalScore] = useState<number | null>(null);
  const [medicationsScore, setMedicationsScore] = useState<number | null>(null);
  const [cognitiveScore, setCognitiveScore] = useState<number | null>(null);
  const [surgeryScore, setSurgeryScore] = useState<number | null>(null);

  // Signatures
  const [nurseSignature, setNurseSignature] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(() => getCurrentDate());
  const [assessmentTime, setAssessmentTime] = useState(() => getCurrentTimeShort());

  // Auto gender score (Male=2, Female=1, unselected=0)
  const genderScore = gender === "ذكر" ? 2 : gender === "انثي" ? 1 : 0;

  // Update age score automatically when age changes
  useEffect(() => {
    if (age !== "") {
      const num = Number(age);
      if (num < 3) setAgeScore(4);
      else if (num < 7) setAgeScore(3);
      else if (num < 13) setAgeScore(2);
      else setAgeScore(1);
    }
  }, [age]);

  // Calculate Total Score
  const totalScore = useMemo(() => {
    return (
      (ageScore || 0) +
      (genderScore || 0) +
      (diagnosisScore || 0) +
      (environmentalScore || 0) +
      (medicationsScore || 0) +
      (cognitiveScore || 0) +
      (surgeryScore || 0)
    );
  }, [ageScore, genderScore, diagnosisScore, environmentalScore, medicationsScore, cognitiveScore, surgeryScore]);

  const hasDirectHighRisk = Object.values(directFactors).some(Boolean);

  const riskLevel = useMemo(() => {
    if (hasDirectHighRisk || totalScore >= 12) return "عالية المخاطر";
    if (totalScore >= 7) return "متوسط المخاطر";
    return "منخفضة المخاطر";
  }, [hasDirectHighRisk, totalScore]);

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
        .from("fall_risk_pediatric_assessments")
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
          critical_unit: data.critical_unit || false,
          anesthesia_48h: data.anesthesia_48h || false,
          mental_disability: data.mental_disability || false,
          neonate: data.neonate || false,
          physical_disability: data.physical_disability || false,
        });
        setAgeScore(data.age_score || 4);
        setDiagnosisScore(data.diagnosis_score || 1);
        setEnvironmentalScore(data.environmental_score || 1);
        setMedicationsScore(data.medications_score || 1);
        setCognitiveScore(data.cognitive_score || 1);
        setSurgeryScore(data.surgery_anesthesia_score || 1);
        setNurseSignature(data.nurse_signature || "");
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
          const [assessRes, fallScreenRes, fallAdultRes, radRes] = await Promise.all([
            supabase.from("patient_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_screenings").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_adult_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("radiation_exposure_logs").select("age").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
          ]);

          if (!resolvedGender) {
            const cand = assessRes.data?.[0]?.gender || fallScreenRes.data?.[0]?.gender || fallAdultRes.data?.[0]?.gender;
            resolvedGender = normalizeGender(cand);
          }

          if (resolvedAge === null) {
            const candAge = assessRes.data?.[0]?.age || fallScreenRes.data?.[0]?.age || fallAdultRes.data?.[0]?.age || radRes.data?.[0]?.age;
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
    if (!nurseSignature.trim()) errors.nurseSignature = "اسم وتوقيع التمريض مطلوب";

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
        humpty_scores: {
          age: ageScore,
          gender: genderScore,
          diagnosis: diagnosisScore,
          environmental: environmentalScore,
          medications: medicationsScore,
          cognitive: cognitiveScore,
          surgery_anesthesia: surgeryScore,
        },
        total_score: totalScore,
        risk_level: riskLevel,
        nurse_signature: nurseSignature,
        assessment_date: assessmentDate,
        assessment_time: assessmentTime,
      };

      if (editId) {
        const { error: updateErr } = await supabase
          .from("fall_risk_pediatric_assessments")
          .update({
            gender,
            age: Number(age),
            assessment_date: assessmentDate,
            assessment_time: sanitizeSqlTime(assessmentTime),
            bed_ridden: directFactors.bed_ridden,
            critical_unit: directFactors.critical_unit,
            anesthesia_48h: directFactors.anesthesia_48h,
            mental_disability: directFactors.mental_disability,
            neonate: directFactors.neonate,
            physical_disability: directFactors.physical_disability,
            age_score: ageScore,
            gender_score: genderScore,
            diagnosis_score: diagnosisScore,
            environmental_score: environmentalScore,
            medications_score: medicationsScore,
            cognitive_score: cognitiveScore,
            surgery_anesthesia_score: surgeryScore,
            total_score: totalScore,
            risk_level: riskLevel,
            nurse_signature: nurseSignature,
          })
          .eq("id", editId);

        if (updateErr) throw new Error(`خطأ تحديث التقييم: ${updateErr.message}`);

        playSuccessSound();
        setLastSavedRecord({
          id: editId,
          patientName,
          mrn,
          score: totalScore,
          riskLevel,
        });
        setIsLocked(true);
      } else {
        const { data: template } = await supabase
          .from("form_templates")
          .select("id")
          .eq("code", "TRC_ICD_FALL_PEDIATRIC")
          .single();

        let submissionId = null;
        if (template) {
          const { data: subData } = await supabase
            .from("form_submissions")
            .insert({
              patient_id: currentPid,
              template_id: template.id,
              form_code: "TRC_ICD_FALL_PEDIATRIC",
              data: payloadData,
            })
            .select()
            .single();

          if (subData) submissionId = subData.id;
        }

        const { data: savedAssessment, error: aErr } = await supabase
          .from("fall_risk_pediatric_assessments")
          .insert({
            submission_id: submissionId,
            patient_id: currentPid,
            gender,
            age: Number(age),
            assessment_date: assessmentDate,
            assessment_time: sanitizeSqlTime(assessmentTime),
            bed_ridden: directFactors.bed_ridden,
            critical_unit: directFactors.critical_unit,
            anesthesia_48h: directFactors.anesthesia_48h,
            mental_disability: directFactors.mental_disability,
            neonate: directFactors.neonate,
            physical_disability: directFactors.physical_disability,
            age_score: ageScore,
            gender_score: genderScore,
            diagnosis_score: diagnosisScore,
            environmental_score: environmentalScore,
            medications_score: medicationsScore,
            cognitive_score: cognitiveScore,
            surgery_anesthesia_score: surgeryScore,
            total_score: totalScore,
            risk_level: riskLevel,
            nurse_signature: nurseSignature,
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
          riskLevel,
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
      critical_unit: false,
      anesthesia_48h: false,
      mental_disability: false,
      neonate: false,
      physical_disability: false,
    });
    setAgeScore(null);
    setDiagnosisScore(null);
    setEnvironmentalScore(null);
    setMedicationsScore(null);
    setCognitiveScore(null);
    setSurgeryScore(null);
    setNurseSignature("");
    setAssessmentDate(getCurrentDate());
    setAssessmentTime(getCurrentTimeShort());
    setFieldErrors({});
    setErrorMsg("");
    setTimeout(() => mrnInputRef.current?.focus(), 50);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16 px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-slate-200/80 shadow-xs no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
            <Baby className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                مقياس مخاطر سقوط الأطفال (Humpty Dumpty Scale)
              </h2>
              <span className="bg-slate-100 text-slate-600 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-slate-200">
                TRC.ICD
              </span>
            </div>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • Pediatric Fall Risk Scale</p>
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
                      : "border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
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
                placeholder="اسم الطفل رباعي..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.patientName
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
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
                          ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                    >
                      <span>{g} ({g === "ذكر" ? "+2 نقطة" : "+1 نقطة"})</span>
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
                السن (بالسنوات أو الشهور) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                disabled={isLocked}
                value={age}
                onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
                placeholder="السن..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.age
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                }`}
              />
              {fieldErrors.age && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.age}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: Direct High Risk Factors */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              يعتبر المريض عالي الخطورة مباشرة في حالة وجود أي من العوامل التالية (High Risk Factors):
            </h3>
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

        {/* SECTION 3: Humpty Dumpty Scoring Matrix */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                معايير مقياس هامبتي دمبتي (Humpty Dumpty Criteria)
              </h3>
              <p className="text-[11px] text-slate-500">حساب فوري للمجموع وتصنيف مستوى الخطورة</p>
            </div>

            {/* Score Badge */}
            <div
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-xs sm:text-sm border shadow-xs ${
                riskLevel === "عالية المخاطر"
                  ? "bg-rose-600 text-white border-rose-600 animate-pulse"
                  : riskLevel === "متوسط المخاطر"
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-emerald-600 text-white border-emerald-600"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>المجموع: {totalScore} نقاط</span>
              <span>— {riskLevel}</span>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* 1. Age */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">1. السن (Age):</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { score: 4, label: "أقل من 3 سنوات (4)" },
                  { score: 3, label: "3 إلى أقل من 7 سنوات (3)" },
                  { score: 2, label: "7 إلى أقل من 13 سنة (2)" },
                  { score: 1, label: "13 سنة فما فوق (1)" },
                ].map((opt) => (
                  <button
                    key={opt.score}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setAgeScore(opt.score)}
                    className={`p-2 rounded-lg text-xs font-semibold transition-all border ${
                      ageScore === opt.score
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Diagnosis */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">2. التشخيص (Diagnosis):</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { score: 4, label: "أمراض عصبية (4 نقاط)" },
                  { score: 3, label: "أمراض تنفسية / مشاكل في الأكسجين / جفاف / إغماء / دوخة (3 نقاط)" },
                  { score: 2, label: "الاضطرابات النفسية أو السلوكية (2 نقطتان)" },
                  { score: 1, label: "تشخيصات أخرى (1 نقطة)" },
                ].map((opt) => (
                  <button
                    key={opt.score}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setDiagnosisScore(opt.score)}
                    className={`p-2.5 rounded-lg text-xs font-semibold text-right transition-all border ${
                      diagnosisScore === opt.score
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Environmental */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">3. العوامل البيئية (Environmental Factors):</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { score: 4, label: "تعرض لحادثة سقوط قبل ذلك (4 نقاط)" },
                  { score: 3, label: "المريض يستخدم أجهزة مساعدة (معدات / عكازات) (3 نقاط)" },
                  { score: 2, label: "المريض ملازم الفراش (2 نقطتان)" },
                  { score: 1, label: "مريض عيادات خارجية (1 نقطة)" },
                ].map((opt) => (
                  <button
                    key={opt.score}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setEnvironmentalScore(opt.score)}
                    className={`p-2.5 rounded-lg text-xs font-semibold text-right transition-all border ${
                      environmentalScore === opt.score
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Medications */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800">4. الأدوية المستخدمة (Medications):</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { score: 3, label: "أكثر من دواء من: منومات، مهدئات، مضادات اكتئاب، مدرات بول، مخدرات (3)" },
                  { score: 2, label: "دواء واحد من الأدوية السابقة فقط (2)" },
                  { score: 1, label: "أدوية أخرى أو لا يستخدم أدوية (1)" },
                ].map((opt) => (
                  <button
                    key={opt.score}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setMedicationsScore(opt.score)}
                    className={`p-2.5 rounded-lg text-xs font-semibold text-right transition-all border ${
                      medicationsScore === opt.score
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Cognitive & Surgery */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">5. مشاكل في الإدراك (Cognitive):</label>
                <div className="space-y-1.5">
                  {[
                    { score: 3, label: "غير مدرك لحدود السرير (3)" },
                    { score: 2, label: "ينسى حدود السرير (2)" },
                    { score: 1, label: "يعتمد على قدرته الخاصة (1)" },
                  ].map((opt) => (
                    <button
                      key={opt.score}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setCognitiveScore(opt.score)}
                      className={`w-full p-2 rounded-lg text-xs font-semibold text-right transition-all border ${
                        cognitiveScore === opt.score
                          ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">6. عملية جراحية أو تخدير (Surgery / Anesthesia):</label>
                <div className="space-y-1.5">
                  {[
                    { score: 3, label: "في أول 24 ساعة من العملية أو التخدير (3)" },
                    { score: 2, label: "في أول 48 ساعة من العملية أو التخدير (2)" },
                    { score: 1, label: "أكثر من 72 ساعة من العملية أو التخدير (1)" },
                  ].map((opt) => (
                    <button
                      key={opt.score}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setSurgeryScore(opt.score)}
                      className={`w-full p-2 rounded-lg text-xs font-semibold text-right transition-all border ${
                        surgeryScore === opt.score
                          ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Signatures & Timestamp */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                توقيع التمريض <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled={isLocked}
                  value={nurseSignature}
                  onChange={(e) => setNurseSignature(e.target.value)}
                  placeholder="اسم وتوقيع الممرض/ة..."
                  className={`w-full pl-9 pr-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                    isLocked
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : fieldErrors.nurseSignature
                      ? "border-rose-400 bg-rose-50/40"
                      : "border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  }`}
                />
                <UserCheck className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              </div>
              {fieldErrors.nurseSignature && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.nurseSignature}</p>
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

        {/* ACTIONS */}
        {!isLocked ? (
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm px-8 py-3 rounded-xl transition-all shadow-md shadow-sky-600/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editId ? "حفظ وتوثيق التعديلات" : "حفظ وتوثيق تقييم سقوط الأطفال"}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-emerald-950">
                تم الحفظ بنجاح! ({lastSavedRecord?.patientName || patientName} - {riskLevel})
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
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إدخال تقييم جديد</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* PRINT VIEW SHEET (100% MATCHING نموذج مخاطر السقوط أطفال .pdf) */}
      <div className="hidden print:block bg-white p-4 text-black font-sans">
        <div className="relative text-center pb-2 mb-2">
          <div className="absolute left-0 top-0 border-2 border-black px-2 py-0.5 font-bold text-xs font-mono tracking-widest">
            TRC.ICD
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
          مقياس مخاطر سقوط الأطفال (Humpty Dumpty Scale)
        </div>

        <div className="border border-black p-2 mb-2 text-[10px] leading-tight">
          <div className="font-bold underline mb-1">
            يعتبر المريض معرض للسقوط بدرجة عالية في حالة وجود أي من تلك العوامل:
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div>{directFactors.bed_ridden ? "■" : "□"} ملازم الفراش (Bed Ridden)</div>
            <div>{directFactors.critical_unit ? "■" : "□"} مرضى الرعاية والعمليات (Critical Units)</div>
            <div>{directFactors.anesthesia_48h ? "■" : "□"} تخدير خلال 48 ساعة</div>
            <div>{directFactors.mental_disability ? "■" : "□"} إعاقة ذهنية (داون، توحد)</div>
            <div>{directFactors.neonate ? "■" : "□"} حديث ولادة (Neonate)</div>
            <div>{directFactors.physical_disability ? "■" : "□"} إعاقة جسدية (كفيف، بتر)</div>
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
              <td className="border border-black p-1 font-bold">{ageScore}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">النوع (Gender)</td>
              <td className="border border-black p-1">1 - 2</td>
              <td className="border border-black p-1 font-bold">{genderScore}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">التشخيص (Diagnosis)</td>
              <td className="border border-black p-1">1 - 4</td>
              <td className="border border-black p-1 font-bold">{diagnosisScore}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">العوامل البيئية (Environmental)</td>
              <td className="border border-black p-1">1 - 4</td>
              <td className="border border-black p-1 font-bold">{environmentalScore}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">الأدوية المستخدمة (Medications)</td>
              <td className="border border-black p-1">1 - 3</td>
              <td className="border border-black p-1 font-bold">{medicationsScore}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">مشاكل في الإدراك (Cognitive)</td>
              <td className="border border-black p-1">1 - 3</td>
              <td className="border border-black p-1 font-bold">{cognitiveScore}</td>
            </tr>
            <tr>
              <td className="border border-black p-1 text-right">عملية جراحية / تخدير (Surgery / Anesthesia)</td>
              <td className="border border-black p-1">1 - 3</td>
              <td className="border border-black p-1 font-bold">{surgeryScore}</td>
            </tr>
            <tr className="bg-slate-100 font-bold">
              <td className="border border-black p-1 text-right">المجموع الكلي (Total Score)</td>
              <td className="border border-black p-1">-</td>
              <td className="border border-black p-1 text-xs">{totalScore}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-between items-center text-xs font-bold p-2 border border-black mb-2 bg-slate-50">
          <div>
            مستوى الخطورة:{" "}
            <span className="underline mr-1 font-extrabold">{riskLevel}</span>
          </div>
          <div className="text-[10px] text-slate-700 font-normal">
            (منخفض: 0-6 | متوسط: 7-11 | عالي: 12 فأكثر)
          </div>
        </div>

        <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-black">
          <div>
            توقيع التمريض: <span className="font-normal underline">{nurseSignature || "...................."}</span>
          </div>
          <div>
            التاريخ والوقت: <span className="font-normal underline">{assessmentDate} {assessmentTime}</span>
          </div>
        </div>

        <div className="text-center text-[10px] font-mono text-slate-500 mt-4 pt-1 border-t border-slate-300">
          Humpty Dumpty Fall Scale • TRC.ICD
        </div>
      </div>
    </div>
  );
}

export default function FallRiskPediatricPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">جاري التحميل...</div>}>
      <FallRiskPediatricContent />
    </Suspense>
  );
}
