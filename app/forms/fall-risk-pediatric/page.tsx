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
import FormSubmitButton from "@/components/FormSubmitButton";
import FormRoleGuard from "@/components/FormRoleGuard";
import { findPatientByMrn } from "@/lib/numberUtils";
import { useUser } from "@/lib/supabase/auth";
import { notifyFormSubmission } from "@/lib/syncEvents";

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

export const PEDIATRIC_FALL_PREVENTION_PROCEDURES = [
  // 1 to 6 (منخفضة المخاطر - Standard / Low Risk Precautions)
  {
    id: 1,
    category: "احتياطات الوقاية من السقوط القياسية (منخفضة المخاطر)",
    text: "حث الأم على البقاء بجوار الطفل (في الأقسام التي يوجد بها مرافق.)",
    level: "منخفضة المخاطر",
  },
  {
    id: 2,
    category: "احتياطات الوقاية من السقوط القياسية (منخفضة المخاطر)",
    text: "توفير نظام للاستدعاء في متناول اليد.",
    level: "منخفضة المخاطر",
  },
  {
    id: 3,
    category: "احتياطات الوقاية من السقوط القياسية (منخفضة المخاطر)",
    text: "السرير عند أدنى مستوى أو حسب طول المريض (العمر) والفرامل مغلقة.",
    level: "منخفضة المخاطر",
  },
  {
    id: 4,
    category: "احتياطات الوقاية من السقوط القياسية (منخفضة المخاطر)",
    text: "رفع جوانب السرير / غلق الحضانة دائما وعدم فتحها إلا من جانب واحد.",
    level: "منخفضة المخاطر",
  },
  {
    id: 5,
    category: "احتياطات الوقاية من السقوط القياسية (منخفضة المخاطر)",
    text: "التأكد من أن الأحذية آمنة وغير قابلة للانزلاق.",
    level: "منخفضة المخاطر",
  },
  {
    id: 6,
    category: "احتياطات الوقاية من السقوط القياسية (منخفضة المخاطر)",
    text: "توفير بيئة آمنة جسديا (علي سبيل المثال، القضاء على الانسكابات، تقليل الفوضى في المسار، عدم وجود أسلاك كهربائية في المسار، ولا توجد معدات غير ضرورية في المسار) .",
    level: "منخفضة المخاطر",
  },

  // 7 to 12 (متوسطة المخاطر - Moderate Risk Interventions)
  {
    id: 7,
    category: "تدخلات الوقاية من المخاطر المعتدلة (متوسطة المخاطر)",
    text: "توفير مساعدات على المشي.",
    level: "متوسط المخاطر",
  },
  {
    id: 8,
    category: "تدخلات الوقاية من المخاطر المعتدلة (متوسطة المخاطر)",
    text: "تطبيق احتياطات الوقاية من السقوط القياسية.",
    level: "متوسط المخاطر",
  },
  {
    id: 9,
    category: "تدخلات الوقاية من المخاطر المعتدلة (متوسطة المخاطر)",
    text: "وضع ملصق السرير (حرف F) وكتابة حرف F على أسورة التعريف.",
    level: "متوسط المخاطر",
  },
  {
    id: 10,
    category: "تدخلات الوقاية من المخاطر المعتدلة (متوسطة المخاطر)",
    text: "تقييم احتياجات المساعدة عند الحاجة.",
    level: "متوسط المخاطر",
  },
  {
    id: 11,
    category: "تدخلات الوقاية من المخاطر المعتدلة (متوسطة المخاطر)",
    text: "توفير الحواجز الواقية لإغلاق المساحات، والفجوات في الأسرة.",
    level: "متوسط المخاطر",
  },
  {
    id: 12,
    category: "تدخلات الوقاية من المخاطر المعتدلة (متوسطة المخاطر)",
    text: "استخدام أحذية غير زلقة لإسعاف المرضى.",
    level: "متوسط المخاطر",
  },

  // 13 to 18 (عالية المخاطر - High Risk Interventions)
  {
    id: 13,
    category: "تدخلات عالية المخاطر",
    text: "استخدام الملابس ذات الحجم المناسب لمنع خطر التعثر.",
    level: "عالية المخاطر",
  },
  {
    id: 14,
    category: "تدخلات عالية المخاطر",
    text: "تقييم الإضاءة الكافية، وترك أضواء الليل مفتوحة.",
    level: "عالية المخاطر",
  },
  {
    id: 15,
    category: "تدخلات عالية المخاطر",
    text: "تطبيق احتياطات الوقاية من السقوط القياسية",
    level: "عالية المخاطر",
  },
  {
    id: 16,
    category: "تدخلات عالية المخاطر",
    text: "تطبيق تدخلات الوقاية من المخاطر المعتدلة.",
    level: "عالية المخاطر",
  },
  {
    id: 17,
    category: "تدخلات عالية المخاطر",
    text: "ترك الباب مفتوحًا في جميع الأوقات ما لم تكن احتياطات العزل المحددة قيد الاستخدام.",
    level: "عالية المخاطر",
  },
  {
    id: 18,
    category: "تدخلات عالية المخاطر",
    text: "عمل مرور للمريض بصفة دورية كل ساعة.",
    level: "عالية المخاطر",
  },
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
  const latestSearchMrnRef = useRef("");

  const [loading, setLoading] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<any | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
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

  const { profile, role } = useUser();

  // Auto-fill signature from authenticated user
  useEffect(() => {
    if (profile?.full_name && !nurseSignature) {
      setNurseSignature(profile.full_name);
    }
  }, [profile, nurseSignature]);

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

  // Dynamic procedures based on riskLevel:
  // Low risk (منخفضة المخاطر) -> first 6
  // Mid risk (متوسط المخاطر) -> first 12
  // High risk (عالية المخاطر) -> all 18
  const visibleProcedures = useMemo(() => {
    if (riskLevel === "عالية المخاطر" || hasDirectHighRisk) {
      return PEDIATRIC_FALL_PREVENTION_PROCEDURES;
    } else if (riskLevel === "متوسط المخاطر") {
      return PEDIATRIC_FALL_PREVENTION_PROCEDURES.slice(0, 12);
    } else {
      return PEDIATRIC_FALL_PREVENTION_PROCEDURES.slice(0, 6);
    }
  }, [riskLevel, hasDirectHighRisk]);

  const [selectedProcedures, setSelectedProcedures] = useState<number[]>([]);

  useEffect(() => {
    setSelectedProcedures(visibleProcedures.map((p) => p.id));
  }, [visibleProcedures]);

  // Load from editId or mrn if present
  useEffect(() => {
    const id = searchParams.get("editId");
    const mrnParam = searchParams.get("mrn");
    const nameParam = searchParams.get("name");
    const genderParam = searchParams.get("gender");
    const ageParam = searchParams.get("age");

    if (id) {
      loadRecordForEdit(id);
    } else if (mrnParam) {
      setMrn(mrnParam);
      if (nameParam) setPatientName(nameParam);
      if (genderParam) setGender(genderParam as any);
      if (ageParam) setAge(Number(ageParam) || "");
      searchPatientByMrn(mrnParam);
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
        const hasDirectLoaded = Boolean(
          data.bed_ridden ||
          data.critical_unit ||
          data.anesthesia_48h ||
          data.mental_disability ||
          data.neonate ||
          data.physical_disability
        );
        if (hasDirectLoaded) {
          setAgeScore(data.age_score ?? null);
          setDiagnosisScore(data.diagnosis_score ? data.diagnosis_score : null);
          setEnvironmentalScore(data.environmental_score ? data.environmental_score : null);
          setMedicationsScore(data.medications_score ? data.medications_score : null);
          setCognitiveScore(data.cognitive_score ? data.cognitive_score : null);
          setSurgeryScore(data.surgery_anesthesia_score ? data.surgery_anesthesia_score : null);
        } else {
          setAgeScore(data.age_score ?? 4);
          setDiagnosisScore(data.diagnosis_score ?? 1);
          setEnvironmentalScore(data.environmental_score ?? 1);
          setMedicationsScore(data.medications_score ?? 1);
          setCognitiveScore(data.cognitive_score ?? 1);
          setSurgeryScore(data.surgery_anesthesia_score ?? 1);
        }
        setNurseSignature(data.nurse_signature || "");
        if (data.assessment_date) setAssessmentDate(data.assessment_date);
        if (data.assessment_time) setAssessmentTime(formatTime12(data.assessment_time));
        setIsLocked(true);
      }
    } catch (err: any) {
      setErrorMsg("تعذر تحميل بيانات السجل للتعديل: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function clearPatientFields() {
    setPatientId(null);
    setPatientName("");
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
    setSelectedProcedures([]);
  }

  async function searchPatientByMrn(searchMrn: string) {
    const cleanMrn = searchMrn ? searchMrn.trim() : "";
    latestSearchMrnRef.current = cleanMrn;
    if (editId) return;

    if (!cleanMrn) {
      clearPatientFields();
      return;
    }

    try {
      const thisSearch = cleanMrn;
      const patient = await findPatientByMrn(supabase, cleanMrn);
      if (latestSearchMrnRef.current !== thisSearch) return;

      if (!patient) {
        clearPatientFields();
        return;
      }

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
        if (latestSearchMrnRef.current !== thisSearch) return;

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

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (editId) {
      setErrorMsg("هذا النموذج معتمد ومسجل مسبقاً ولا يمكن التعديل عليه.");
      return;
    }

    if (!validateForm()) {
      setErrorMsg("يرجى استكمال البيانات الإجبارية الموضحة باللون الأحمر.");
      setShakeTrigger((prev) => prev + 1);
      return;
    }

    setLoading(true);

    try {
      let currentPid = patientId;
      if (!currentPid) {
        const existingPatient = await findPatientByMrn(supabase, mrn);
        if (existingPatient) {
          currentPid = existingPatient.id;
          setPatientId(currentPid);
          await supabase
            .from("patients")
            .update({
              full_name: patientName.trim(),
              gender: gender || null,
              age: age !== "" ? Number(age) : null,
            })
            .eq("id", currentPid);
        } else {
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
        }
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

      const effectiveNurseSig = profile?.full_name || nurseSignature || "التمريض";

      const payloadData = {
        mrn,
        patient_name: patientName,
        gender,
        age: Number(age),
        direct_factors: directFactors,
        has_direct_high_risk: hasDirectHighRisk,
        humpty_scores: {
          age: ageScore ?? 0,
          gender: genderScore ?? 0,
          diagnosis: diagnosisScore ?? 0,
          environmental: environmentalScore ?? 0,
          medications: medicationsScore ?? 0,
          cognitive: cognitiveScore ?? 0,
          surgery_anesthesia: surgeryScore ?? 0,
        },
        total_score: totalScore ?? 0,
        risk_level: riskLevel,
        procedures: visibleProcedures.map((p) => p.text),
        nurse_signature: effectiveNurseSig,
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
            age_score: ageScore ?? 0,
            gender_score: genderScore ?? 0,
            diagnosis_score: diagnosisScore ?? 0,
            environmental_score: environmentalScore ?? 0,
            medications_score: medicationsScore ?? 0,
            cognitive_score: cognitiveScore ?? 0,
            surgery_anesthesia_score: surgeryScore ?? 0,
            total_score: totalScore ?? 0,
            risk_level: riskLevel,
            nurse_signature: effectiveNurseSig,
          })
          .eq("id", editId);

        if (updateErr) throw new Error(`خطأ تحديث التقييم: ${updateErr.message}`);

        playSuccessSound();
        notifyFormSubmission({ formType: "fall_ped", patientId: currentPid });
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
            age_score: ageScore ?? 0,
            gender_score: genderScore ?? 0,
            diagnosis_score: diagnosisScore ?? 0,
            environmental_score: environmentalScore ?? 0,
            medications_score: medicationsScore ?? 0,
            cognitive_score: cognitiveScore ?? 0,
            surgery_anesthesia_score: surgeryScore ?? 0,
            total_score: totalScore ?? 0,
            risk_level: riskLevel,
            nurse_signature: effectiveNurseSig,
          })
          .select()
          .single();

        if (aErr) throw new Error(`خطأ حفظ التقييم: ${aErr.message}`);

        playSuccessSound();
        notifyFormSubmission({ formType: "fall_ped", patientId: currentPid });
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
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-3xl border border-purple-100 shadow-sm no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white p-0.5 shadow-sm border border-purple-200 flex items-center justify-center shrink-0">
            <img src="/tiba-scan.jpg" alt="Tiba Scan" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-[#481454]">
                مقياس مخاطر سقوط الأطفال (Humpty Dumpty Scale)
              </h2>
              <span className="bg-purple-50 text-purple-900 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-purple-200">
                TRC.ICD
              </span>
            </div>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • Pediatric Fall Risk Scale</p>
          </div>
        </div>

        {editId && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
            نموذج مسجل ومعتمد (للقراءة والطباعة فقط)
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

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
        className="space-y-5 no-print"
      >
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
                      onClick={() => setGender(normalizeGender(gender) === normalizeGender(g) ? "" : normalizeGender(g))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all border ${
                        isSelected
                          ? "bg-[#1d8a98] text-white border-[#1d8a98] shadow-xs"
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

          {/* Notes From PDF */}
          <div className="bg-slate-200/90 p-3 sm:p-4 rounded-xl border border-slate-300 text-slate-900 font-bold space-y-2 text-center mt-2 shadow-xs">
            <div>
              <p className="font-sans text-[11px] sm:text-xs text-slate-900 tracking-wide" dir="ltr">
                If the Patient Has Any of These Risk Factors: the Patient Is High Risk For Fall.
              </p>
              <p className="text-xs text-slate-900 mt-0.5" dir="rtl">
                يعتبر المريض معرض للسقوط بدرجة عالية في حالة وجود أي من تلك العوامل.
              </p>
            </div>
            <div className="pt-1.5 border-t border-slate-300">
              <p className="font-sans text-[11px] sm:text-xs text-slate-900 tracking-wide" dir="ltr">
                Reassess the Patient For Change of Patient Condition Or Transfer to Other Level of Care.
              </p>
              <p className="text-xs text-slate-900 mt-0.5" dir="rtl">
                اعد تقييم المريض عند حدوث تغيير أو عند النقل.
              </p>
            </div>
            <div className="pt-1.5 border-t border-slate-300">
              <p className="font-sans text-[11px] sm:text-xs text-slate-900 tracking-wide" dir="ltr">
                Fall Precautions Should Be Implemented Without Doing the Daily Fall Risk Assessment.
              </p>
              <p className="text-xs text-slate-900 mt-0.5" dir="rtl">
                يجب اتخاذ الاحتياطات البيئية للحماية من مخاطر السقوط.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: Humpty Dumpty Scoring Matrix */}
        {!hasDirectHighRisk ? (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-200">
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
                    onClick={() => setAgeScore(ageScore === opt.score ? null : opt.score)}
                    className={`p-2 rounded-lg text-xs font-semibold transition-all border ${
                      ageScore === opt.score
                        ? "bg-[#1d8a98] text-white border-[#1d8a98] shadow-xs"
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
                    onClick={() => setDiagnosisScore(diagnosisScore === opt.score ? null : opt.score)}
                    className={`p-2.5 rounded-lg text-xs font-semibold text-right transition-all border ${
                      diagnosisScore === opt.score
                        ? "bg-[#1d8a98] text-white border-[#1d8a98] shadow-xs"
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
                    onClick={() => setEnvironmentalScore(environmentalScore === opt.score ? null : opt.score)}
                    className={`p-2.5 rounded-lg text-xs font-semibold text-right transition-all border ${
                      environmentalScore === opt.score
                        ? "bg-[#1d8a98] text-white border-[#1d8a98] shadow-xs"
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
                    onClick={() => setMedicationsScore(medicationsScore === opt.score ? null : opt.score)}
                    className={`p-2.5 rounded-lg text-xs font-semibold text-right transition-all border ${
                      medicationsScore === opt.score
                        ? "bg-[#1d8a98] text-white border-[#1d8a98] shadow-xs"
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
                      onClick={() => setCognitiveScore(cognitiveScore === opt.score ? null : opt.score)}
                      className={`w-full p-2 rounded-lg text-xs font-semibold text-right transition-all border ${
                        cognitiveScore === opt.score
                          ? "bg-[#1d8a98] text-white border-[#1d8a98] shadow-xs"
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
                      onClick={() => setSurgeryScore(surgeryScore === opt.score ? null : opt.score)}
                      className={`w-full p-2 rounded-lg text-xs font-semibold text-right transition-all border ${
                        surgeryScore === opt.score
                          ? "bg-[#1d8a98] text-white border-[#1d8a98] shadow-xs"
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
      ) : (
          <div className="bg-rose-50 border-2 border-rose-300 p-5 sm:p-6 rounded-2xl shadow-xs space-y-3 animate-in fade-in duration-200">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-extrabold text-sm sm:text-base text-rose-950">
                    المريض عالي الخطورة مباشرة دون تقييم (Direct High Risk)
                  </h4>
                  <span className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg shadow-xs">
                    عالية المخاطر (سلسلة حمراء / حرف F) ⚠️
                  </span>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  تم تحديد أحد عوامل الخطورة المباشرة أعلاه؛ ووفقاً للسياسة المعتمدة، يعتبر المريض <strong>عالي الخطورة مباشرة دون الحاجة لاحتساب درجات مقياس هامبتي دمبتي (Humpty Dumpty)</strong>. تم إخفاء جدول التقييم وتصنيف الحالة فوراً كـ &quot;عالية المخاطر&quot;.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: إجراءات الوقاية من مخاطر السقوط عند الأطفال (Fall Risk Prevention Procedures) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#1d8a98]" />
                <span>4. إجراءات الوقاية من مخاطر السقوط عند الأطفال (Fall Risk Prevention Procedures)</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {riskLevel === "منخفضة المخاطر"
                  ? "مستوى منخفض: عرض أول 6 إجراءات قياسية"
                  : riskLevel === "متوسط المخاطر"
                  ? "مستوى متوسط: عرض أول 12 إجراء (القياسية + المعتدلة)"
                  : "مستوى عالي: عرض كافة الإجراءات الـ 18 بالكامل"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-xl text-xs font-bold ${
                  riskLevel === "عالية المخاطر"
                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                    : riskLevel === "متوسط المخاطر"
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                {visibleProcedures.length} إجراءات مطلوبة ({riskLevel})
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {visibleProcedures.map((proc) => {
              const isChecked = selectedProcedures.includes(proc.id);
              return (
                <div
                  key={proc.id}
                  onClick={() => {
                    if (isLocked) return;
                    setSelectedProcedures((prev) =>
                      prev.includes(proc.id) ? prev.filter((id) => id !== proc.id) : [...prev, proc.id]
                    );
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                    isChecked
                      ? proc.id <= 6
                        ? "bg-emerald-50/60 border-emerald-300 text-emerald-950 shadow-xs"
                        : proc.id <= 12
                        ? "bg-amber-50/60 border-amber-300 text-amber-950 shadow-xs"
                        : "bg-rose-50/60 border-rose-300 text-rose-950 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className={`w-4 h-4 rounded mt-0.5 pointer-events-none shrink-0 ${
                      proc.id <= 6
                        ? "accent-emerald-600"
                        : proc.id <= 12
                        ? "accent-amber-600"
                        : "accent-rose-600"
                    }`}
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold leading-relaxed">{proc.text}</span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/5 shrink-0">
                        #{proc.id}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {proc.category}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 5: Signatures & Timestamp */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-600" />
              <span>التوثيق والاعتماد الإلكتروني الرسمي</span>
            </h3>
            <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-0.5 rounded-full font-bold">
              توثيق آلي باسم المستخدم
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            {/* Electronic Signature Card */}
            <div className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/30 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                  <span>توقيع التمريض</span>
                </span>
                <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold">
                  {role === "nurse" ? "التمريض" : role === "technician" ? "فني الأشعة" : role === "radiologist" ? "أخصائي الأشعة" : "موثق معتمد"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-sky-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 font-mono">
                    {profile?.full_name || nurseSignature || "جاري التوثيق..."}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    تم التوثيق والاعتماد آلياً
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>معتمد</span>
                </span>
              </div>
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
          <FormSubmitButton
            loading={loading}
            isLocked={isLocked}
            fieldErrors={fieldErrors}
            defaultText="حفظ وتوثيق تقييم سقوط الأطفال"
            editText="حفظ وتوثيق التعديلات"
            isEdit={!!editId}
            shakeTrigger={shakeTrigger}
          />
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
                onClick={handleNewForm}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-[#1d8a98] hover:bg-[#167480] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
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
        <div className="flex justify-between items-center pb-2 mb-2 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <img src="/tiba-scan.jpg" alt="Tiba Scan" className="h-11 w-auto object-contain" />
            <div className="text-right">
              <h2 className="text-sm font-bold">Tiba Scan Radiology Center</h2>
              <h3 className="text-xs font-bold">مركز طيبة سكان للأشعة</h3>
            </div>
          </div>
          <div className="border border-black px-2 py-0.5 font-bold text-xs font-mono">
            TRC.ICD
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
          <div className="grid grid-cols-2 gap-1 mb-2">
            <div>{directFactors.bed_ridden ? "■" : "□"} ملازم الفراش (Bed Ridden)</div>
            <div>{directFactors.critical_unit ? "■" : "□"} مرضى الرعاية والعمليات (Critical Units)</div>
            <div>{directFactors.anesthesia_48h ? "■" : "□"} تخدير خلال 48 ساعة</div>
            <div>{directFactors.mental_disability ? "■" : "□"} إعاقة ذهنية (داون، توحد)</div>
            <div>{directFactors.neonate ? "■" : "□"} حديث ولادة (Neonate)</div>
            <div>{directFactors.physical_disability ? "■" : "□"} إعاقة جسدية (كفيف، بتر)</div>
          </div>

          <div className="bg-slate-200 p-1.5 border border-black text-center font-bold text-[9px] leading-tight space-y-1">
            <div>
              <div dir="ltr">If the Patient Has Any of These Risk Factors: the Patient Is High Risk For Fall.</div>
              <div dir="rtl">يعتبر المريض معرض للسقوط بدرجة عالية في حالة وجود أي من تلك العوامل.</div>
            </div>
            <div>
              <div dir="ltr">Reassess the Patient For Change of Patient Condition Or Transfer to Other Level of Care.</div>
              <div dir="rtl">اعد تقييم المريض عند حدوث تغيير أو عند النقل.</div>
            </div>
            <div>
              <div dir="ltr">Fall Precautions Should Be Implemented Without Doing the Daily Fall Risk Assessment.</div>
              <div dir="rtl">يجب اتخاذ الاحتياطات البيئية للحماية من مخاطر السقوط.</div>
            </div>
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
            توقيع التمريض: <span className="font-normal underline">{nurseSignature || profile?.full_name || "...................."}</span>
          </div>
          <div>
            التاريخ والوقت: <span className="font-normal underline">{assessmentDate} {assessmentTime}</span>
          </div>
        </div>

        <div className="text-center text-[10px] font-mono text-slate-500 mt-4 pt-1 border-t border-slate-300">
          Humpty Dumpty Fall Scale • TRC.ICD 1
        </div>
      </div>

      {/* ================= PAGE 2: Fall Risk Prevention Procedures (Dynamic by Risk Level) ================= */}
      <div className="hidden print:block bg-white p-4 text-black font-sans min-h-[1050px] relative mt-6 border-t-2 border-dashed border-slate-400">
        <div className="flex justify-between items-center pb-2 mb-2 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <img src="/tiba-scan.jpg" alt="Tiba Scan" className="h-10 w-auto object-contain" />
            <div className="text-right">
              <h2 className="text-sm font-bold">Tiba Scan Radiology Center</h2>
              <h3 className="text-xs font-bold">مركز طيبة سكان للأشعة</h3>
            </div>
          </div>
          <div className="border border-black px-2 py-0.5 font-bold text-xs font-mono">
            TRC.ICD 2
          </div>
        </div>

        <div className="text-center py-1 bg-slate-200 border border-black font-bold text-xs mb-2">
          إجراءات الوقاية من مخاطر السقوط عند الأطفال Fall Risk Prevention Procedures for Pediatric
        </div>

        <div className="flex justify-between items-center text-[10px] py-1 border-b border-black font-mono mb-2">
          <div>Date: <span className="underline font-bold mr-1">{assessmentDate}</span></div>
          <div>Time: <span className="underline font-bold mr-1">{assessmentTime}</span></div>
          <div>Patient: <span className="underline font-bold mr-1 font-sans">{patientName || "-"}</span></div>
          <div>MRN: <span className="underline font-bold mr-1">{mrn || "-"}</span></div>
          <div className="font-sans font-bold">
            مستوى الخطورة: <span className="underline">{riskLevel} ({visibleProcedures.length} إجراءات)</span>
          </div>
        </div>

        {/* Procedures Table */}
        <table className="w-full border-collapse border border-black text-center text-[9px] leading-tight mb-4">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black">
              <th className="border border-black p-1.5 text-right w-[42%]">
                {riskLevel === "منخفضة المخاطر"
                  ? "احتياطات الوقاية من السقوط القياسية (منخفضة المخاطر - أول 6 إجراءات)"
                  : riskLevel === "متوسط المخاطر"
                  ? "تدخلات الوقاية من المخاطر المعتدلة (متوسطة المخاطر - أول 12 إجراء)"
                  : "تدخلات الوقاية من مخاطر السقوط (عالية المخاطر - كافة الإجراءات الـ 18)"}
              </th>
              <th className="border border-black p-0.5 font-mono">08:00</th>
              <th className="border border-black p-0.5 font-mono">10:00</th>
              <th className="border border-black p-0.5 font-mono">12:00</th>
              <th className="border border-black p-0.5 font-mono">14:00</th>
              <th className="border border-black p-0.5 font-mono">16:00</th>
              <th className="border border-black p-0.5 font-mono">18:00</th>
              <th className="border border-black p-0.5 font-mono">20:00</th>
              <th className="border border-black p-0.5 font-mono">22:00</th>
              <th className="border border-black p-0.5 font-mono">24:00</th>
              <th className="border border-black p-0.5 font-mono">02:00</th>
              <th className="border border-black p-0.5 font-mono">04:00</th>
              <th className="border border-black p-0.5 font-mono">06:00</th>
              <th className="border border-black p-1 font-mono">Signature</th>
            </tr>
          </thead>
          <tbody>
            {/* Category 1: Standard (Low Risk) */}
            {visibleProcedures.filter((p) => p.id <= 6).length > 0 && (
              <>
                <tr className="bg-slate-200 font-bold text-[10px]">
                  <td colSpan={14} className="border border-black p-1 text-right">
                    احتياطات الوقاية من السقوط القياسية (منخفضة المخاطر)
                  </td>
                </tr>
                {visibleProcedures
                  .filter((p) => p.id <= 6)
                  .map((proc) => (
                    <tr key={proc.id}>
                      <td className="border border-black p-1 text-right font-medium">
                        • {proc.text}
                      </td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5 font-mono text-[8px]">{nurseSignature || ""}</td>
                    </tr>
                  ))}
              </>
            )}

            {/* Category 2: Moderate Risk (Shows for Mid Risk and High Risk) */}
            {visibleProcedures.filter((p) => p.id >= 7 && p.id <= 12).length > 0 && (
              <>
                <tr className="bg-slate-200 font-bold text-[10px]">
                  <td colSpan={14} className="border border-black p-1 text-right">
                    تدخلات الوقاية من المخاطر المعتدلة (متوسطة المخاطر)
                  </td>
                </tr>
                {visibleProcedures
                  .filter((p) => p.id >= 7 && p.id <= 12)
                  .map((proc) => (
                    <tr key={proc.id}>
                      <td className="border border-black p-1 text-right font-medium">
                        • {proc.text}
                      </td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5 font-mono text-[8px]">{nurseSignature || ""}</td>
                    </tr>
                  ))}
              </>
            )}

            {/* Category 3: High Risk (Shows ONLY for High Risk) */}
            {visibleProcedures.filter((p) => p.id >= 13).length > 0 && (
              <>
                <tr className="bg-slate-200 font-bold text-[10px]">
                  <td colSpan={14} className="border border-black p-1 text-right">
                    تدخلات عالية المخاطر
                  </td>
                </tr>
                {visibleProcedures
                  .filter((p) => p.id >= 13)
                  .map((proc) => (
                    <tr key={proc.id}>
                      <td className="border border-black p-1 text-right font-medium">
                        • {proc.text}
                      </td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5"></td>
                      <td className="border border-black p-0.5 font-mono text-[8px]">{nurseSignature || ""}</td>
                    </tr>
                  ))}
              </>
            )}
          </tbody>
        </table>

        <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-black">
          <div>
            توقيع التمريض: <span className="font-normal underline mr-2">{nurseSignature || profile?.full_name || "...................."}</span>
          </div>
          <div>
            التاريخ: <span className="font-normal mr-1">{assessmentDate}</span>
          </div>
        </div>

        <div className="absolute bottom-2 right-4 text-[10px] font-mono">TRC.ICD</div>
        <div className="absolute bottom-2 left-4 text-[10px] font-mono">2</div>
      </div>
    </div>
  );
}

export default function FallRiskPediatricPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">جاري التحميل...</div>}>
      <FormRoleGuard allowedRoles={["nurse"]} formTitle="تقييم مخاطر السقوط اطفال (Humpty Dumpty) — TRC.ICD">
        <FallRiskPediatricContent />
      </FormRoleGuard>
    </Suspense>
  );
}
