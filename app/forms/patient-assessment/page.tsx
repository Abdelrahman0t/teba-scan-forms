"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ClipboardCheck,
  Printer,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  RefreshCw,
  PlusCircle,
  Pencil,
  UserCheck,
  Calendar,
  Clock,
  HeartPulse,
  Activity,
  Plus,
  Trash2,
  Lock,
  Stethoscope,
  Loader2,
  RotateCcw,
  Info as InfoIcon,
} from "lucide-react";

import { getCurrentTimeShort, getCurrentDate, sanitizeSqlTime, formatTime12 } from "@/lib/timeUtils";
import FormSubmitButton from "@/components/FormSubmitButton";
import FormRoleGuard from "@/components/FormRoleGuard";
import { findPatientByMrn } from "@/lib/numberUtils";
import { useUser } from "@/lib/supabase/auth";
import { getFormStatusInfo } from "@/lib/formStatus";
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

interface ConnectionItem {
  id: string;
  name: string;
  size: string;
  site: string;
  inserted_at: string;
  inserted_by: string;
  removed_at: string;
}

interface MedicationItem {
  id: string;
  time: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
  ordering_doctor: string;
  administered_by: string;
}

function normalizeGender(val: any): "ذكر" | "انثي" | "" {
  if (!val) return "";
  const cleaned = String(val).trim().toLowerCase();
  if (cleaned.includes("ذكر") || cleaned === "male" || cleaned === "m") return "ذكر";
  if (cleaned.includes("أنث") || cleaned.includes("انث") || cleaned.includes("أنثى") || cleaned.includes("انثى") || cleaned === "female" || cleaned === "f") return "انثي";
  return "";
}

function PatientAssessmentContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const mrnInputRef = useRef<HTMLInputElement>(null);
  const latestSearchMrnRef = useRef("");
  const { profile, role, isAdmin } = useUser();

  const [loading, setLoading] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<any | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  const [searchMrnInput, setSearchMrnInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState<{
    type: "idle" | "loading" | "success" | "warning" | "error" | "info";
    message: string;
  } | null>(null);

  // Patient Info
  const [mrn, setMrn] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [gender, setGender] = useState<"ذكر" | "انثي" | "">("");
  const [age, setAge] = useState<number | "">("");

  // Visit & Physician Details
  const [visitDate, setVisitDate] = useState(() => getCurrentDate());
  const [visitTime, setVisitTime] = useState(() => getCurrentTimeShort());
  const [attendingPhysician, setAttendingPhysician] = useState("");
  const [physicianPhone, setPhysicianPhone] = useState("");
  const [weightKg, setWeightKg] = useState<number | "">("");
  const [heightCm, setHeightCm] = useState<number | "">("");

  // Vital Signs
  const [bloodPressure, setBloodPressure] = useState("");
  const [temperature, setTemperature] = useState<number | "">("");
  const [heartRate, setHeartRate] = useState<number | "">("");
  const [respiratoryRate, setRespiratoryRate] = useState<number | "">("");
  const [oxygenSaturation, setOxygenSaturation] = useState<number | "">("");

  // Diagnosis & Procedures
  const [diagnosis, setDiagnosis] = useState("");
  const [procedureName, setProcedureName] = useState("");
  const [pastHistory, setPastHistory] = useState("");

  // Allergies & Smoking & Mobility
  const [allergyTypes, setAllergyTypes] = useState<string[]>([]);
  const [allergyDetails, setAllergyDetails] = useState("");
  const [isSmoker, setIsSmoker] = useState<boolean | null>(null);
  const [mobilityStatus, setMobilityStatus] = useState<string>("");

  // Women Assessment
  const [lmpDate, setLmpDate] = useState("");
  const [menopause, setMenopause] = useState(false);
  const [delayedPeriod, setDelayedPeriod] = useState<boolean | null>(null);
  const [contraceptiveUse, setContraceptiveUse] = useState<boolean | null>(null);
  const [planningPregnancy, setPlanningPregnancy] = useState<boolean | null>(null);
  const [pregnantOrSuspected, setPregnantOrSuspected] = useState(false);
  const [lactating, setLactating] = useState(false);

  // System Review
  const [kidneyDisease, setKidneyDisease] = useState(false);
  const [kidneyDetails, setKidneyDetails] = useState("");
  const [heartDisease, setHeartDisease] = useState(false);
  const [heartDetails, setHeartDetails] = useState("");
  const [anticoagulants, setAnticoagulants] = useState(false);
  const [anticoagulantDetails, setAnticoagulantDetails] = useState("");
  const [pacemaker, setPacemaker] = useState(false);
  const [aneurysmClip, setAneurysmClip] = useState(false);
  const [immunocompromised, setImmunocompromised] = useState(false);
  const [psychologicalStatus, setPsychologicalStatus] = useState("طبيعية");
  const [mentalStatus, setMentalStatus] = useState("طبيعي");
  const [mentalDetails, setMentalDetails] = useState("");
  const [abuseSigns, setAbuseSigns] = useState(false);
  const [abuseDetails, setAbuseDetails] = useState("");

  // Plan of Care States (Page 2: Fall Risk, Page 3: Diagnostic Imaging)
  const [fallCareInterventions, setFallCareInterventions] = useState<string[]>([
    "تمييز المريض بوضع سلسلة عليها حرف F",
    "رفع جوانب الترولي أو إمداد المريض بأجهزة المساعدة علي المشي مثل الكرسي المتحرك.",
    "التأكد من احتياطات سلامة البيئة (جفاف الأرض،عدم وجود عوائق)",
    "تثقيف المريض و / أو ذويه حول الاجراءات المانعة للسقوط",
  ]);
  const [fallCareResponsible, setFallCareResponsible] = useState<string[]>(["الممرضة"]);
  const [fallCareTimeFrame, setFallCareTimeFrame] = useState<string>("30 دقيقة");
  const [fallCareTimeFrameCustom, setFallCareTimeFrameCustom] = useState<string>("");

  // Doctor Care Plan (Image 1) - طبيب الأشعة / أخصائي الأشعة
  const [doctorCareInterventions, setDoctorCareInterventions] = useState<string[]>([]);
  const [doctorCareResponsible, setDoctorCareResponsible] = useState<string[]>(["أخصائي الأشعة"]);
  const [doctorCareTimeFrame, setDoctorCareTimeFrame] = useState<string>("15 دقيقة");
  const [doctorCareTimeFrameCustom, setDoctorCareTimeFrameCustom] = useState<string>("");
  const [doctorConfirmedAt, setDoctorConfirmedAt] = useState<string | null>(null);

  // Technician Care Plan (Image 2) - فني الأشعة
  const [techCareInterventions, setTechCareInterventions] = useState<string[]>([]);
  const [techCareResponsible, setTechCareResponsible] = useState<string[]>(["فني الأشعة"]);
  const [techCareTimeFrame, setTechCareTimeFrame] = useState<string>("15 دقيقة");
  const [techCareTimeFrameCustom, setTechCareTimeFrameCustom] = useState<string>("");
  const [techSignature, setTechSignature] = useState("");
  const [techConfirmedAt, setTechConfirmedAt] = useState<string | null>(null);

  // Labs
  const [labGfr, setLabGfr] = useState<number | "">("");
  const [labBun, setLabBun] = useState<number | "">("");
  const [labPotassium, setLabPotassium] = useState<number | "">("");
  const [labSodium, setLabSodium] = useState<number | "">("");
  const [labUrea, setLabUrea] = useState<number | "">("");
  const [labCreatinine, setLabCreatinine] = useState<number | "">("");

  // Connections Table (empty initially)
  const [connections, setConnections] = useState<ConnectionItem[]>([]);

  // Medications Table
  const [medications, setMedications] = useState<MedicationItem[]>([]);

  // Signatures
  const [nurseSignature, setNurseSignature] = useState("");
  const [physicianSignature, setPhysicianSignature] = useState("");

  // Permissions & Completion State:
  // If a role has already submitted, that part CANNOT be updated by anyone (including the admin).
  // An admin or role can ONLY fill/continue an unsubmitted, missing role's part.
  const hasNurseSubmitted = Boolean(editId && nurseSignature && nurseSignature.trim() && nurseSignature !== "-");
  const hasDoctorSubmitted = Boolean(
    editId && physicianSignature && physicianSignature.trim() && physicianSignature !== "-" &&
    (labCreatinine !== "" || labGfr !== "")
  );
  const hasTechSubmitted = Boolean(editId && techSignature && techSignature.trim() && techSignature !== "-");
  const isModelComplete = Boolean(editId && hasNurseSubmitted && hasDoctorSubmitted && hasTechSubmitted);

  const canEditNurse = !hasNurseSubmitted && (isAdmin || role === "nurse");
  const canEditRadiologist = !hasDoctorSubmitted && (isAdmin || role === "radiologist");
  const canEditTech = !hasTechSubmitted && (isAdmin || role === "technician");

  const isNurseDisabled = isLocked || isModelComplete || hasNurseSubmitted || !canEditNurse;
  const isTechDisabled = isLocked || isModelComplete || hasTechSubmitted || !canEditTech;
  const isRadiologistDisabled = isLocked || isModelComplete || hasDoctorSubmitted || !canEditRadiologist;

  // Auto-fill signatures according to user role for new records
  useEffect(() => {
    if (profile?.full_name && !editId) {
      if (role === "nurse" && !nurseSignature) {
        setNurseSignature(profile.full_name);
      }
      if (role === "radiologist" && !physicianSignature) {
        setPhysicianSignature(profile.full_name);
      }
      if (role === "technician" && !techSignature) {
        setTechSignature(profile.full_name);
      }
    }
  }, [profile?.full_name, role, editId, nurseSignature, physicianSignature, techSignature]);

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
      if (canEditNurse) {
        setMrn(mrnParam);
        if (nameParam) setPatientName(nameParam);
        if (genderParam) setGender(genderParam as any);
        if (ageParam) setAge(Number(ageParam) || "");
        searchPatientByMrn(mrnParam);
      } else {
        setSearchMrnInput(mrnParam);
        searchPatientByMrn(mrnParam);
      }
    }
  }, [searchParams, canEditNurse]);

  async function loadRecordForEdit(id: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("patient_assessments")
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
        if (data.visit_date) setVisitDate(data.visit_date);
        if (data.visit_time) setVisitTime(formatTime12(data.visit_time));
        setAttendingPhysician(data.attending_physician || "");
        setPhysicianPhone(data.physician_phone || "");
        setWeightKg(data.weight_kg || "");
        setHeightCm(data.height_cm || "");
        setBloodPressure(data.blood_pressure || "");
        setTemperature(data.temperature || "");
        setHeartRate(data.heart_rate || "");
        setRespiratoryRate(data.respiratory_rate || "");
        setOxygenSaturation(data.oxygen_saturation || "");
        setDiagnosis(data.diagnosis || "");
        setProcedureName(data.procedure_name || "");
        setPastHistory(data.medical_surgical_history || "");
        setAllergyTypes(data.allergy_types || []);
        setAllergyDetails(data.allergy_details || "");
        setIsSmoker(data.is_smoker || false);
        setMobilityStatus(data.mobility_status || "طبيعية");
        if (data.lmp_date) setLmpDate(data.lmp_date);
        setMenopause(data.menopause || false);
        setDelayedPeriod(data.delayed_period !== undefined ? data.delayed_period : null);
        setContraceptiveUse(data.contraceptive_use !== undefined ? data.contraceptive_use : null);
        setPlanningPregnancy(data.planning_pregnancy !== undefined ? data.planning_pregnancy : null);
        setPregnantOrSuspected(data.pregnant_or_suspected || false);
        setLactating(data.lactating || false);
        setKidneyDisease(data.kidney_disease || false);
        setKidneyDetails(data.kidney_disease_details || "");
        setHeartDisease(data.heart_disease || false);
        setHeartDetails(data.heart_disease_details || "");
        setAnticoagulants(data.anticoagulants || false);
        setAnticoagulantDetails(data.anticoagulants_details || "");
        setPacemaker(data.pacemaker || false);
        setAneurysmClip(data.aneurysm_clip || false);
        setImmunocompromised(data.immunocompromised || false);
        setPsychologicalStatus(data.psychological_status || "طبيعية");
        if (data.mental_status?.startsWith("أخرى")) {
          setMentalStatus("أخرى");
          const extracted = data.mental_status.replace(/^أخرى\s*[:(]?\s*/, "").replace(/\)$/, "");
          setMentalDetails(data.mental_status_details || extracted || "");
        } else {
          setMentalStatus(data.mental_status || "طبيعي");
          setMentalDetails(data.mental_status_details || "");
        }
        setAbuseSigns(data.abuse_neglect_signs || false);
        setAbuseDetails(data.abuse_neglect_details || "");
        if (data.plan_of_care && Array.isArray(data.plan_of_care)) {
          const fallPlan = data.plan_of_care.find((p: any) => p.problem?.includes("السقوط"));
          if (fallPlan) {
            if (Array.isArray(fallPlan.interventions)) setFallCareInterventions(fallPlan.interventions);
            if (Array.isArray(fallPlan.responsible)) setFallCareResponsible(fallPlan.responsible);
            if (fallPlan.time_frame) {
              if (fallPlan.time_frame === "30 دقيقة") {
                setFallCareTimeFrame("30 دقيقة");
              } else {
                setFallCareTimeFrame("أخرى");
                setFallCareTimeFrameCustom(fallPlan.time_frame);
              }
            }
          }

          // 1. Doctor Care Plan (Image 1)
          const docPlan = data.plan_of_care.find((p: any) =>
            p.responsible?.includes("أخصائي الأشعة") ||
            p.responsible?.includes("طبيب الأشعة") ||
            p.interventions?.some((i: string) => i.includes("فوائد ومخاطر") || i.includes("ما قبل الفحص"))
          );
          if (docPlan) {
            if (Array.isArray(docPlan.interventions)) setDoctorCareInterventions(docPlan.interventions);
            if (Array.isArray(docPlan.responsible)) setDoctorCareResponsible(docPlan.responsible);
            if (docPlan.time_frame) {
              if (docPlan.time_frame === "15 دقيقة") {
                setDoctorCareTimeFrame("15 دقيقة");
              } else {
                setDoctorCareTimeFrame("أخرى");
                setDoctorCareTimeFrameCustom(docPlan.time_frame);
              }
            }
            if (docPlan.confirmed_at) setDoctorConfirmedAt(docPlan.confirmed_at);
          }

          // 2. Technician Care Plan (Image 2)
          const techPlan = data.plan_of_care.find((p: any) =>
            !p?.responsible?.some((r: string) => r?.includes("طبيب") || r?.includes("أخصائي")) &&
            (
              p.responsible?.includes("فني الأشعة") ||
              p.problem?.includes("السلامة والجرعة") ||
              p.interventions?.some((i: string) => i.includes("جرعة الإشعاع") || i.includes("دليل الاجراءات"))
            )
          );
          if (techPlan) {
            if (Array.isArray(techPlan.interventions)) setTechCareInterventions(techPlan.interventions);
            if (Array.isArray(techPlan.responsible)) setTechCareResponsible(techPlan.responsible);
            if (techPlan.time_frame) {
              if (techPlan.time_frame === "15 دقيقة") {
                setTechCareTimeFrame("15 دقيقة");
              } else {
                setTechCareTimeFrame("أخرى");
                setTechCareTimeFrameCustom(techPlan.time_frame);
              }
            }
            if (techPlan.confirmed_by) {
              setTechSignature(techPlan.confirmed_by);
            } else {
              setTechSignature("");
            }
            if (techPlan.confirmed_at) setTechConfirmedAt(techPlan.confirmed_at);
          } else {
            // Backward compatibility with older combined plan
            const genericImgPlan = data.plan_of_care.find((p: any) => p.problem?.includes("التشخيصي") || p.problem?.includes("التصوير"));
            if (genericImgPlan && !docPlan) {
              const docInterventions = genericImgPlan.interventions?.filter((i: string) =>
                i.includes("ما قبل الفحص") || i.includes("فوائد ومخاطر")
              ) || [];
              const techInterventions = genericImgPlan.interventions?.filter((i: string) =>
                !i.includes("ما قبل الفحص") && !i.includes("فوائد ومخاطر")
              ) || [];
              if (docInterventions.length > 0) setDoctorCareInterventions(docInterventions);
              if (techInterventions.length > 0) setTechCareInterventions(techInterventions);
              if (genericImgPlan.responsible?.includes("فني") && genericImgPlan.confirmed_by) {
                setTechSignature(genericImgPlan.confirmed_by);
              }
            }
          }
        }
        if (data.tech_signature && data.tech_signature !== data.physician_signature) {
          setTechSignature(data.tech_signature);
        }
        setLabGfr(data.lab_gfr || "");
        setLabBun(data.lab_bun || "");
        setLabPotassium(data.lab_potassium || "");
        setLabSodium(data.lab_sodium || "");
        setLabUrea(data.lab_urea || "");
        setLabCreatinine(data.lab_creatinine || "");
        if (data.connections && Array.isArray(data.connections)) setConnections(data.connections);
        if (data.medications && Array.isArray(data.medications)) setMedications(data.medications);
        setNurseSignature(data.nurse_signature || "");
        setPhysicianSignature(data.physician_signature || "");
        const hasNurse = Boolean(data.nurse_signature && data.nurse_signature !== "-");
        const hasDoc = Boolean(data.physician_signature && data.physician_signature !== "-" && (data.lab_creatinine || data.lab_gfr));
        const hasTech = Boolean(data.tech_signature && data.tech_signature !== "-");
        const complete = hasNurse && hasDoc && hasTech;
        setIsLocked(complete);
      }
    } catch (err: any) {
      setErrorMsg("تعذر تحميل بيانات السجل للتعديل: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function clearPatientFields() {
    setEditId(null);
    setPatientId(null);
    setPatientName("");
    setGender("");
    setAge("");
    setAttendingPhysician("");
    setPhysicianPhone("");
    setWeightKg("");
    setHeightCm("");
    setBloodPressure("");
    setTemperature("");
    setHeartRate("");
    setRespiratoryRate("");
    setOxygenSaturation("");
    setDiagnosis("");
    setProcedureName("");
    setPastHistory("");
    setAllergyTypes([]);
    setAllergyDetails("");
    setIsSmoker(null);
    setMobilityStatus("");
    setLmpDate("");
    setMenopause(false);
    setDelayedPeriod(null);
    setContraceptiveUse(null);
    setPlanningPregnancy(null);
    setPregnantOrSuspected(false);
    setLactating(false);
    setKidneyDisease(false);
    setKidneyDetails("");
    setHeartDisease(false);
    setHeartDetails("");
    setAnticoagulants(false);
    setAnticoagulantDetails("");
    setPacemaker(false);
    setAneurysmClip(false);
    setImmunocompromised(false);
    setPsychologicalStatus("طبيعية");
    setMentalStatus("طبيعي");
    setMentalDetails("");
    setAbuseSigns(false);
    setAbuseDetails("");
    setLabGfr("");
    setLabBun("");
    setLabPotassium("");
    setLabSodium("");
    setLabUrea("");
    setLabCreatinine("");
    setConnections([]);
    setMedications([]);
    setDoctorCareInterventions([]);
    setDoctorCareResponsible(["أخصائي الأشعة"]);
    setDoctorCareTimeFrame("15 دقيقة");
    setDoctorCareTimeFrameCustom("");
    setDoctorConfirmedAt(null);
    setTechCareInterventions([]);
    setTechCareResponsible(["فني الأشعة"]);
    setTechCareTimeFrame("15 دقيقة");
    setTechCareTimeFrameCustom("");
    setTechSignature("");
    setTechConfirmedAt(null);
    setNurseSignature("");
    setPhysicianSignature("");
  }

  function handleResetSearch() {
    clearPatientFields();
    setMrn("");
    setSearchMrnInput("");
    setSearchStatus(null);
  }

  async function searchPatientByMrn(searchMrn: string) {
    const cleanMrn = searchMrn ? searchMrn.trim() : "";
    if (editId) return;

    latestSearchMrnRef.current = cleanMrn;
    const thisSearch = cleanMrn;

    if (!cleanMrn) {
      clearPatientFields();
      setSearchStatus(null);
      return;
    }

    // NON-NURSE (Technician, Radiologist, Staff):
    // They cannot create a new assessment! They can ONLY complete an existing INCOMPLETE assessment!
    if (!canEditNurse) {
      setSearchLoading(true);
      setSearchStatus({ type: "loading", message: "جاري البحث عن تقييم غير مكتمل لهذا المريض..." });
      clearPatientFields();

      try {
        const patient = await findPatientByMrn(supabase, cleanMrn);
        if (latestSearchMrnRef.current !== thisSearch) return;

        if (!patient) {
          clearPatientFields();
          setSearchStatus({
            type: "error",
            message: `لم يتم العثور على أي مريض مسجل برقم الملف الطبي: (${cleanMrn})`,
          });
          return;
        }

        // Query existing assessments for this patient
        const { data: assessments, error: aErr } = await supabase
          .from("patient_assessments")
          .select("*, patients(id, full_name, mrn, gender, age)")
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false });

        if (latestSearchMrnRef.current !== thisSearch) return;

        if (aErr) throw aErr;

        if (!assessments || assessments.length === 0) {
          clearPatientFields();
          setSearchStatus({
            type: "warning",
            message: `المريض (${patient.full_name}) ليس لديه أي نموذج تقييم مسجل من قبل التمريض. يجب على التمريض إنشاء التقييم واعتماده أولاً.`,
          });
          return;
        }

        // Filter for incomplete models
        const incompleteList = assessments.filter((a) => {
          const s = getFormStatusInfo({ ...a, formType: "assessment" });
          return !s.isComplete;
        });

        if (incompleteList.length === 0) {
          clearPatientFields();
          setSearchStatus({
            type: "info",
            message: `نموذج التقييم الخاص بالمريض (${patient.full_name}) مكتمل بالفعل وموقع من كافة الأطراف. لا توجد نماذج غير مكتملة بحاجة إلى استكمال.`,
          });
          return;
        }

        // Target the incomplete assessment where the current user's role is missing, or the most recent one
        const target = incompleteList.find((a) => {
          const s = getFormStatusInfo({ ...a, formType: "assessment" });
          return role ? s.missingRoles.includes(role as any) : true;
        }) || incompleteList[0];

        await loadRecordForEdit(target.id);
        setSearchStatus({
          type: "success",
          message: `تم العثور على نموذج غير مكتمل للمريض (${patient.full_name || cleanMrn}). تم تحميل بيانات التقييم بنجاح، يمكنك الآن استكمال قسمك وحفظ النموذج.`,
        });
      } catch (err: any) {
        console.error("searchPatientByMrn non-nurse error:", err);
        clearPatientFields();
        setSearchStatus({
          type: "error",
          message: `حدث خطأ أثناء البحث: ${err.message || err}`,
        });
      } finally {
        setSearchLoading(false);
      }
      return;
    }

    // FOR NURSE (canEditNurse === true):
    // Initiating/editing assessments is allowed -> auto-fill patient info to save time
    try {
      const patient = await findPatientByMrn(supabase, cleanMrn);
      if (latestSearchMrnRef.current !== thisSearch) return;

      if (patient) {
        setPatientId(patient.id);
        setPatientName(patient.full_name || "");

        let resolvedGender = normalizeGender(patient.gender);
        let resolvedAge = (patient.age !== null && patient.age !== undefined && patient.age !== "") ? patient.age : null;

        // Fallback search across past tables if gender or age is missing
        if (!resolvedGender || resolvedAge === null) {
          const [fallScreenRes, fallAdultRes, fallPedRes, radRes] = await Promise.all([
            supabase.from("fall_risk_screenings").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_adult_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_pediatric_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("radiation_exposure_logs").select("age").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
          ]);

          if (latestSearchMrnRef.current !== thisSearch) return;

          if (!resolvedGender) {
            const cand = fallScreenRes.data?.[0]?.gender || fallAdultRes.data?.[0]?.gender || fallPedRes.data?.[0]?.gender;
            resolvedGender = normalizeGender(cand);
          }

          if (resolvedAge === null) {
            const candAge = fallScreenRes.data?.[0]?.age || fallAdultRes.data?.[0]?.age || fallPedRes.data?.[0]?.age || radRes.data?.[0]?.age;
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
      } else {
        // No match found -> clear all auto-filled fields
        clearPatientFields();
      }
    } catch (err) {
      console.error("searchPatientByMrn error:", err);
    }
  }

  function handleAllergyToggle(val: string) {
    if (isNurseDisabled) return;
    if (val === "لا يوجد") {
      setAllergyTypes(["لا يوجد"]);
      return;
    }
    setAllergyTypes((prev) => {
      const filtered = prev.filter((a) => a !== "لا يوجد");
      return filtered.includes(val) ? filtered.filter((a) => a !== val) : [...filtered, val];
    });
  }

  function handleAddConnection() {
    if (isNurseDisabled) return;
    setConnections((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "",
        size: "",
        site: "",
        inserted_at: new Date().toLocaleDateString("ar-EG"),
        inserted_by: "التمريض",
        removed_at: "-",
      },
    ]);
  }

  function handleAddMedication() {
    if (isNurseDisabled) return;
    setMedications((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        name: "",
        dose: "",
        route: "IV",
        frequency: "مرة واحدة",
        ordering_doctor: attendingPhysician || "طبيب المركز",
        administered_by: "التمريض",
      },
    ]);
  }

  function validateForm() {
    const errors: { [key: string]: string } = {};
    if (!mrn.trim()) errors.mrn = "رقم الملف الطبي مطلوب";
    if (!patientName.trim()) errors.patientName = "اسم المريض رباعي مطلوب";
    if (canEditNurse) {
      if (!gender) errors.gender = "يرجى تحديد الجنس";
      if (age === "" || Number(age) < 0) errors.age = "السن مطلوب";
      if (!procedureName.trim()) errors.procedureName = "اسم الإجراء مطلوب";
    }

    // نتائج المعمل إلزامية لطبيب الأشعة (Radiologist)
    if (role === "radiologist") {
      if (labCreatinine === "" || isNaN(Number(labCreatinine))) errors.labCreatinine = "مطلوب";
      if (labGfr === "" || isNaN(Number(labGfr))) errors.labGfr = "مطلوب";
      if (labUrea === "" || isNaN(Number(labUrea))) errors.labUrea = "مطلوب";
      if (labBun === "" || isNaN(Number(labBun))) errors.labBun = "مطلوب";
      if (labSodium === "" || isNaN(Number(labSodium))) errors.labSodium = "مطلوب";
      if (labPotassium === "" || isNaN(Number(labPotassium))) errors.labPotassium = "مطلوب";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (isModelComplete) {
      setErrorMsg("هذا النموذج مكتمل ومعتمد بالكامل ولا يمكن التعديل عليه.");
      return;
    }

    if (!validateForm()) {
      if (role === "radiologist") {
        setErrorMsg("يرجى إدخال جميع نتائج المعمل (Creatinine, GFR, Urea, BUN, Sodium, Potassium) الإجبارية لطبيب الأشعة.");
      } else {
        setErrorMsg("يرجى استكمال البيانات الإجبارية الموضحة باللون الأحمر.");
      }
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

      // Preserve existing signatures across roles
      let effectiveNurseSig = nurseSignature || "";
      if (role === "nurse" && profile?.full_name) {
        effectiveNurseSig = profile.full_name;
      } else if (!effectiveNurseSig && (role === "nurse" || isAdmin)) {
        effectiveNurseSig = profile?.full_name || "طاقم التمريض المعتمد";
      }

      // TECHNICIAN:
      // If technician signature exists, preserve it. If current user is technician and filled care plan, confirm it!
      let effectiveTechSig = techSignature || "";
      let effectiveTechConfirmedAt = techConfirmedAt || null;

      if (role === "technician" && profile?.full_name) {
        effectiveTechSig = profile.full_name;
        effectiveTechConfirmedAt = new Date().toISOString();
      }

      // RADIOLOGIST DOCTOR:
      // If physician signature exists, preserve it. If current user is radiologist, confirm it!
      let effectivePhysicianSig = physicianSignature || "";
      let effectiveDoctorConfirmedAt = doctorConfirmedAt || null;

      if (role === "radiologist" && profile?.full_name) {
        effectivePhysicianSig = profile.full_name;
        effectiveDoctorConfirmedAt = new Date().toISOString();
      } else if (!effectivePhysicianSig && (role === "radiologist" || isAdmin)) {
        if (labGfr !== "" || labCreatinine !== "" || labBun !== "" || labUrea !== "" || labSodium !== "" || labPotassium !== "" || attendingPhysician || doctorCareInterventions.length > 0) {
          effectivePhysicianSig = profile?.full_name || "";
          effectiveDoctorConfirmedAt = new Date().toISOString();
        }
      }

      // Safeguard: Radiologist or other non-technician cannot sign as technician
      if (role !== "technician" && effectiveTechSig && effectivePhysicianSig && effectiveTechSig === effectivePhysicianSig && !techConfirmedAt) {
        effectiveTechSig = "";
      }

      const planOfCarePayload = [
        {
          problem: "المريض معرض لخطر السقوط",
          goal: "تأمين المريض و حمايته من خطر السقوط",
          interventions: fallCareInterventions,
          responsible: fallCareResponsible,
          time_frame: fallCareTimeFrame === "أخرى" ? fallCareTimeFrameCustom : fallCareTimeFrame,
        },
        {
          problem: "المريض يحتاج للخضوع للتصوير التشخيصي",
          goal: "حصول المريض علي الخدمة بطريقة آمنه",
          interventions: doctorCareInterventions,
          responsible: doctorCareResponsible,
          time_frame: doctorCareTimeFrame === "أخرى" ? doctorCareTimeFrameCustom : doctorCareTimeFrame,
          confirmed_by: effectivePhysicianSig || null,
          confirmed_at: effectivePhysicianSig ? (effectiveDoctorConfirmedAt || new Date().toISOString()) : null,
        },
        {
          problem: "المريض يحتاج للخضوع للتصوير التشخيصي (السلامة والجرعة الإشعاعية)",
          goal: "حصول المريض علي الخدمة بطريقة آمنه",
          interventions: techCareInterventions,
          responsible: techCareResponsible,
          time_frame: techCareTimeFrame === "أخرى" ? techCareTimeFrameCustom : techCareTimeFrame,
          confirmed_by: effectiveTechSig || null,
          confirmed_at: effectiveTechSig ? (effectiveTechConfirmedAt || new Date().toISOString()) : null,
        },
      ];

      const payloadData = {
        mrn,
        patient_name: patientName,
        gender,
        age: Number(age),
        visit_date: visitDate,
        visit_time: visitTime,
        attending_physician: attendingPhysician,
        physician_phone: physicianPhone,
        weight_kg: weightKg !== "" ? Number(weightKg) : null,
        height_cm: heightCm !== "" ? Number(heightCm) : null,
        vitals: {
          blood_pressure: bloodPressure,
          temperature: temperature !== "" ? Number(temperature) : null,
          heart_rate: heartRate !== "" ? Number(heartRate) : null,
          respiratory_rate: respiratoryRate !== "" ? Number(respiratoryRate) : null,
          oxygen_saturation: oxygenSaturation !== "" ? Number(oxygenSaturation) : null,
        },
        diagnosis,
        procedure_name: procedureName,
        medical_surgical_history: pastHistory,
        allergy_types: allergyTypes,
        allergy_details: allergyDetails,
        is_smoker: isSmoker,
        mobility_status: mobilityStatus,
        women_assessment: {
          lmp_date: lmpDate || null,
          menopause,
          delayed_period: delayedPeriod,
          contraceptive_use: contraceptiveUse,
          planning_pregnancy: planningPregnancy,
          pregnant_or_suspected: pregnantOrSuspected,
          lactating,
        },
        system_review: {
          kidney_disease: kidneyDisease,
          kidney_details: kidneyDetails,
          heart_disease: heartDisease,
          heart_details: heartDetails,
          anticoagulants,
          anticoagulant_details: anticoagulantDetails,
          pacemaker,
          aneurysm_clip: aneurysmClip,
          immunocompromised,
          psychological_status: psychologicalStatus,
          mental_status: mentalStatus,
          mental_details: mentalDetails,
          abuse_signs: abuseSigns,
          abuse_details: abuseDetails,
        },
        lab_results: {
          gfr: labGfr !== "" ? Number(labGfr) : null,
          bun: labBun !== "" ? Number(labBun) : null,
          potassium: labPotassium !== "" ? Number(labPotassium) : null,
          sodium: labSodium !== "" ? Number(labSodium) : null,
          urea: labUrea !== "" ? Number(labUrea) : null,
          creatinine: labCreatinine !== "" ? Number(labCreatinine) : null,
        },
        plan_of_care: planOfCarePayload,
        connections,
        medications,
        nurse_signature: effectiveNurseSig,
        physician_signature: effectivePhysicianSig,
        tech_signature: effectiveTechSig,
      };

      if (editId) {
        const { error: updateErr } = await supabase
          .from("patient_assessments")
          .update({
            gender,
            age: Number(age),
            visit_date: visitDate,
            visit_time: sanitizeSqlTime(visitTime),
            attending_physician: attendingPhysician,
            physician_phone: physicianPhone,
            weight_kg: weightKg !== "" ? Number(weightKg) : null,
            height_cm: heightCm !== "" ? Number(heightCm) : null,
            blood_pressure: bloodPressure,
            temperature: temperature !== "" ? Number(temperature) : null,
            heart_rate: heartRate !== "" ? Number(heartRate) : null,
            respiratory_rate: respiratoryRate !== "" ? Number(respiratoryRate) : null,
            oxygen_saturation: oxygenSaturation !== "" ? Number(oxygenSaturation) : null,
            diagnosis,
            procedure_name: procedureName,
            medical_surgical_history: pastHistory,
            allergy_types: allergyTypes,
            allergy_details: allergyDetails,
            is_smoker: isSmoker,
            mobility_status: mobilityStatus,
            lmp_date: lmpDate || null,
            menopause,
            delayed_period: delayedPeriod,
            contraceptive_use: contraceptiveUse,
            planning_pregnancy: planningPregnancy,
            pregnant_or_suspected: pregnantOrSuspected,
            lactating,
            kidney_disease: kidneyDisease,
            kidney_disease_details: kidneyDetails,
            heart_disease: heartDisease,
            heart_disease_details: heartDetails,
            anticoagulants,
            anticoagulants_details: anticoagulantDetails,
            pacemaker,
            aneurysm_clip: aneurysmClip,
            immunocompromised,
            psychological_status: psychologicalStatus || "طبيعية",
            mental_status: (mentalStatus === "أخرى" && mentalDetails ? `أخرى (${mentalDetails})` : (mentalStatus || "طبيعي")).slice(0, 50),
            abuse_neglect_signs: abuseSigns,
            abuse_neglect_details: abuseSigns ? abuseDetails : "",
            lab_gfr: labGfr !== "" ? Number(labGfr) : null,
            lab_bun: labBun !== "" ? Number(labBun) : null,
            lab_potassium: labPotassium !== "" ? Number(labPotassium) : null,
            lab_sodium: labSodium !== "" ? Number(labSodium) : null,
            lab_urea: labUrea !== "" ? Number(labUrea) : null,
            lab_creatinine: labCreatinine !== "" ? Number(labCreatinine) : null,
            plan_of_care: planOfCarePayload,
            connections,
            medications,
            nurse_signature: effectiveNurseSig,
            physician_signature: effectivePhysicianSig,
          })
          .eq("id", editId);

        if (updateErr) throw new Error(`خطأ تحديث التقييم: ${updateErr.message}`);

        playSuccessSound();
        notifyFormSubmission({ formType: "assessment", patientId: currentPid });
        setLastSavedRecord({
          id: editId,
          patientName,
          mrn,
          procedure: procedureName,
        });
        setIsLocked(true);
      } else {
        const { data: template } = await supabase
          .from("form_templates")
          .select("id")
          .eq("code", "TRC_ICD_PATIENT_ASSESSMENT")
          .single();

        let submissionId = null;
        if (template) {
          const { data: subData } = await supabase
            .from("form_submissions")
            .insert({
              patient_id: currentPid,
              template_id: template.id,
              form_code: "TRC_ICD_PATIENT_ASSESSMENT",
              data: payloadData,
            })
            .select()
            .single();

          if (subData) submissionId = subData.id;
        }

        const { data: savedAssessment, error: aErr } = await supabase
          .from("patient_assessments")
          .insert({
            submission_id: submissionId,
            patient_id: currentPid,
            visit_date: visitDate,
            visit_time: sanitizeSqlTime(visitTime),
            attending_physician: attendingPhysician,
            physician_phone: physicianPhone,
            weight_kg: weightKg !== "" ? Number(weightKg) : null,
            height_cm: heightCm !== "" ? Number(heightCm) : null,
            blood_pressure: bloodPressure,
            temperature: temperature !== "" ? Number(temperature) : null,
            heart_rate: heartRate !== "" ? Number(heartRate) : null,
            respiratory_rate: respiratoryRate !== "" ? Number(respiratoryRate) : null,
            oxygen_saturation: oxygenSaturation !== "" ? Number(oxygenSaturation) : null,
            diagnosis,
            procedure_name: procedureName,
            medical_surgical_history: pastHistory,
            allergy_types: allergyTypes,
            allergy_details: allergyDetails,
            is_smoker: isSmoker,
            mobility_status: mobilityStatus,
            lmp_date: lmpDate || null,
            menopause,
            delayed_period: delayedPeriod,
            contraceptive_use: contraceptiveUse,
            planning_pregnancy: planningPregnancy,
            pregnant_or_suspected: pregnantOrSuspected,
            lactating,
            kidney_disease: kidneyDisease,
            kidney_disease_details: kidneyDetails,
            heart_disease: heartDisease,
            heart_disease_details: heartDetails,
            anticoagulants,
            anticoagulants_details: anticoagulantDetails,
            pacemaker,
            aneurysm_clip: aneurysmClip,
            immunocompromised,
            psychological_status: psychologicalStatus || "طبيعية",
            mental_status: (mentalStatus === "أخرى" && mentalDetails ? `أخرى (${mentalDetails})` : (mentalStatus || "طبيعي")).slice(0, 50),
            abuse_neglect_signs: abuseSigns,
            abuse_neglect_details: abuseSigns ? abuseDetails : "",
            lab_gfr: labGfr !== "" ? Number(labGfr) : null,
            lab_bun: labBun !== "" ? Number(labBun) : null,
            lab_potassium: labPotassium !== "" ? Number(labPotassium) : null,
            lab_sodium: labSodium !== "" ? Number(labSodium) : null,
            lab_urea: labUrea !== "" ? Number(labUrea) : null,
            lab_creatinine: labCreatinine !== "" ? Number(labCreatinine) : null,
            plan_of_care: planOfCarePayload,
            connections,
            medications,
            nurse_signature: effectiveNurseSig,
            physician_signature: effectivePhysicianSig,
          })
          .select()
          .single();

        if (aErr) throw new Error(`خطأ حفظ تقييم المريض: ${aErr.message}`);

        playSuccessSound();
        notifyFormSubmission({ formType: "assessment", patientId: currentPid });
        setEditId(savedAssessment?.id || submissionId);
        setLastSavedRecord({
          id: savedAssessment?.id || submissionId,
          patientName,
          mrn,
          procedure: procedureName,
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
    setAttendingPhysician("");
    setPhysicianPhone("");
    setWeightKg("");
    setHeightCm("");
    setBloodPressure("");
    setTemperature("");
    setHeartRate("");
    setRespiratoryRate("");
    setOxygenSaturation("");
    setDiagnosis("");
    setProcedureName("");
    setPastHistory("");
    setAllergyTypes([]);
    setAllergyDetails("");
    setIsSmoker(null);
    setMobilityStatus("");
    setLmpDate("");
    setMenopause(false);
    setDelayedPeriod(null);
    setContraceptiveUse(null);
    setPlanningPregnancy(null);
    setPregnantOrSuspected(false);
    setLactating(false);
    setKidneyDisease(false);
    setKidneyDetails("");
    setHeartDisease(false);
    setHeartDetails("");
    setAnticoagulants(false);
    setAnticoagulantDetails("");
    setPacemaker(false);
    setAneurysmClip(false);
    setImmunocompromised(false);
    setPsychologicalStatus("طبيعية");
    setMentalStatus("طبيعي");
    setMentalDetails("");
    setAbuseSigns(false);
    setAbuseDetails("");
    setFallCareInterventions([
      "تمييز المريض بوضع سلسلة عليها حرف F",
      "رفع جوانب الترولي أو إمداد المريض بأجهزة المساعدة علي المشي مثل الكرسي المتحرك.",
      "التأكد من احتياطات سلامة البيئة (جفاف الأرض،عدم وجود عوائق)",
      "تثقيف المريض و / أو ذويه حول الاجراءات المانعة للسقوط",
    ]);
    setFallCareResponsible(["الممرضة"]);
    setFallCareTimeFrame("30 دقيقة");
    setFallCareTimeFrameCustom("");
    setDoctorCareInterventions([]);
    setDoctorCareResponsible([]);
    setDoctorCareTimeFrame("");
    setDoctorCareTimeFrameCustom("");
    setTechCareInterventions([]);
    setTechCareResponsible([]);
    setTechCareTimeFrame("");
    setTechCareTimeFrameCustom("");
    setTechSignature("");
    setLabGfr("");
    setLabBun("");
    setLabPotassium("");
    setLabSodium("");
    setLabUrea("");
    setLabCreatinine("");
    setConnections([]);
    setMedications([]);
    setNurseSignature("");
    setPhysicianSignature("");
    setFieldErrors({});
    setErrorMsg("");
    setTimeout(() => mrnInputRef.current?.focus(), 50);
  }

  const isFemale = normalizeGender(gender) === "انثي";
  const isWomenDisabled = isNurseDisabled || !isFemale;

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
                نموذج تقييم المريض الشامل
              </h2>
              <span className="bg-purple-50 text-purple-900 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-purple-200">
                TRC-ICD
              </span>
            </div>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • Patient Assessment Form</p>
          </div>
        </div>

        {editId && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
            isModelComplete ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
          }`}>
            {isModelComplete ? "نموذج مكتمل ومعتمد (للقراءة فقط)" : "استكمال دور متبقٍ"}
          </span>
        )}
      </div>

      {/* Role Permission Guidance Banner */}
      <div className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 shadow-xs no-print ${
        isAdmin
          ? "bg-purple-50/80 border-purple-200 text-purple-900"
          : role === "nurse"
          ? "bg-blue-50/80 border-blue-200 text-blue-900"
          : role === "technician"
          ? "bg-amber-50/90 border-amber-200 text-amber-900"
          : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
      }`}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg shadow-xs bg-white border border-slate-200">
          {isAdmin ? "👑" : role === "nurse" ? "🟦" : role === "technician" ? "🟨" : "🟩"}
        </div>
        <div className="flex-1">
          <div className="font-bold flex items-center gap-2">
            <span>
              {isAdmin
                ? "حساب مسؤول عام (صلاحيات استكمال)"
                : role === "nurse"
                ? "دورك الحالي: تمريض (Nurse)"
                : role === "technician"
                ? "دورك الحالي: فني أشعة (Technician)"
                : "دورك الحالي: طبيب أخصائي أشعة (Radiologist)"}
            </span>
            {profile?.full_name && (
              <span className="text-[11px] font-medium opacity-75">
                • المستخدم: {profile.full_name}
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs mt-1 leading-relaxed opacity-95">
            {isAdmin
              ? editId
                ? isModelComplete
                  ? "هذا النموذج مكتمل ومعتمد رسمياً من جميع الأطراف — للقراءة والطباعة فقط ولا يمكن تعديله."
                  : "بصفتك مسؤولاً، تم قفل الأقسام المعتمدة سابقاً للقراءة فقط. يمكنك استكمال وتوثيق المهام الشاغرة للأدوار المتبقية في هذا النموذج دون تعديل ما تم اعتماده."
                : "بصفتك مسؤول النظام، يمكنك بدء نموذج جديد أو استكمال النماذج غير المكتملة للأدوار الأخرى."
              : role === "nurse"
              ? "صلاحياتك: البيانات العامة، العلامات الحيوية، التاريخ المرضي، التقييم السريري، تقييم السيدات، خطة رعاية السقوط، والوصلات والأدوية."
              : role === "technician"
              ? "صلاحياتك محددة في: خطة الرعاية الخاصة بالتصوير التشخيصي (خطة الرعاية 2: حساب جرعة الإشعاع، توفير الحماية، وتأمين المريض). أقسام التمريض والتحاليل المعملية للقراءة فقط."
              : "صلاحياتك محددة في: تسجيل نتائج المعمل والتحاليل الحيوية (GFR, Creatinine...) وتوقيع الطبيب. أقسام التمريض والتصوير للقراءة فقط."}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm no-print">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
        className="space-y-5 no-print"
      >
        {/* SECTION 1: Patient & Visit Info */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">1. البيانات العامة للمريض والزيارة</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
              isNurseDisabled ? "bg-slate-200 text-slate-600 border-slate-300" : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {isNurseDisabled && <Lock className="w-3 h-3" />}
              <span>{isNurseDisabled ? "غير متاح لدورك (خاص بالتمريض)" : "خاص بالتمريض"}</span>
            </span>
          </div>

          {isNurseDisabled && !searchParams.get("editId") && (
            <div className="space-y-3">
              {!editId ? (
                <div className="bg-sky-50 border border-sky-200 p-4 rounded-xl space-y-3 text-xs text-sky-950 shadow-2xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="font-semibold">
                        لتحميل واستكمال تقييم مريض غير مكتمل، أدخل رقم الملف الطبي (MRN):
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        value={searchMrnInput}
                        onChange={(e) => setSearchMrnInput(e.target.value)}
                        placeholder="رقم الملف الطبي..."
                        className="px-3 py-1.5 border border-sky-300 rounded-lg text-xs bg-white outline-none w-full sm:w-48 font-mono focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            searchPatientByMrn(searchMrnInput);
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={searchLoading || !searchMrnInput.trim()}
                        onClick={() => searchPatientByMrn(searchMrnInput)}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-xs"
                      >
                        {searchLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        <span>بحث</span>
                      </button>
                    </div>
                  </div>

                  {searchStatus && (
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-center gap-2 font-medium transition-all ${
                        searchStatus.type === "loading"
                          ? "bg-sky-100/70 text-sky-900 border-sky-300"
                          : searchStatus.type === "error"
                          ? "bg-rose-50 text-rose-800 border-rose-200"
                          : searchStatus.type === "warning"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : searchStatus.type === "info"
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {searchStatus.type === "loading" && <Loader2 className="w-4 h-4 animate-spin text-sky-700 shrink-0" />}
                      {searchStatus.type === "error" && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                      {searchStatus.type === "warning" && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                      {searchStatus.type === "info" && <InfoIcon className="w-4 h-4 text-blue-600 shrink-0" />}
                      {searchStatus.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      <span>{searchStatus.message}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-extrabold text-emerald-950 flex items-center gap-2">
                        <span>تم تحميل نموذج تقييم غير مكتمل</span>
                        <span className="font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                          MRN: {mrn}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium">
                        المريض: <strong>{patientName}</strong> {procedureName ? `• الإجراء: ${procedureName}` : ""} • يمكنك الآن استكمال الأقسام المخصصة لدورك وحفظ النموذج.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetSearch}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>بحث عن مريض آخر</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {isNurseDisabled && !editId && (
            <div className="p-3 bg-slate-100/60 rounded-xl border border-slate-200 text-slate-500 text-xs flex items-center gap-2 font-medium">
              <InfoIcon className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                أدخل رقم الملف الطبي في خانة البحث بالأعلى. لن يتم ملء النموذج إلا في حال وجود تقييم غير مكتمل مسجل من قبل التمريض لهذا المريض لاستكماله.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم الملف الطبي <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={mrnInputRef}
                  type="text"
                  disabled={isNurseDisabled}
                  value={mrn}
                  onChange={(e) => {
                    setMrn(e.target.value);
                    searchPatientByMrn(e.target.value);
                  }}
                  placeholder="رقم الملف الطبي..."
                  className={`w-full pl-9 pr-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm font-mono transition-all ${
                    isNurseDisabled
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : fieldErrors.mrn
                      ? "border-rose-400 bg-rose-50/40"
                      : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                disabled={isNurseDisabled}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="الاسم الرباعي كاملاً..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isNurseDisabled
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.patientName
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                }`}
              />
              {fieldErrors.patientName && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.patientName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الجنس <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-1.5">
                {["ذكر", "انثي"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    disabled={isNurseDisabled}
                    onClick={() => {
                      const normG = normalizeGender(g);
                      setGender(normG);
                      if (normG !== "انثي") {
                        setLmpDate("");
                        setMenopause(false);
                        setDelayedPeriod(null);
                        setContraceptiveUse(null);
                        setPlanningPregnancy(null);
                        setPregnantOrSuspected(false);
                        setLactating(false);
                      }
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                      isNurseDisabled
                        ? normalizeGender(gender) === normalizeGender(g)
                          ? "bg-slate-600 text-white border-slate-600 cursor-not-allowed"
                          : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        : normalizeGender(gender) === normalizeGender(g)
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">السن</label>
              <input
                type="number"
                disabled={isNurseDisabled}
                value={age}
                onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
                placeholder="السن..."
                className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الطول (سم)</label>
              <input
                type="number"
                disabled={isNurseDisabled}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value ? Number(e.target.value) : "")}
                placeholder="الطول..."
                className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الوزن (كجم)</label>
              <input
                type="number"
                disabled={isNurseDisabled}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : "")}
                placeholder="الوزن..."
                className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الطبيب المعالج</label>
              <input
                type="text"
                disabled={isNurseDisabled}
                value={attendingPhysician}
                onChange={(e) => setAttendingPhysician(e.target.value)}
                placeholder="اسم الطبيب المعالج..."
                className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">هاتف الطبيب المعالج</label>
              <input
                type="text"
                disabled={isNurseDisabled}
                value={physicianPhone}
                onChange={(e) => setPhysicianPhone(e.target.value)}
                placeholder="رقم هاتف الطبيب..."
                className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Vital Signs */}
        <div className={`p-5 sm:p-6 rounded-2xl border shadow-xs space-y-4 transition-all ${
          isNurseDisabled
            ? "bg-slate-50/90 border-slate-200 text-slate-800"
            : "bg-white border-slate-200/80"
        }`}>
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className={`text-xs sm:text-sm font-bold flex items-center gap-2 ${
              isNurseDisabled ? "text-slate-500" : "text-slate-800"
            }`}>
              <HeartPulse className={`w-4 h-4 ${isNurseDisabled ? "text-slate-400" : "text-rose-600"}`} />
              <span>2. العلامات الحيوية (Vital Signs)</span>
            </h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
              isNurseDisabled
                ? "bg-slate-200 text-slate-600 border-slate-300"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {isNurseDisabled && <Lock className="w-3 h-3" />}
              <span>{isNurseDisabled ? "غير متاح لدورك (خاص بالتمريض)" : "خاص بالتمريض"}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">ضغط الدم (BP)</label>
              <input
                type="text"
                disabled={isNurseDisabled}
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                placeholder="120/80"
                className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">درجة الحرارة (°C)</label>
              <input
                type="number"
                step="0.1"
                disabled={isNurseDisabled}
                value={temperature}
                onChange={(e) => setTemperature(e.target.value ? Number(e.target.value) : "")}
                placeholder="37.0"
                className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">النبض (HR bpm)</label>
              <input
                type="number"
                disabled={isNurseDisabled}
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value ? Number(e.target.value) : "")}
                placeholder="72"
                className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">معدل التنفس (RR)</label>
              <input
                type="number"
                disabled={isNurseDisabled}
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(e.target.value ? Number(e.target.value) : "")}
                placeholder="16"
                className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">تشبع الأكسجين (SaO2 %)</label>
              <input
                type="number"
                disabled={isNurseDisabled}
                value={oxygenSaturation}
                onChange={(e) => setOxygenSaturation(e.target.value ? Number(e.target.value) : "")}
                placeholder="98"
                className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Clinical Diagnosis, History, Allergy & Mobility */}
        <div className={`p-5 sm:p-6 rounded-2xl border shadow-xs space-y-4 transition-all ${
          isNurseDisabled
            ? "bg-slate-50/90 border-slate-200 text-slate-800"
            : "bg-white border-slate-200/80"
        }`}>
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className={`text-xs sm:text-sm font-bold flex items-center gap-2 ${
              isNurseDisabled ? "text-slate-500" : "text-slate-800"
            }`}>
              <span>3. التقييم السريري والتاريخ المرضي</span>
            </h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
              isNurseDisabled
                ? "bg-slate-200 text-slate-600 border-slate-300"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {isNurseDisabled && <Lock className="w-3 h-3" />}
              <span>{isNurseDisabled ? "غير متاح لدورك (خاص بالتمريض)" : "خاص بالتمريض"}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الإجراء المطلوب <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isNurseDisabled}
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                placeholder="مثال: أشعة مقطعية على المخ بالصبغة..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm ${
                  isNurseDisabled
                    ? "bg-slate-100 text-slate-600 cursor-not-allowed"
                    : fieldErrors.procedureName
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">التشخيص (Diagnosis)</label>
              <input
                type="text"
                disabled={isNurseDisabled}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="التشخيص المبدئي..."
                className={`w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none text-xs sm:text-sm ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              التاريخ المرضي والجراحي (Past medical & surgical history)
            </label>
            <textarea
              rows={2}
              disabled={isNurseDisabled}
              value={pastHistory}
              onChange={(e) => setPastHistory(e.target.value)}
              placeholder="العمليات السابقة والأمراض المزمنة..."
              className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs outline-none ${
                isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
              }`}
            />
          </div>

          {/* Allergy Matrix */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-800">الحساسية (Allergy):</label>
            <div className="flex flex-wrap gap-2">
              {["لا يوجد", "حساسية غذاء", "صبغة", "ادوية", "أخري"].map((type) => {
                const isSelected = allergyTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={isNurseDisabled}
                    onClick={() => handleAllergyToggle(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isNurseDisabled
                        ? isSelected
                          ? "bg-slate-600 text-white border-slate-600 cursor-not-allowed"
                          : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        : isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
            {allergyTypes.some((a) => a !== "لا يوجد") && (
              <input
                type="text"
                disabled={isNurseDisabled}
                value={allergyDetails}
                onChange={(e) => setAllergyDetails(e.target.value)}
                placeholder="أذكر تفاصيل الحساسية..."
                className={`w-full mt-2 px-3 py-1.5 border border-slate-300 rounded-lg text-xs ${
                  isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : ""
                }`}
              />
            )}
          </div>

          {/* Mobility & Smoking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800">حركة المريض (Mobility):</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  "طبيعية",
                  "عدم اتزان في الحركة",
                  "يستخدم وسائل مساعدة في الحركة",
                  "ملازم الفراش",
                ].map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={isNurseDisabled}
                    onClick={() => setMobilityStatus(m)}
                    className={`p-2 rounded-lg text-[11px] font-semibold border transition-all text-right ${
                      isNurseDisabled
                        ? mobilityStatus === m
                          ? "bg-slate-600 text-white border-slate-600 cursor-not-allowed"
                          : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        : mobilityStatus === m
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800">التدخين (Smoking):</label>
              <div className="flex gap-2">
                {[
                  { val: false, label: "لا يدخن" },
                  { val: true, label: "مدخن" },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    disabled={isNurseDisabled}
                    onClick={() => setIsSmoker(s.val)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      isNurseDisabled
                        ? isSmoker === s.val
                          ? "bg-slate-600 text-white border-slate-600 cursor-not-allowed"
                          : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        : isSmoker === s.val
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Women Assessment (بالنسبة للسيدات) */}
        <div className={`p-5 sm:p-6 rounded-2xl border transition-all space-y-4 ${
          !isFemale || isNurseDisabled
            ? "bg-slate-50/90 border-slate-200 text-slate-800"
            : "bg-rose-50/40 border-rose-200/80 shadow-xs"
        }`}>
          <div className={`border-b pb-2 flex justify-between items-center ${isFemale && !isNurseDisabled ? "border-rose-200" : "border-slate-200"}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isFemale && !isNurseDisabled ? "bg-rose-500" : "bg-slate-400"}`}></span>
              <h3 className={`text-xs sm:text-sm font-bold ${isFemale && !isNurseDisabled ? "text-rose-950" : "text-slate-700"}`}>
                4. بالنسبة للسيدات (Women Assessment)
              </h3>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border flex items-center gap-1 ${
              !isFemale
                ? "text-slate-500 bg-slate-100 border-slate-200"
                : isNurseDisabled
                ? "text-slate-600 bg-slate-200 border-slate-300"
                : "text-rose-700 bg-rose-100/80 border-rose-200"
            }`}>
              {!isFemale ? (
                "خاص بالسيدات (غير مفعل - متاح للإناث فقط)"
              ) : isNurseDisabled ? (
                <>
                  <Lock className="w-3 h-3" />
                  <span>غير متاح لدورك (خاص بالتمريض)</span>
                </>
              ) : (
                "خاص بالسيدات (مفعل)"
              )}
            </span>
          </div>

          {!isFemale && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-800">
              <span className="text-sm">ℹ️</span>
              <span>هذا القسم غير متاح للتعديل لأن جنس المريض ليس أنثى. يتم تفعيله تلقائياً عند تحديد الجنس كـ &quot;انثي&quot;.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${isFemale ? "text-slate-800" : "text-slate-400"}`}>
                تاريخ آخر دورة شهرية (LMP) :
              </label>
              <input
                type="date"
                disabled={isWomenDisabled}
                value={lmpDate}
                onChange={(e) => setLmpDate(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl text-xs transition-all ${
                  isWomenDisabled
                    ? "bg-slate-100/80 text-slate-400 border-slate-200 cursor-not-allowed"
                    : "bg-white text-slate-800 border-rose-200 focus:outline-none focus:border-rose-400"
                }`}
              />
            </div>

            <div className="sm:pt-5">
              <label className={`flex items-center gap-2 text-xs font-bold p-2.5 rounded-xl border transition-colors ${
                isWomenDisabled
                  ? "bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-800 border-rose-200/80 hover:bg-rose-50/50 cursor-pointer"
              }`}>
                <input
                  type="checkbox"
                  disabled={isWomenDisabled}
                  checked={menopause}
                  onChange={(e) => setMenopause(e.target.checked)}
                  className="accent-rose-600 w-4 h-4 rounded disabled:cursor-not-allowed"
                />
                <span>في مرحلة انقطاع الطمث (Menopause)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-3 rounded-xl border space-y-2 transition-all ${
              isWomenDisabled ? "bg-slate-100/50 border-slate-200" : "bg-white border-rose-200/80"
            }`}>
              <span className={`text-xs font-bold block ${isWomenDisabled ? "text-slate-600" : "text-slate-800"}`}>
                هل هناك تأخر في موعد الدورة الشهرية ؟
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isWomenDisabled}
                  onClick={() => setDelayedPeriod(delayedPeriod === false ? null : false)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    isWomenDisabled
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : delayedPeriod === false
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  لا
                </button>
                <button
                  type="button"
                  disabled={isWomenDisabled}
                  onClick={() => setDelayedPeriod(delayedPeriod === true ? null : true)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    isWomenDisabled
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : delayedPeriod === true
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  نعم
                </button>
              </div>
            </div>

            <div className={`p-3 rounded-xl border space-y-2 transition-all ${
              isWomenDisabled ? "bg-slate-100/50 border-slate-200" : "bg-white border-rose-200/80"
            }`}>
              <span className={`text-xs font-bold block ${isWomenDisabled ? "text-slate-600" : "text-slate-800"}`}>
                هل تأخذين وسائل لمنع الحمل ؟
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isWomenDisabled}
                  onClick={() => setContraceptiveUse(contraceptiveUse === false ? null : false)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    isWomenDisabled
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : contraceptiveUse === false
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  لا
                </button>
                <button
                  type="button"
                  disabled={isWomenDisabled}
                  onClick={() => setContraceptiveUse(contraceptiveUse === true ? null : true)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    isWomenDisabled
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : contraceptiveUse === true
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  نعم
                </button>
              </div>
            </div>

            <div className={`p-3 rounded-xl border space-y-2 transition-all ${
              isWomenDisabled ? "bg-slate-100/50 border-slate-200" : "bg-white border-rose-200/80"
            }`}>
              <span className={`text-xs font-bold block ${isWomenDisabled ? "text-slate-600" : "text-slate-800"}`}>
                هل تخططين للحمل ؟
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isWomenDisabled}
                  onClick={() => setPlanningPregnancy(planningPregnancy === false ? null : false)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    isWomenDisabled
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : planningPregnancy === false
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  لا
                </button>
                <button
                  type="button"
                  disabled={isWomenDisabled}
                  onClick={() => setPlanningPregnancy(planningPregnancy === true ? null : true)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    isWomenDisabled
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : planningPregnancy === true
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  نعم
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className={`flex items-center gap-2 text-xs font-bold p-2.5 rounded-xl border transition-colors flex-1 sm:flex-initial ${
              isWomenDisabled
                ? "bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-white text-slate-800 border-rose-200/80 hover:bg-rose-50/50 cursor-pointer"
            }`}>
              <input
                type="checkbox"
                disabled={isWomenDisabled}
                checked={pregnantOrSuspected}
                onChange={(e) => setPregnantOrSuspected(e.target.checked)}
                className="accent-rose-600 w-4 h-4 rounded disabled:cursor-not-allowed"
              />
              <span>حامل أو يشتبه في الحمل</span>
            </label>

            <label className={`flex items-center gap-2 text-xs font-bold p-2.5 rounded-xl border transition-colors flex-1 sm:flex-initial ${
              isWomenDisabled
                ? "bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-white text-slate-800 border-rose-200/80 hover:bg-rose-50/50 cursor-pointer"
            }`}>
              <input
                type="checkbox"
                disabled={isWomenDisabled}
                checked={lactating}
                onChange={(e) => setLactating(e.target.checked)}
                className="accent-rose-600 w-4 h-4 rounded disabled:cursor-not-allowed"
              />
              <span>في مرحلة الرضاعة</span>
            </label>
          </div>
        </div>

        {/* SECTION 5: Medical Review & Prosthetics */}
        <div className={`p-5 sm:p-6 rounded-2xl border shadow-xs space-y-4 transition-all ${
          isNurseDisabled
            ? "bg-slate-50/90 border-slate-200 text-slate-800"
            : "bg-white border-slate-200/80"
        }`}>
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className={`text-xs sm:text-sm font-bold flex items-center gap-2 ${
              isNurseDisabled ? "text-slate-700" : "text-slate-800"
            }`}>
              <Stethoscope className={`w-4 h-4 ${isNurseDisabled ? "text-slate-400" : "text-purple-600"}`} />
              <span>5. مسح الأمراض المزمنة والأجهزة التعويضية (Medical Review)</span>
            </h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
              isNurseDisabled
                ? "bg-slate-200 text-slate-600 border-slate-300"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {isNurseDisabled && <Lock className="w-3 h-3" />}
              <span>{isNurseDisabled ? "غير متاح لدورك (خاص بالتمريض)" : "خاص بالتمريض"}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className={`p-3 rounded-xl border space-y-1.5 transition-colors ${
              isNurseDisabled ? "bg-slate-100/50 border-slate-200/70" : "bg-slate-50 border-slate-200"
            }`}>
              <label className={`flex items-center justify-between font-bold ${
                isNurseDisabled ? "text-slate-700 cursor-not-allowed" : "text-slate-800 cursor-pointer"
              }`}>
                <span>أمراض خاصة بالكلى؟</span>
                <input
                  type="checkbox"
                  disabled={isNurseDisabled}
                  checked={kidneyDisease}
                  onChange={(e) => setKidneyDisease(e.target.checked)}
                  className={`w-4 h-4 rounded ${isNurseDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-indigo-600"}`}
                />
              </label>
              {kidneyDisease && (
                <input
                  type="text"
                  disabled={isNurseDisabled}
                  value={kidneyDetails}
                  onChange={(e) => setKidneyDetails(e.target.value)}
                  placeholder="أذكر تفاصيل مرض الكلى..."
                  className={`w-full px-2.5 py-1 border rounded-lg text-xs ${
                    isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200" : "bg-white"
                  }`}
                />
              )}
            </div>

            <div className={`p-3 rounded-xl border space-y-1.5 transition-colors ${
              isNurseDisabled ? "bg-slate-100/50 border-slate-200/70" : "bg-slate-50 border-slate-200"
            }`}>
              <label className={`flex items-center justify-between font-bold ${
                isNurseDisabled ? "text-slate-700 cursor-not-allowed" : "text-slate-800 cursor-pointer"
              }`}>
                <span>أمراض خاصة بالقلب؟</span>
                <input
                  type="checkbox"
                  disabled={isNurseDisabled}
                  checked={heartDisease}
                  onChange={(e) => setHeartDisease(e.target.checked)}
                  className={`w-4 h-4 rounded ${isNurseDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-indigo-600"}`}
                />
              </label>
              {heartDisease && (
                <input
                  type="text"
                  disabled={isNurseDisabled}
                  value={heartDetails}
                  onChange={(e) => setHeartDetails(e.target.value)}
                  placeholder="أذكر تفاصيل مرض القلب..."
                  className={`w-full px-2.5 py-1 border rounded-lg text-xs ${
                    isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200" : "bg-white"
                  }`}
                />
              )}
            </div>

            <div className={`p-3 rounded-xl border space-y-1.5 transition-colors ${
              isNurseDisabled ? "bg-slate-100/50 border-slate-200/70" : "bg-slate-50 border-slate-200"
            }`}>
              <label className={`flex items-center justify-between font-bold ${
                isNurseDisabled ? "text-slate-700 cursor-not-allowed" : "text-slate-800 cursor-pointer"
              }`}>
                <span>أدوية مضادة للتجلط؟</span>
                <input
                  type="checkbox"
                  disabled={isNurseDisabled}
                  checked={anticoagulants}
                  onChange={(e) => setAnticoagulants(e.target.checked)}
                  className={`w-4 h-4 rounded ${isNurseDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-indigo-600"}`}
                />
              </label>
              {anticoagulants && (
                <input
                  type="text"
                  disabled={isNurseDisabled}
                  value={anticoagulantDetails}
                  onChange={(e) => setAnticoagulantDetails(e.target.value)}
                  placeholder="اسم الدواء المضاد للتجلط..."
                  className={`w-full px-2.5 py-1 border rounded-lg text-xs ${
                    isNurseDisabled ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200" : "bg-white"
                  }`}
                />
              )}
            </div>

            <div className={`p-3 rounded-xl border space-y-1.5 transition-colors ${
              isNurseDisabled ? "bg-slate-100/50 border-slate-200/70" : "bg-slate-50 border-slate-200"
            }`}>
              <label className={`flex items-center justify-between font-bold ${
                isNurseDisabled ? "text-slate-700 cursor-not-allowed" : "text-slate-800 cursor-pointer"
              }`}>
                <span>جهاز تنظيم ضربات القلب (Pacemaker)؟</span>
                <input
                  type="checkbox"
                  disabled={isNurseDisabled}
                  checked={pacemaker}
                  onChange={(e) => setPacemaker(e.target.checked)}
                  className={`w-4 h-4 rounded ${isNurseDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-rose-600"}`}
                />
              </label>
            </div>

            <div className={`p-3 rounded-xl border space-y-1.5 transition-colors ${
              isNurseDisabled ? "bg-slate-100/50 border-slate-200/70" : "bg-slate-50 border-slate-200"
            }`}>
              <label className={`flex items-center justify-between font-bold ${
                isNurseDisabled ? "text-slate-700 cursor-not-allowed" : "text-slate-800 cursor-pointer"
              }`}>
                <span>مشبك تمدد الأوعية الدماغية (Aneurysm Clip)؟</span>
                <input
                  type="checkbox"
                  disabled={isNurseDisabled}
                  checked={aneurysmClip}
                  onChange={(e) => setAneurysmClip(e.target.checked)}
                  className={`w-4 h-4 rounded ${isNurseDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-rose-600"}`}
                />
              </label>
            </div>

            <div className={`p-3 rounded-xl border space-y-1.5 transition-colors ${
              isNurseDisabled ? "bg-slate-100/50 border-slate-200/70" : "bg-slate-50 border-slate-200"
            }`}>
              <label className={`flex items-center justify-between font-bold ${
                isNurseDisabled ? "text-slate-700 cursor-not-allowed" : "text-slate-800 cursor-pointer"
              }`}>
                <span>مرضى منقوصي المناعة (سكر/سرطان/كورتيزون/كيماوي)؟</span>
                <input
                  type="checkbox"
                  disabled={isNurseDisabled}
                  checked={immunocompromised}
                  onChange={(e) => setImmunocompromised(e.target.checked)}
                  className={`w-4 h-4 rounded ${isNurseDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-indigo-600"}`}
                />
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 6: Psychological, Mental & Abuse Assessment */}
        <div className={`p-5 sm:p-6 rounded-2xl border shadow-xs space-y-4 transition-all ${
          isNurseDisabled
            ? "bg-slate-50/90 border-slate-200 text-slate-800"
            : "bg-white border-slate-200/80"
        }`}>
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className={`text-xs sm:text-sm font-bold flex items-center gap-2 ${
              isNurseDisabled ? "text-slate-500" : "text-slate-800"
            }`}>
              <Activity className={`w-4 h-4 ${isNurseDisabled ? "text-slate-400" : "text-purple-600"}`} />
              <span>6. الحالة النفسية والعقلية وعلامات الإيذاء (Psychological & Mental Assessment)</span>
            </h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
              isNurseDisabled
                ? "bg-slate-200 text-slate-600 border-slate-300"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {isNurseDisabled && <Lock className="w-3 h-3" />}
              <span>{isNurseDisabled ? "غير متاح لدورك (خاص بالتمريض)" : "خاص بالتمريض"}</span>
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Psychological Status */}
            <div className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
              isNurseDisabled ? "bg-slate-100/50 border-slate-200/70" : "bg-purple-50/40 border-purple-100"
            }`}>
              <label className={`block font-bold ${isNurseDisabled ? "text-slate-500" : "text-purple-950"}`}>
                الحالة النفسية للمريض (Psychological Status):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["طبيعية", "مكتئب", "قلق", "غير متعاون"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={isNurseDisabled}
                    onClick={() => setPsychologicalStatus(status)}
                    className={`py-2 px-3 rounded-lg font-bold border text-xs transition-all flex items-center justify-center gap-1.5 ${
                      isNurseDisabled
                        ? psychologicalStatus === status
                          ? "bg-slate-300 text-slate-700 border-slate-400 cursor-not-allowed shadow-none font-extrabold"
                          : "bg-slate-100/40 text-slate-300 border-slate-200/50 cursor-not-allowed"
                        : psychologicalStatus === status
                        ? "bg-[#621c6f] text-white border-[#621c6f] shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-purple-50/60"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      isNurseDisabled
                        ? psychologicalStatus === status ? "bg-slate-600" : "bg-slate-300"
                        : psychologicalStatus === status ? "bg-white" : "bg-slate-300"
                    }`} />
                    <span>{status}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mental Status */}
            <div className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
              isNurseDisabled ? "bg-slate-100/50 border-slate-200/70" : "bg-blue-50/40 border-blue-100"
            }`}>
              <label className={`block font-bold ${isNurseDisabled ? "text-slate-500" : "text-blue-950"}`}>
                الحالة العقلية للمريض (Mental Status):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                  { key: "طبيعي", label: "طبيعي" },
                  { key: "ملاحظة وجود مشكلة في طريقة التحدث", label: "مشكلة في طريقة التحدث" },
                  { key: "عدم الانتباه للمكان أو الزمان", label: "عدم الانتباه للمكان أو الزمان" },
                  { key: "أخرى", label: "أخرى" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={isNurseDisabled}
                    onClick={() => setMentalStatus(item.key)}
                    className={`py-2 px-3 rounded-lg font-bold border text-xs transition-all flex items-center justify-center gap-1.5 ${
                      isNurseDisabled
                        ? mentalStatus === item.key
                          ? "bg-slate-300 text-slate-700 border-slate-400 cursor-not-allowed shadow-none font-extrabold"
                          : "bg-slate-100/40 text-slate-300 border-slate-200/50 cursor-not-allowed"
                        : mentalStatus === item.key
                        ? "bg-blue-700 text-white border-blue-700 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-blue-50/60"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      isNurseDisabled
                        ? mentalStatus === item.key ? "bg-slate-600" : "bg-slate-300"
                        : mentalStatus === item.key ? "bg-white" : "bg-slate-300"
                    }`} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              {mentalStatus === "أخرى" && (
                <div className="pt-2 animate-in fade-in duration-150">
                  <input
                    type="text"
                    disabled={isNurseDisabled}
                    value={mentalDetails}
                    onChange={(e) => setMentalDetails(e.target.value)}
                    placeholder="أذكر تفاصيل الحالة العقلية..."
                    className={`w-full px-3 py-2 border rounded-lg text-xs outline-none ${
                      isNurseDisabled ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200" : "bg-white border-blue-200 focus:ring-2 focus:ring-blue-400"
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Abuse or Neglect Signs */}
            <div className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
              isNurseDisabled ? "bg-slate-100/50 border-slate-200/70" : "bg-amber-50/40 border-amber-100"
            }`}>
              <label className={`block font-bold ${isNurseDisabled ? "text-slate-500" : "text-amber-950"}`}>
                هل يظهر على المريض أي علامات إيذاء أو إهمال؟
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isNurseDisabled}
                  onClick={() => {
                    setAbuseSigns(false);
                    setAbuseDetails("");
                  }}
                  className={`py-2 px-6 rounded-lg font-bold border text-xs transition-all flex items-center gap-1.5 ${
                    isNurseDisabled
                      ? !abuseSigns
                        ? "bg-slate-300 text-slate-700 border-slate-400 cursor-not-allowed shadow-none font-extrabold"
                        : "bg-slate-100/40 text-slate-300 border-slate-200 cursor-not-allowed"
                      : !abuseSigns
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    isNurseDisabled
                      ? !abuseSigns ? "bg-slate-600" : "bg-slate-300"
                      : !abuseSigns ? "bg-white" : "bg-slate-300"
                  }`} />
                  <span>لا</span>
                </button>

                <button
                  type="button"
                  disabled={isNurseDisabled}
                  onClick={() => setAbuseSigns(true)}
                  className={`py-2 px-6 rounded-lg font-bold border text-xs transition-all flex items-center gap-1.5 ${
                    isNurseDisabled
                      ? abuseSigns
                        ? "bg-slate-300 text-slate-700 border-slate-400 cursor-not-allowed shadow-none font-extrabold"
                        : "bg-slate-100/40 text-slate-300 border-slate-200 cursor-not-allowed"
                      : abuseSigns
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-rose-50/50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    isNurseDisabled
                      ? abuseSigns ? "bg-slate-600" : "bg-slate-300"
                      : abuseSigns ? "bg-white" : "bg-slate-300"
                  }`} />
                  <span>نعم</span>
                </button>
              </div>

              {abuseSigns && (
                <div className="pt-2 animate-in fade-in duration-150">
                  <input
                    type="text"
                    disabled={isNurseDisabled}
                    value={abuseDetails}
                    onChange={(e) => setAbuseDetails(e.target.value)}
                    placeholder="أذكر تفاصيل علامات الإيذاء أو الإهمال الملاحظة..."
                    className={`w-full px-3 py-2 border border-rose-200 rounded-lg text-xs focus:ring-2 focus:ring-rose-400 outline-none ${
                      isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                    }`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 7: Lab Results */}
        <div className={`p-5 sm:p-6 rounded-2xl border shadow-xs space-y-4 transition-all ${
          isRadiologistDisabled
            ? "bg-slate-50/90 border-slate-200 text-slate-800"
            : "bg-white border-slate-200/80"
        }`}>
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className={`text-xs sm:text-sm font-bold flex items-center gap-2 ${
              isRadiologistDisabled ? "text-slate-700" : "text-slate-800"
            }`}>
              <span>7. نتائج المعمل (Lab Results)</span>
            </h3>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
              isRadiologistDisabled
                ? "bg-slate-200 text-slate-600 border-slate-300"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}>
              {isRadiologistDisabled && <Lock className="w-3 h-3" />}
              <span>{isRadiologistDisabled ? "غير متاح لدورك (خاص بأخصائي الأشعة)" : "خاص بأخصائي الأشعة (Radiologist) — إجباري *"}</span>
            </span>
          </div>

          {!canEditRadiologist ? (
            <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
              ℹ️ نتائج التحاليل المعملية مخصصة لإدخال أخصائي الأشعة أو المسؤول (للقراءة فقط لدورك الحالي).
            </p>
          ) : (
            <p className="text-[11px] text-emerald-800 bg-emerald-50/90 p-2.5 rounded-lg border border-emerald-200 font-medium flex items-center gap-1.5">
              <span>⚠️</span>
              <span><strong>تنبيه لطبيب الأشعة:</strong> جميع حقول نتائج المعمل الستة أدناه إلزامية لتأكيد واعتماد التقييم بنجاح.</span>
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Creatinine {canEditRadiologist && <span className="text-rose-500 font-extrabold">*</span>}
              </label>
              <input
                type="number"
                step="0.01"
                disabled={isRadiologistDisabled}
                value={labCreatinine}
                onChange={(e) => {
                  setLabCreatinine(e.target.value ? Number(e.target.value) : "");
                  if (fieldErrors.labCreatinine) {
                    setFieldErrors((prev) => ({ ...prev, labCreatinine: "" }));
                  }
                }}
                placeholder="0.9"
                className={`w-full px-2.5 py-1.5 border rounded-lg font-mono text-center transition-all ${
                  isRadiologistDisabled
                    ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200"
                    : fieldErrors.labCreatinine
                    ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-300"
                    : "border-slate-300 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                }`}
              />
              {fieldErrors.labCreatinine && (
                <p className="text-[10px] text-rose-600 font-bold mt-1 text-center">{fieldErrors.labCreatinine}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                GFR {canEditRadiologist && <span className="text-rose-500 font-extrabold">*</span>}
              </label>
              <input
                type="number"
                disabled={isRadiologistDisabled}
                value={labGfr}
                onChange={(e) => {
                  setLabGfr(e.target.value ? Number(e.target.value) : "");
                  if (fieldErrors.labGfr) {
                    setFieldErrors((prev) => ({ ...prev, labGfr: "" }));
                  }
                }}
                placeholder="90"
                className={`w-full px-2.5 py-1.5 border rounded-lg font-mono text-center transition-all ${
                  isRadiologistDisabled
                    ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200"
                    : fieldErrors.labGfr
                    ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-300"
                    : "border-slate-300 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                }`}
              />
              {fieldErrors.labGfr && (
                <p className="text-[10px] text-rose-600 font-bold mt-1 text-center">{fieldErrors.labGfr}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Urea {canEditRadiologist && <span className="text-rose-500 font-extrabold">*</span>}
              </label>
              <input
                type="number"
                disabled={isRadiologistDisabled}
                value={labUrea}
                onChange={(e) => {
                  setLabUrea(e.target.value ? Number(e.target.value) : "");
                  if (fieldErrors.labUrea) {
                    setFieldErrors((prev) => ({ ...prev, labUrea: "" }));
                  }
                }}
                placeholder="30"
                className={`w-full px-2.5 py-1.5 border rounded-lg font-mono text-center transition-all ${
                  isRadiologistDisabled
                    ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200"
                    : fieldErrors.labUrea
                    ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-300"
                    : "border-slate-300 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                }`}
              />
              {fieldErrors.labUrea && (
                <p className="text-[10px] text-rose-600 font-bold mt-1 text-center">{fieldErrors.labUrea}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                BUN {canEditRadiologist && <span className="text-rose-500 font-extrabold">*</span>}
              </label>
              <input
                type="number"
                disabled={isRadiologistDisabled}
                value={labBun}
                onChange={(e) => {
                  setLabBun(e.target.value ? Number(e.target.value) : "");
                  if (fieldErrors.labBun) {
                    setFieldErrors((prev) => ({ ...prev, labBun: "" }));
                  }
                }}
                placeholder="15"
                className={`w-full px-2.5 py-1.5 border rounded-lg font-mono text-center transition-all ${
                  isRadiologistDisabled
                    ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200"
                    : fieldErrors.labBun
                    ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-300"
                    : "border-slate-300 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                }`}
              />
              {fieldErrors.labBun && (
                <p className="text-[10px] text-rose-600 font-bold mt-1 text-center">{fieldErrors.labBun}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Sodium (Na+) {canEditRadiologist && <span className="text-rose-500 font-extrabold">*</span>}
              </label>
              <input
                type="number"
                disabled={isRadiologistDisabled}
                value={labSodium}
                onChange={(e) => {
                  setLabSodium(e.target.value ? Number(e.target.value) : "");
                  if (fieldErrors.labSodium) {
                    setFieldErrors((prev) => ({ ...prev, labSodium: "" }));
                  }
                }}
                placeholder="140"
                className={`w-full px-2.5 py-1.5 border rounded-lg font-mono text-center transition-all ${
                  isRadiologistDisabled
                    ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200"
                    : fieldErrors.labSodium
                    ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-300"
                    : "border-slate-300 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                }`}
              />
              {fieldErrors.labSodium && (
                <p className="text-[10px] text-rose-600 font-bold mt-1 text-center">{fieldErrors.labSodium}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Potassium (K+) {canEditRadiologist && <span className="text-rose-500 font-extrabold">*</span>}
              </label>
              <input
                type="number"
                step="0.1"
                disabled={isRadiologistDisabled}
                value={labPotassium}
                onChange={(e) => {
                  setLabPotassium(e.target.value ? Number(e.target.value) : "");
                  if (fieldErrors.labPotassium) {
                    setFieldErrors((prev) => ({ ...prev, labPotassium: "" }));
                  }
                }}
                placeholder="4.0"
                className={`w-full px-2.5 py-1.5 border rounded-lg font-mono text-center transition-all ${
                  isRadiologistDisabled
                    ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200"
                    : fieldErrors.labPotassium
                    ? "border-rose-400 bg-rose-50/50 ring-1 ring-rose-300"
                    : "border-slate-300 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                }`}
              />
              {fieldErrors.labPotassium && (
                <p className="text-[10px] text-rose-600 font-bold mt-1 text-center">{fieldErrors.labPotassium}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 8: Plan of Care (خطة الرعاية) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-teal-600" />
              <span>8. خطة الرعاية (Plan of Care)</span>
            </h3>
            <span className="text-[10px] bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full font-bold">
              الصفحة 2 & 3 من النموذج الرسمي
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Table 1: Fall Risk Plan (الصفحة الثانية من النموذج) */}
            <div className={`border rounded-xl overflow-hidden transition-all ${
              isNurseDisabled
                ? "border-slate-300 bg-slate-50 text-slate-800"
                : "border-teal-100 bg-teal-50/20"
            }`}>
              <div className={`px-3.5 py-2 font-bold flex justify-between items-center text-xs ${
                isNurseDisabled
                  ? "bg-slate-600 text-slate-100"
                  : "bg-teal-700 text-white"
              }`}>
                <span>خطة الرعاية 1: المريض معرض لخطر السقوط</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                    isNurseDisabled ? "bg-slate-700 text-slate-200" : "bg-blue-100 text-blue-950"
                  }`}>
                    {isNurseDisabled && <Lock className="w-3 h-3" />}
                    <span>{isNurseDisabled ? "مسؤولية التمريض (غير متاح لدورك)" : "مسؤولية التمريض"}</span>
                  </span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">Fall Risk</span>
                </div>
              </div>

              <div className="p-3.5 space-y-3">
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg border ${
                  isNurseDisabled
                    ? "bg-slate-50 border-slate-200 text-slate-700"
                    : "bg-white border-teal-100"
                }`}>
                  <div><strong className={isNurseDisabled ? "text-slate-700" : "text-teal-900"}>المشكلة أو الاحتياج (Problem or need):</strong> المريض معرض لخطر السقوط</div>
                  <div><strong className={isNurseDisabled ? "text-slate-700" : "text-teal-900"}>الهدف المراد الوصول إليه (Goal):</strong> تأمين المريض وحمايته من خطر السقوط</div>
                </div>

                <div>
                  <label className={`block font-bold mb-1.5 ${isNurseDisabled ? "text-slate-700" : "text-slate-800"}`}>
                    التدخلات أو الإجراءات (Interventions):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      "تمييز المريض بوضع سلسلة عليها حرف F",
                      "رفع جوانب الترولي أو إمداد المريض بأجهزة المساعدة علي المشي مثل الكرسي المتحرك.",
                      "التأكد من احتياطات سلامة البيئة (جفاف الأرض،عدم وجود عوائق)",
                      "تثقيف المريض و / أو ذويه حول الاجراءات المانعة للسقوط",
                    ].map((intervention) => (
                      <label
                        key={intervention}
                        className={`flex items-start gap-2 p-2 rounded-lg border transition-colors ${
                          isNurseDisabled
                            ? "bg-slate-100/80 border-slate-200 cursor-not-allowed text-slate-700"
                            : "bg-white border-slate-200 cursor-pointer hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isNurseDisabled}
                          checked={fallCareInterventions.includes(intervention)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFallCareInterventions([...fallCareInterventions, intervention]);
                            } else {
                              setFallCareInterventions(fallCareInterventions.filter((i) => i !== intervention));
                            }
                          }}
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            isNurseDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-teal-600"
                          }`}
                        />
                        <span className="text-[11px] font-medium">{intervention}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className={`p-2.5 rounded-lg border ${
                    isNurseDisabled ? "bg-slate-100/80 border-slate-200 text-slate-700" : "bg-white border-slate-200"
                  }`}>
                    <span className={`block font-bold mb-1.5 ${isNurseDisabled ? "text-slate-700" : "text-slate-800"}`}>المسئول عن التنفيذ (Who is responsible):</span>
                    <label className={`flex items-center gap-2 text-xs ${isNurseDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <input
                        type="checkbox"
                        disabled={isNurseDisabled}
                        checked={fallCareResponsible.includes("الممرضة")}
                        onChange={(e) => {
                          if (e.target.checked) setFallCareResponsible([...fallCareResponsible, "الممرضة"]);
                          else setFallCareResponsible(fallCareResponsible.filter((r) => r !== "الممرضة"));
                        }}
                        className={`w-4 h-4 ${isNurseDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-teal-600"}`}
                      />
                      <span className="font-medium">الممرضة</span>
                    </label>
                  </div>

                  <div className={`p-2.5 rounded-lg border space-y-1.5 ${
                    isNurseDisabled ? "bg-slate-100/80 border-slate-200 text-slate-700" : "bg-white border-slate-200"
                  }`}>
                    <span className={`block font-bold ${isNurseDisabled ? "text-slate-700" : "text-slate-800"}`}>المدة الزمنية (Time Frame):</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className={`flex items-center gap-1.5 ${isNurseDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input
                          type="radio"
                          name="fallTimeFrame"
                          disabled={isNurseDisabled}
                          checked={fallCareTimeFrame === "30 دقيقة"}
                          onChange={() => setFallCareTimeFrame("30 دقيقة")}
                          className={isNurseDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-teal-600"}
                        />
                        <span>30 دقيقة</span>
                      </label>

                      <label className={`flex items-center gap-1.5 ${isNurseDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input
                          type="radio"
                          name="fallTimeFrame"
                          disabled={isNurseDisabled}
                          checked={fallCareTimeFrame === "أخرى"}
                          onChange={() => setFallCareTimeFrame("أخرى")}
                          className={isNurseDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-teal-600"}
                        />
                        <span>أخرى:</span>
                      </label>

                      {fallCareTimeFrame === "أخرى" && (
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={fallCareTimeFrameCustom}
                          onChange={(e) => setFallCareTimeFrameCustom(e.target.value)}
                          placeholder="حدد المدة الزمنية..."
                          className={`px-2 py-0.5 border rounded text-xs w-32 ${
                            isNurseDisabled ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-200" : "bg-white"
                          }`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table 2: Doctor Care Plan (Image 1) - مسؤولية طبيب الأشعة */}
            <div className={`border rounded-xl overflow-hidden transition-all ${
              isRadiologistDisabled
                ? "border-slate-300 bg-slate-50 text-slate-800"
                : "border-emerald-200 bg-emerald-50/20"
            }`}>
              <div className={`px-3.5 py-2 font-bold flex justify-between items-center text-xs ${
                isRadiologistDisabled
                  ? "bg-slate-600 text-slate-100"
                  : "bg-emerald-800 text-white"
              }`}>
                <span>خطة الرعاية 2: المريض يحتاج للخضوع للتصوير التشخيصي (مسؤولية طبيب الأشعة)</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                    isRadiologistDisabled ? "bg-slate-700 text-slate-200" : "bg-emerald-100 text-emerald-950"
                  }`}>
                    {isRadiologistDisabled && <Lock className="w-3 h-3" />}
                    <span>{isRadiologistDisabled ? "مسؤولية طبيب الأشعة (غير متاح لدورك)" : "مسؤولية طبيب الأشعة"}</span>
                  </span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">Doctor Care Plan</span>
                </div>
              </div>

              {physicianSignature ? (
                <div className="mx-3.5 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم توثيق وتأكيد خطة الرعاية بواسطة طبيب الأشعة: {physicianSignature}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-white/70 px-2 py-0.5 rounded border border-emerald-200 font-mono">مؤكد</span>
                </div>
              ) : (
                <div className={`mx-3.5 mt-3 p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                  isRadiologistDisabled ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-amber-50 border-amber-200 text-amber-900"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${canEditRadiologist ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`}></span>
                    <span className="font-bold">
                      {canEditRadiologist
                        ? "دورك الحالي: طبيب أشعة — يرجى مراجعة وتوثيق خطة التثقيف ومخاطر الإجراء."
                        : "خطة رعاية التصوير التشخيصي مخصصة لطبيب الأشعة (قيد الانتظار لم يتم تأكيدها بعد)."}
                    </span>
                  </div>
                  {canEditRadiologist && (
                    <span className="text-[10px] bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded font-bold">
                      مطلوب منك
                    </span>
                  )}
                </div>
              )}

              <div className="p-3.5 space-y-3">
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg border ${
                  isRadiologistDisabled
                    ? "bg-slate-50 border-slate-200 text-slate-700"
                    : "bg-white border-emerald-100"
                }`}>
                  <div><strong className={isRadiologistDisabled ? "text-slate-700" : "text-emerald-950"}>المشكلة أو الاحتياج (Problem or need):</strong> المريض يحتاج للخضوع للتصوير التشخيصي</div>
                  <div><strong className={isRadiologistDisabled ? "text-slate-700" : "text-emerald-950"}>الهدف المراد الوصول إليه (Goal):</strong> حصول المريض علي الخدمة بطريقة آمنه</div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className={`block font-bold ${isRadiologistDisabled ? "text-slate-700" : "text-slate-800"}`}>
                      التدخلات أو الإجراءات (Interventions):
                    </label>
                    {canEditRadiologist && (
                      <button
                        type="button"
                        onClick={() => {
                          setDoctorCareInterventions([
                            "التأكد من تثقيف المريض علي اجراءات ما قبل الفحص",
                            "تعريف المريض بفوائد ومخاطر وبدائل الاجراء",
                          ]);
                          setDoctorCareResponsible(["أخصائي الأشعة"]);
                          setDoctorCareTimeFrame("15 دقيقة");
                        }}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>⚡ تحديد التدخلات القياسية لطبيب الأشعة</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      "التأكد من تثقيف المريض علي اجراءات ما قبل الفحص",
                      "تعريف المريض بفوائد ومخاطر وبدائل الاجراء",
                    ].map((intervention) => (
                      <label
                        key={intervention}
                        className={`flex items-start gap-2 p-2 rounded-lg border transition-colors ${
                          isRadiologistDisabled
                            ? "bg-slate-100/80 border-slate-200 cursor-not-allowed text-slate-700"
                            : "bg-white border-slate-200 cursor-pointer hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isRadiologistDisabled}
                          checked={doctorCareInterventions.includes(intervention)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDoctorCareInterventions([...doctorCareInterventions, intervention]);
                            } else {
                              setDoctorCareInterventions(doctorCareInterventions.filter((i) => i !== intervention));
                            }
                          }}
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            isRadiologistDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-emerald-600"
                          }`}
                        />
                        <span className="text-[11px] font-medium">{intervention}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className={`p-2.5 rounded-lg border space-y-1 ${
                    isRadiologistDisabled ? "bg-slate-100/80 border-slate-200 text-slate-700" : "bg-white border-slate-200"
                  }`}>
                    <span className={`block font-bold mb-1 ${isRadiologistDisabled ? "text-slate-700" : "text-slate-800"}`}>المسئول عن التنفيذ (Who is responsible):</span>
                    <label className={`flex items-center gap-1.5 text-xs ${isRadiologistDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <input
                        type="checkbox"
                        disabled={isRadiologistDisabled}
                        checked={doctorCareResponsible.includes("أخصائي الأشعة")}
                        onChange={(e) => {
                          if (e.target.checked) setDoctorCareResponsible([...doctorCareResponsible, "أخصائي الأشعة"]);
                          else setDoctorCareResponsible(doctorCareResponsible.filter((item) => item !== "أخصائي الأشعة"));
                        }}
                        className={`w-4 h-4 ${isRadiologistDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-emerald-600"}`}
                      />
                      <span className="font-medium">أخصائي الأشعة</span>
                    </label>
                  </div>

                  <div className={`p-2.5 rounded-lg border space-y-1.5 ${
                    isRadiologistDisabled ? "bg-slate-100/80 border-slate-200 text-slate-700" : "bg-white border-slate-200"
                  }`}>
                    <span className={`block font-bold ${isRadiologistDisabled ? "text-slate-700" : "text-slate-800"}`}>المدة الزمنية (Time Frame):</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className={`flex items-center gap-1.5 ${isRadiologistDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input
                          type="radio"
                          name="doctorTimeFrame"
                          disabled={isRadiologistDisabled}
                          checked={doctorCareTimeFrame === "15 دقيقة"}
                          onChange={() => setDoctorCareTimeFrame("15 دقيقة")}
                          className={isRadiologistDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-emerald-600"}
                        />
                        <span>15 دقيقة</span>
                      </label>

                      <label className={`flex items-center gap-1.5 ${isRadiologistDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input
                          type="radio"
                          name="doctorTimeFrame"
                          disabled={isRadiologistDisabled}
                          checked={doctorCareTimeFrame === "أخرى"}
                          onChange={() => setDoctorCareTimeFrame("أخرى")}
                          className={isRadiologistDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-emerald-600"}
                        />
                        <span>أخرى:</span>
                      </label>

                      {doctorCareTimeFrame === "أخرى" && (
                        <input
                          type="text"
                          disabled={isRadiologistDisabled}
                          value={doctorCareTimeFrameCustom}
                          onChange={(e) => setDoctorCareTimeFrameCustom(e.target.value)}
                          placeholder="حدد المدة الزمنية..."
                          className={`px-2 py-0.5 border rounded text-xs w-32 ${
                            isRadiologistDisabled ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-200" : "bg-white"
                          }`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table 3: Technician Care Plan (Image 2) - مسؤولية فني الأشعة */}
            <div className={`border rounded-xl overflow-hidden transition-all ${
              isTechDisabled
                ? "border-slate-300 bg-slate-50 text-slate-800"
                : "border-indigo-100 bg-indigo-50/20"
            }`}>
              <div className={`px-3.5 py-2 font-bold flex justify-between items-center text-xs ${
                isTechDisabled
                  ? "bg-slate-600 text-slate-100"
                  : "bg-indigo-700 text-white"
              }`}>
                <span>خطة الرعاية 3: إجراءات السلامة والجرعة الإشعاعية (مسؤولية فني الأشعة)</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                    isTechDisabled ? "bg-slate-700 text-slate-200" : "bg-amber-100 text-amber-950"
                  }`}>
                    {isTechDisabled && <Lock className="w-3 h-3" />}
                    <span>{isTechDisabled ? "مسؤولية فني الأشعة (غير متاح لدورك)" : "مسؤولية فني الأشعة"}</span>
                  </span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">Radiation & Safety Plan</span>
                </div>
              </div>

              {techSignature ? (
                <div className="mx-3.5 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم توثيق وتأكيد خطة رعاية الأشعة بواسطة فني الأشعة: {techSignature}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-white/70 px-2 py-0.5 rounded border border-emerald-200 font-mono">مؤكد</span>
                </div>
              ) : (
                <div className={`mx-3.5 mt-3 p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                  isTechDisabled ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-amber-50 border-amber-200 text-amber-900"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${canEditTech ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`}></span>
                    <span className="font-bold">
                      {canEditTech
                        ? "دورك الحالي: فني أشعة — يرجى تحديد التدخلات وتوثيق الخطة."
                        : "خطة رعاية فني الأشعة (قيد الانتظار لم يتم تأكيدها بعد)."}
                    </span>
                  </div>
                  {canEditTech && (
                    <span className="text-[10px] bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded font-bold">
                      مطلوب منك
                    </span>
                  )}
                </div>
              )}

              <div className="p-3.5 space-y-3">
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg border ${
                  isTechDisabled
                    ? "bg-slate-50 border-slate-200 text-slate-700"
                    : "bg-white border-indigo-100"
                }`}>
                  <div><strong className={isTechDisabled ? "text-slate-700" : "text-indigo-900"}>المشكلة أو الاحتياج (Problem or need):</strong> المريض يحتاج للخضوع للتصوير التشخيصي (السلامة والجرعة الإشعاعية)</div>
                  <div><strong className={isTechDisabled ? "text-slate-700" : "text-indigo-900"}>الهدف المراد الوصول إليه (Goal):</strong> حصول المريض علي الخدمة بطريقة آمنه</div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className={`block font-bold ${isTechDisabled ? "text-slate-700" : "text-slate-800"}`}>
                      التدخلات أو الإجراءات (Interventions):
                    </label>
                    {canEditTech && (
                      <button
                        type="button"
                        onClick={() => {
                          setTechCareInterventions([
                            "حساب جرعة الإشعاع المناسب للمريض و الإجراء",
                            "توفير الوسائل اللازمة لحماية المريض اثناء تلقي الاجراء",
                            "تأمين المريض اثناء الاجراء",
                            "الحفاظ علي خصوصية المريض أثناء تلقي الاجراء",
                            "اتباع دليل الاجراءات لفحص الأشعة",
                            "تثقيف المريض علي تعليمات ما بعد الفحص",
                          ]);
                          setTechCareResponsible(["فني الأشعة"]);
                          setTechCareTimeFrame("15 دقيقة");
                        }}
                        className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>⚡ تحديد كافة التدخلات القياسية لفني الأشعة</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      "حساب جرعة الإشعاع المناسب للمريض و الإجراء",
                      "توفير الوسائل اللازمة لحماية المريض اثناء تلقي الاجراء",
                      "تأمين المريض اثناء الاجراء",
                      "الحفاظ علي خصوصية المريض أثناء تلقي الاجراء",
                      "اتباع دليل الاجراءات لفحص الأشعة",
                      "تثقيف المريض علي تعليمات ما بعد الفحص",
                    ].map((intervention) => (
                      <label
                        key={intervention}
                        className={`flex items-start gap-2 p-2 rounded-lg border transition-colors ${
                          isTechDisabled
                            ? "bg-slate-100/80 border-slate-200 cursor-not-allowed text-slate-700"
                            : "bg-white border-slate-200 cursor-pointer hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isTechDisabled}
                          checked={techCareInterventions.includes(intervention)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTechCareInterventions([...techCareInterventions, intervention]);
                            } else {
                              setTechCareInterventions(techCareInterventions.filter((i) => i !== intervention));
                            }
                          }}
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            isTechDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-indigo-600"
                          }`}
                        />
                        <span className="text-[11px] font-medium">{intervention}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className={`p-2.5 rounded-lg border space-y-1 ${
                    isTechDisabled ? "bg-slate-100/80 border-slate-200 text-slate-700" : "bg-white border-slate-200"
                  }`}>
                    <span className={`block font-bold mb-1 ${isTechDisabled ? "text-slate-700" : "text-slate-800"}`}>المسئول عن التنفيذ (Who is responsible):</span>
                    <label className={`flex items-center gap-1.5 text-xs ${isTechDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <input
                        type="checkbox"
                        disabled={isTechDisabled}
                        checked={techCareResponsible.includes("فني الأشعة")}
                        onChange={(e) => {
                          if (e.target.checked) setTechCareResponsible([...techCareResponsible, "فني الأشعة"]);
                          else setTechCareResponsible(techCareResponsible.filter((item) => item !== "فني الأشعة"));
                        }}
                        className={`w-4 h-4 ${isTechDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-indigo-600"}`}
                      />
                      <span className="font-medium">فني الأشعة</span>
                    </label>
                  </div>

                  <div className={`p-2.5 rounded-lg border space-y-1.5 ${
                    isTechDisabled ? "bg-slate-100/80 border-slate-200 text-slate-700" : "bg-white border-slate-200"
                  }`}>
                    <span className={`block font-bold ${isTechDisabled ? "text-slate-700" : "text-slate-800"}`}>المدة الزمنية (Time Frame):</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className={`flex items-center gap-1.5 ${isTechDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input
                          type="radio"
                          name="techTimeFrame"
                          disabled={isTechDisabled}
                          checked={techCareTimeFrame === "15 دقيقة"}
                          onChange={() => setTechCareTimeFrame("15 دقيقة")}
                          className={isTechDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-indigo-600"}
                        />
                        <span>15 دقيقة</span>
                      </label>

                      <label className={`flex items-center gap-1.5 ${isTechDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input
                          type="radio"
                          name="techTimeFrame"
                          disabled={isTechDisabled}
                          checked={techCareTimeFrame === "أخرى"}
                          onChange={() => setTechCareTimeFrame("أخرى")}
                          className={isTechDisabled ? "accent-slate-500 cursor-not-allowed" : "accent-indigo-600"}
                        />
                        <span>أخرى:</span>
                      </label>

                      {techCareTimeFrame === "أخرى" && (
                        <input
                          type="text"
                          disabled={isTechDisabled}
                          value={techCareTimeFrameCustom}
                          onChange={(e) => setTechCareTimeFrameCustom(e.target.value)}
                          placeholder="حدد المدة الزمنية..."
                          className={`px-2 py-0.5 border rounded text-xs w-32 ${
                            isTechDisabled ? "bg-slate-100 text-slate-700 cursor-not-allowed border-slate-200" : "bg-white"
                          }`}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Technician Confirmation Block */}
                <div className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">تأكيد وتوثيق فني الأشعة:</span>
                    <span className="font-bold text-indigo-950 bg-white px-3 py-1 rounded-lg border border-indigo-200">
                      {techSignature || (role === "technician" ? profile?.full_name || "جاري التوثيق..." : "في انتظار توثيق فني الأشعة")}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {techSignature ? "تم التوثيق إلكترونياً بنجاح" : "يتم الاعتماد تلقائياً عند حفظ فني الأشعة"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 9: Cannula & Connections & Medications */}
        <div className={`p-5 sm:p-6 rounded-2xl border shadow-xs space-y-4 transition-all ${
          isNurseDisabled
            ? "bg-slate-50/90 border-slate-200 text-slate-800"
            : "bg-white border-slate-200/80"
        }`}>
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className={`text-xs sm:text-sm font-bold flex items-center gap-2 ${
              isNurseDisabled ? "text-slate-500" : "text-slate-800"
            }`}>
              <span>9. الوصلات الوريدية والأدوية المنصرفة (Connections & Medications)</span>
            </h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
              isNurseDisabled
                ? "bg-slate-200 text-slate-600 border-slate-300"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {isNurseDisabled && <Lock className="w-3 h-3" />}
              <span>{isNurseDisabled ? "غير متاح لدورك (خاص بالتمريض)" : "خاص بالتمريض"}</span>
            </span>
            {!isNurseDisabled && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddConnection}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة وصلة/كانيولا</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة دواء</span>
                </button>
              </div>
            )}
          </div>

          {/* Connections Table */}
          {connections.length > 0 && (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="p-2.5">الوصلة</th>
                    <th className="p-2.5">المقاس</th>
                    <th className="p-2.5">المكان</th>
                    <th className="p-2.5">وقت وتاريخ التركيب</th>
                    <th className="p-2.5">القائم بالتركيب</th>
                    <th className="p-2.5">وقت وتاريخ إزالة الوصلة</th>
                    {!isNurseDisabled && <th className="p-2.5 text-center">حذف</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {connections.map((c, idx) => (
                    <tr key={c.id}>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={c.name}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].name = e.target.value;
                            setConnections(arr);
                          }}
                          placeholder="اسم الوصلة..."
                          className={`w-full px-2 py-1 border rounded text-xs ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={c.size}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].size = e.target.value;
                            setConnections(arr);
                          }}
                          placeholder="المقاس..."
                          className={`w-20 px-2 py-1 border rounded text-xs ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={c.site}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].site = e.target.value;
                            setConnections(arr);
                          }}
                          placeholder="المكان..."
                          className={`w-full px-2 py-1 border rounded text-xs ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={c.inserted_at}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].inserted_at = e.target.value;
                            setConnections(arr);
                          }}
                          className={`w-24 px-2 py-1 border rounded text-xs font-mono ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={c.inserted_by}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].inserted_by = e.target.value;
                            setConnections(arr);
                          }}
                          className={`w-24 px-2 py-1 border rounded text-xs ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={c.removed_at}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].removed_at = e.target.value;
                            setConnections(arr);
                          }}
                          placeholder="تاريخ ووقت الإزالة..."
                          className={`w-28 px-2 py-1 border rounded text-xs font-mono ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      {!isNurseDisabled && (
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => setConnections(connections.filter((item) => item.id !== c.id))}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Medications Table */}
          {medications.length > 0 && (
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-emerald-50 text-emerald-950 font-bold">
                  <tr>
                    <th className="p-2.5">الوقت</th>
                    <th className="p-2.5">اسم الدواء</th>
                    <th className="p-2.5">الجرعة</th>
                    <th className="p-2.5">طريقة الإعطاء</th>
                    <th className="p-2.5">معدل الإعطاء</th>
                    <th className="p-2.5">توقيع الطبيب</th>
                    <th className="p-2.5">القائم بالإعطاء</th>
                    {!isNurseDisabled && <th className="p-2.5 text-center">حذف</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medications.map((m, idx) => (
                    <tr key={m.id}>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={m.time}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].time = e.target.value;
                            setMedications(arr);
                          }}
                          className={`w-16 px-2 py-1 border rounded text-xs font-mono ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={m.name}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].name = e.target.value;
                            setMedications(arr);
                          }}
                          placeholder="اسم الدواء..."
                          className={`w-full px-2 py-1 border rounded text-xs ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={m.dose}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].dose = e.target.value;
                            setMedications(arr);
                          }}
                          placeholder="الجرعة..."
                          className={`w-20 px-2 py-1 border rounded text-xs ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={m.route}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].route = e.target.value;
                            setMedications(arr);
                          }}
                          className={`w-16 px-2 py-1 border rounded text-xs ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={m.frequency}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].frequency = e.target.value;
                            setMedications(arr);
                          }}
                          placeholder="معدل الإعطاء..."
                          className={`w-24 px-2 py-1 border rounded text-xs ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={m.ordering_doctor}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].ordering_doctor = e.target.value;
                            setMedications(arr);
                          }}
                          className={`w-24 px-2 py-1 border rounded text-xs ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isNurseDisabled}
                          value={m.administered_by}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].administered_by = e.target.value;
                            setMedications(arr);
                          }}
                          className={`w-24 px-2 py-1 border rounded text-xs ${
                            isNurseDisabled ? "bg-slate-100 text-slate-600 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </td>
                      {!isNurseDisabled && (
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => setMedications(medications.filter((item) => item.id !== m.id))}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 10: Signatures & Electronic Verification */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-600" />
              <span>10. التوثيق والاعتماد الإلكتروني الرسمي</span>
            </h3>
            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full font-bold">
              توثيق آلي باسم المستخدم
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Nurse Signature Display */}
            <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>توثيق واعتماد التمريض</span>
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                  التمريض
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-blue-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 font-mono">
                    {nurseSignature || (canEditNurse && !editId ? profile?.full_name || "جاري التوثيق..." : nurseSignature || (canEditNurse ? profile?.full_name || "جاري التوثيق..." : "في انتظار توثيق التمريض"))}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {nurseSignature || (canEditNurse && profile?.full_name) ? "تم التوثيق إلكترونياً بنجاح" : "لم يتم التوثيق بعد"}
                  </div>
                </div>
                {(nurseSignature || (canEditNurse && profile?.full_name)) && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>معتمد</span>
                  </span>
                )}
              </div>
            </div>

            {/* Technician Signature Display */}
            <div className="p-3.5 rounded-xl border border-teal-100 bg-teal-50/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>توثيق واعتماد فني الأشعة</span>
                </span>
                <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold">
                  فني الأشعة
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-teal-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 font-mono">
                    {techSignature || (role === "technician" ? profile?.full_name || "جاري التوثيق..." : "في انتظار توثيق الفني")}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {techSignature || (role === "technician" && profile?.full_name) ? "تم التوثيق إلكترونياً بنجاح" : "لم يتم التوثيق بعد"}
                  </div>
                </div>
                {(techSignature || (role === "technician" && profile?.full_name)) && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>معتمد</span>
                  </span>
                )}
              </div>
            </div>

            {/* Radiologist Signature Display */}
            <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>توثيق واعتماد طبيب الأشعة</span>
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  أخصائي الأشعة
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 font-mono">
                    {physicianSignature || (canEditRadiologist ? profile?.full_name || "جاري التوثيق..." : "في انتظار توثيق الطبيب")}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {physicianSignature || (canEditRadiologist && profile?.full_name) ? "تم التوثيق إلكترونياً بنجاح" : "لم يتم التوثيق بعد"}
                  </div>
                </div>
                {(physicianSignature || (canEditRadiologist && profile?.full_name)) && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>معتمد</span>
                  </span>
                )}
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
            defaultText={
              role === "technician"
                ? "حفظ وتوثيق خطة رعاية الأشعة"
                : role === "radiologist"
                ? "حفظ وتوثيق نتائج التحاليل والتوقيع"
                : role === "nurse"
                ? "حفظ وتوثيق تقييم التمريض الشامل"
                : "حفظ وتوثيق تقييم المريض الشامل"
            }
            editText={
              role === "technician"
                ? "حفظ تعديلات خطة رعاية الأشعة"
                : role === "radiologist"
                ? "حفظ تعديلات التحاليل والتوقيع"
                : "حفظ وتوثيق التعديلات"
            }
            isEdit={!!editId}
            shakeTrigger={shakeTrigger}
          />
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-emerald-950">
                تم حفظ التقييم الشامل بنجاح! ({lastSavedRecord?.patientName || patientName})
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

      {/* PRINT VIEW SHEET (100% EXACT REPLICA OF نموذج تقييم المريض .pdf) */}
      <div className="hidden print:block bg-white text-black font-sans text-xs space-y-6">
        {/* ================= PAGE 1 ================= */}
        <div className="p-4 border-2 border-black space-y-2 min-h-[1050px] relative">
          <div className="flex justify-between items-center pb-2 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <img src="/tiba-scan.jpg" alt="Tiba Scan" className="h-10 w-auto object-contain" />
              <div>
                <h2 className="text-sm font-bold">Tiba Scan Radiology Center</h2>
                <h3 className="text-xs font-bold">مركز طيبة سكان للأشعة</h3>
              </div>
            </div>
            <div className="border border-black px-2 py-0.5 font-bold text-xs font-mono">
              TRC-ICD 1
            </div>
          </div>

          <div className="text-center py-1 bg-slate-100 border border-black font-bold text-sm">
            نموذج تقييم المريض Patient Assessment Form
          </div>

          {/* Header Info */}
          <div className="border border-black p-2 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <div>تاريخ الزيارة: <span className="font-bold underline">{visitDate || "/ /"}</span></div>
              <div>وقت الزيارة: <span className="font-bold underline">{visitTime || "-"}</span></div>
              <div>اسم المريض: <span className="font-bold underline text-sm">{patientName || "..................................................."}</span></div>
              <div>رقم الملف (MRN): <span className="font-bold font-mono underline">{mrn || "................"}</span></div>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-300">
              <div>اسم الطبيب المعالج: <span className="font-bold underline">{attendingPhysician || "...................."}</span></div>
              <div>هاتف الطبيب المعالج: <span className="font-bold underline font-mono">{physicianPhone || "...................."}</span></div>
              <div>الوزن Weight: <span className="font-bold underline">{weightKg ? `${weightKg} kg` : "....."}</span></div>
              <div>الطول Height: <span className="font-bold underline">{heightCm ? `${heightCm} cm` : "....."}</span></div>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-300">
              <div className="flex gap-4">
                <span>الجنس:</span>
                <span>ذكر {gender === "ذكر" ? "☒" : "☐"}</span>
                <span>أنثى {gender === "انثي" ? "☒" : "☐"}</span>
              </div>
              <div>السن: <span className="font-bold underline">{age || "....."}</span> سنة</div>
            </div>
          </div>

          {/* Vital Signs Table */}
          <div>
            <div className="font-bold text-xs mb-1">العلامات الحيوية Vital Signs:</div>
            <table className="w-full text-center border-collapse border border-black text-[11px]">
              <thead className="bg-slate-100 font-bold">
                <tr>
                  <th className="border border-black p-1.5">ضغط الدم<br/><span className="font-normal font-mono text-[10px]">Blood pressure</span></th>
                  <th className="border border-black p-1.5">درجة الحرارة<br/><span className="font-normal font-mono text-[10px]">Temperature</span></th>
                  <th className="border border-black p-1.5">النبض<br/><span className="font-normal font-mono text-[10px]">HR</span></th>
                  <th className="border border-black p-1.5">معدل التنفس<br/><span className="font-normal font-mono text-[10px]">RR</span></th>
                  <th className="border border-black p-1.5">نسبة تشبع الأكسجين<br/><span className="font-normal font-mono text-[10px]">SaO2</span></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-bold font-mono">{bloodPressure || "-"}</td>
                  <td className="border border-black p-2 font-bold font-mono">{temperature ? `${temperature} °C` : "-"}</td>
                  <td className="border border-black p-2 font-bold font-mono">{heartRate ? `${heartRate} bpm` : "-"}</td>
                  <td className="border border-black p-2 font-bold font-mono">{respiratoryRate ? `${respiratoryRate}/min` : "-"}</td>
                  <td className="border border-black p-2 font-bold font-mono">{oxygenSaturation ? `${oxygenSaturation} %` : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Diagnosis & Procedure */}
          <div className="border border-black p-2 space-y-1.5 text-[11px]">
            <div><strong>التشخيص Diagnosis:</strong> <span className="font-semibold underline">{diagnosis || "..................................................."}</span></div>
            <div><strong>الإجراء Procedure:</strong> <span className="font-semibold underline">{procedureName || "..................................................."}</span></div>
            <div><strong>التاريخ المرضي والجراحي Past medical and surgical history:</strong> <span className="font-semibold underline">{pastHistory || "..................................................."}</span></div>
          </div>

          {/* Allergy & Smoking & Mobility */}
          <div className="border border-black p-2 space-y-2 text-[11px]">
            <div className="flex items-center gap-3 flex-wrap">
              <strong>الحساسية Allergy:</strong>
              <span>{allergyTypes.length === 0 ? "☒ لا يوجد" : "☐ لا يوجد"}</span>
              <span>{allergyTypes.includes("حساسية غذاء") ? "☒" : "☐"} حساسية غذاء</span>
              <span>{allergyTypes.includes("صبغة") ? "☒" : "☐"} صبغة</span>
              <span>{allergyTypes.includes("أدوية") ? "☒" : "☐"} أدوية</span>
              <span>{allergyTypes.includes("أخرى") ? "☒" : "☐"} أخرى</span>
              {allergyDetails && <span>أذكرها: <span className="underline font-bold">{allergyDetails}</span></span>}
            </div>

            <div className="flex items-center gap-6 pt-1 border-t border-slate-200">
              <strong>التدخين:</strong>
              <span>{isSmoker === false ? "☒" : "☐"} لا</span>
              <span>{isSmoker === true ? "☒" : "☐"} نعم</span>
            </div>

            <div className="flex items-center gap-4 flex-wrap pt-1 border-t border-slate-200">
              <strong>حركة المريض Mobility:</strong>
              <span>{mobilityStatus === "طبيعية" ? "☒" : "☐"} طبيعية</span>
              <span>{mobilityStatus === "عدم اتزان في الحركة" ? "☒" : "☐"} عدم اتزان في الحركة</span>
              <span>{mobilityStatus === "يستخدم وسائل مساعدة في الحركة" ? "☒" : "☐"} يستخدم وسائل مساعدة في الحركة</span>
              <span>{mobilityStatus === "ملازم الفراش" ? "☒" : "☐"} ملازم الفراش</span>
            </div>
          </div>

          {/* Women Assessment */}
          <div className="border border-black p-2 space-y-1 text-[11px]">
            <div className="font-bold underline">بالنسبة للسيدات:</div>
            <div className="flex justify-between flex-wrap gap-2">
              <div>تاريخ آخر دورة شهرية: <span className="underline font-bold">{lmpDate || "/ /"}</span></div>
              <div>{menopause ? "☒" : "☐"} في مرحلة انقطاع الطمث</div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
              <div>هل هناك تأخر في موعد الدورة الشهرية؟ {delayedPeriod === false ? "☒ لا" : "☐ لا"} {delayedPeriod === true ? "☒ نعم" : "☐ نعم"}</div>
              <div>هل تأخذين وسائل لمنع الحمل؟ {contraceptiveUse === false ? "☒ لا" : "☐ لا"} {contraceptiveUse === true ? "☒ نعم" : "☐ نعم"}</div>
              <div>هل تخططين للحمل؟ {planningPregnancy === false ? "☒ لا" : "☐ لا"} {planningPregnancy === true ? "☒ نعم" : "☐ نعم"}</div>
              <div>{pregnantOrSuspected ? "☒" : "☐"} حامل أو يشتبه في الحمل | {lactating ? "☒" : "☐"} في مرحلة الرضاعة</div>
            </div>
          </div>

          {/* Medical Conditions Survey Part 1 */}
          <div className="border border-black p-2 space-y-1 text-[11px]">
            <div className="font-bold underline">مسح الأمراض التي يعاني منها المريض:</div>
            <div className="flex justify-between items-center">
              <span>هل تعاني من أي أمراض خاصة بالكلى؟</span>
              <span>{!kidneyDisease ? "☒ لا" : "☐ لا"} {kidneyDisease ? "☒ نعم" : "☐ نعم"} {kidneyDetails && `(أذكرها: ${kidneyDetails})`}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
              <span>هل تعاني من أي أمراض خاصة بالقلب؟</span>
              <span>{!heartDisease ? "☒ لا" : "☐ لا"} {heartDisease ? "☒ نعم" : "☐ نعم"} {heartDetails && `(أذكرها: ${heartDetails})`}</span>
            </div>
          </div>

          <div className="absolute bottom-2 right-4 text-[10px] font-mono">TRC-ICD</div>
          <div className="absolute bottom-2 left-4 text-[10px] font-mono">1</div>
        </div>

        {/* ================= PAGE 2 ================= */}
        <div className="p-4 border-2 border-black space-y-2 min-h-[1050px] relative">
          <div className="flex justify-between items-center pb-2 border-b-2 border-black">
            <div>
              <h2 className="text-sm font-bold">Tiba Scan Radiology Center</h2>
              <h3 className="text-xs font-bold">مركز طيبة سكان للأشعة</h3>
            </div>
            <div className="border border-black px-2 py-0.5 font-bold text-xs font-mono">
              TRC-ICD 2
            </div>
          </div>

          {/* Medical Conditions Survey Part 2 */}
          <div className="border border-black p-2 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center">
              <span>هل تتناول أي أدوية مضادة للتجلط؟</span>
              <span>{!anticoagulants ? "☒ لا" : "☐ لا"} {anticoagulants ? "☒ نعم" : "☐ نعم"} {anticoagulantDetails && `(أذكرها: ${anticoagulantDetails})`}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
              <span>هل أجريت إجراء جراحي لتركيب جهاز تنظيم ضربات القلب Pacemaker؟</span>
              <span>{!pacemaker ? "☒ لا" : "☐ لا"} {pacemaker ? "☒ نعم" : "☐ نعم"}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
              <span>هل أجريت إجراء جراحي لتركيب مشبك تمدد الأوعية الدموية الدماغي Aneurysm Clip؟</span>
              <span>{!aneurysmClip ? "☒ لا" : "☐ لا"} {aneurysmClip ? "☒ نعم" : "☐ نعم"}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
              <span>هل المريض من المرضى منقوصي المناعة (مريض سرطان - سكر - كورتيزون - روماتويد - علاج كيماوي)؟</span>
              <span>{!immunocompromised ? "☒ لا" : "☐ لا"} {immunocompromised ? "☒ نعم" : "☐ نعم"}</span>
            </div>
          </div>

          {/* Psychological Status */}
          <div className="border border-black p-2 space-y-1 text-[11px]">
            <div className="font-bold underline">الحالة النفسية للمريض Psychological Status:</div>
            <div className="flex items-center gap-6 pt-1">
              <span>{psychologicalStatus === "طبيعية" ? "☒" : "☐"} طبيعية</span>
              <span>{psychologicalStatus === "مكتئب" ? "☒" : "☐"} مكتئب</span>
              <span>{psychologicalStatus === "قلق" ? "☒" : "☐"} قلق</span>
              <span>{psychologicalStatus === "غير متعاون" ? "☒" : "☐"} غير متعاون</span>
            </div>
          </div>

          {/* Mental Status */}
          <div className="border border-black p-2 space-y-1 text-[11px]">
            <div className="font-bold underline">الحالة العقلية للمريض Mental Status:</div>
            <div className="flex items-center gap-4 flex-wrap pt-1">
              <span>{mentalStatus === "طبيعي" ? "☒" : "☐"} طبيعي</span>
              <span>{mentalStatus.includes("طريقة التحدث") ? "☒" : "☐"} ملاحظة وجود مشكلة في طريقة التحدث</span>
              <span>{mentalStatus.includes("المكان") ? "☒" : "☐"} عدم الانتباه للمكان أو الزمان</span>
              <span>{mentalStatus.startsWith("أخرى") ? "☒" : "☐"} أخرى</span>
              {mentalDetails && <span>أذكرها: <span className="underline font-bold">{mentalDetails}</span></span>}
            </div>
          </div>

          {/* Abuse or Neglect Signs */}
          <div className="border border-black p-2 space-y-1 text-[11px]">
            <div className="flex items-center gap-4">
              <strong>هل يظهر على المريض أي علامات إيذاء أو إهمال؟</strong>
              <span>{!abuseSigns ? "☒ لا" : "☐ لا"}</span>
              <span>{abuseSigns ? "☒ نعم" : "☐ نعم"}</span>
              {abuseSigns && abuseDetails && <span>أذكرها: <span className="underline font-bold">{abuseDetails}</span></span>}
            </div>
          </div>

          {/* Lab Results Table */}
          <div>
            <div className="font-bold text-xs mb-1">نتائج المعمل Lab Results:</div>
            <table className="w-full text-center border-collapse border border-black text-[11px]">
              <thead className="bg-slate-100 font-bold">
                <tr>
                  <th className="border border-black p-1.5">GFR</th>
                  <th className="border border-black p-1.5">BUN</th>
                  <th className="border border-black p-1.5">Potassium</th>
                  <th className="border border-black p-1.5">Sodium</th>
                  <th className="border border-black p-1.5">Urea</th>
                  <th className="border border-black p-1.5">Creatinine</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-bold font-mono">{labGfr || "-"}</td>
                  <td className="border border-black p-2 font-bold font-mono">{labBun || "-"}</td>
                  <td className="border border-black p-2 font-bold font-mono">{labPotassium || "-"}</td>
                  <td className="border border-black p-2 font-bold font-mono">{labSodium || "-"}</td>
                  <td className="border border-black p-2 font-bold font-mono">{labUrea || "-"}</td>
                  <td className="border border-black p-2 font-bold font-mono">{labCreatinine || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Plan of Care Part 1 (Page 2) */}
          <div>
            <div className="font-bold text-xs mb-1">خطة الرعاية Pain of care:</div>
            <table className="w-full text-right border-collapse border border-black text-[10px]">
              <thead className="bg-slate-100 font-bold text-center">
                <tr>
                  <th className="border border-black p-1.5 w-[20%]">المشكلة أو الاحتياج<br/><span className="font-normal font-mono text-[9px]">Problem or need</span></th>
                  <th className="border border-black p-1.5 w-[20%]">الهدف المراد الوصول إليه<br/><span className="font-normal font-mono text-[9px]">Goal</span></th>
                  <th className="border border-black p-1.5 w-[36%]">التدخلات أو الاجراءات<br/><span className="font-normal font-mono text-[9px]">Interventions</span></th>
                  <th className="border border-black p-1.5 w-[12%]">المسئول عن التنفيذ<br/><span className="font-normal font-mono text-[9px]">Who is responsible</span></th>
                  <th className="border border-black p-1.5 w-[12%]">المدة الزمنية<br/><span className="font-normal font-mono text-[9px]">Time Frame</span></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-bold align-top">
                    المريض معرض لخطر السقوط
                  </td>
                  <td className="border border-black p-2 align-top">
                    تأمين المريض وحمايته من خطر السقوط
                  </td>
                  <td className="border border-black p-2 align-top space-y-1">
                    <div>{fallCareInterventions.includes("تمييز المريض بوضع سلسلة عليها حرف F") ? "☒" : "☐"} تمييز المريض بوضع سلسلة عليها حرف F</div>
                    <div>{fallCareInterventions.includes("رفع جوانب الترولي أو إمداد المريض بأجهزة المساعدة علي المشي مثل الكرسي المتحرك.") ? "☒" : "☐"} رفع جوانب الترولي أو إمداد المريض بأجهزة المساعدة علي المشي مثل الكرسي المتحرك.</div>
                    <div>{fallCareInterventions.includes("التأكد من احتياطات سلامة البيئة (جفاف الأرض،عدم وجود عوائق)") ? "☒" : "☐"} التأكد من احتياطات سلامة البيئة (جفاف الأرض، عدم وجود عوائق)</div>
                    <div>{fallCareInterventions.includes("تثقيف المريض و / أو ذويه حول الاجراءات المانعة للسقوط") ? "☒" : "☐"} تثقيف المريض و / أو ذويه حول الاجراءات المانعة للسقوط</div>
                  </td>
                  <td className="border border-black p-2 align-top text-center">
                    <div>{fallCareResponsible.includes("الممرضة") ? "☒" : "☐"} الممرضة</div>
                  </td>
                  <td className="border border-black p-2 align-top text-center">
                    <div>{fallCareTimeFrame === "30 دقيقة" ? "☒" : "☐"} 30 دقيقة</div>
                    <div>{fallCareTimeFrame === "أخرى" ? `☒ أخرى: ${fallCareTimeFrameCustom}` : "☐ أخرى"}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="absolute bottom-2 right-4 text-[10px] font-mono">TRC-ICD</div>
          <div className="absolute bottom-2 left-4 text-[10px] font-mono">2</div>
        </div>

        {/* ================= PAGE 3 ================= */}
        <div className="p-4 border-2 border-black space-y-3 min-h-[1050px] relative">
          <div className="flex justify-between items-center pb-2 border-b-2 border-black">
            <div>
              <h2 className="text-sm font-bold">Tiba Scan Radiology Center</h2>
              <h3 className="text-xs font-bold">مركز طيبة سكان للأشعة</h3>
            </div>
            <div className="border border-black px-2 py-0.5 font-bold text-xs font-mono">
              TRC-ICD 3
            </div>
          </div>

          {/* Plan of Care Part 2 (Page 3) */}
          <table className="w-full text-right border-collapse border border-black text-[10px]">
            <thead className="bg-slate-100 font-bold text-center">
              <tr>
                <th className="border border-black p-1.5 w-[20%]">المشكلة أو الاحتياج</th>
                <th className="border border-black p-1.5 w-[20%]">الهدف المراد الوصول إليه</th>
                <th className="border border-black p-1.5 w-[36%]">التدخلات أو الاجراءات</th>
                <th className="border border-black p-1.5 w-[12%]">المسئول عن التنفيذ</th>
                <th className="border border-black p-1.5 w-[12%]">المدة الزمنية</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Doctor Care Plan (Image 1) */}
              <tr>
                <td className="border border-black p-2 font-bold align-top">
                  المريض يحتاج للخضوع للتصوير التشخيصي
                </td>
                <td className="border border-black p-2 align-top">
                  حصول المريض علي الخدمة بطريقة آمنه
                </td>
                <td className="border border-black p-2 align-top space-y-1">
                  <div>{doctorCareInterventions.includes("التأكد من تثقيف المريض علي اجراءات ما قبل الفحص") ? "☒" : "☐"} التأكد من تثقيف المريض علي اجراءات ما قبل الفحص</div>
                  <div>{doctorCareInterventions.includes("تعريف المريض بفوائد ومخاطر وبدائل الاجراء") ? "☒" : "☐"} تعريف المريض بفوائد ومخاطر وبدائل الاجراء</div>
                </td>
                <td className="border border-black p-2 align-top text-center">
                  <div>{doctorCareResponsible.includes("أخصائي الأشعة") ? "☒" : "☐"} أخصائي الأشعة</div>
                </td>
                <td className="border border-black p-2 align-top text-center">
                  <div>{doctorCareTimeFrame === "15 دقيقة" ? "☒" : "☐"} 15 دقيقة</div>
                  <div>{doctorCareTimeFrame === "أخرى" ? `☒ أخرى: ${doctorCareTimeFrameCustom}` : "☐ أخرى"}</div>
                </td>
              </tr>
              {/* Row 2: Technician Care Plan (Image 2) */}
              <tr>
                <td className="border border-black p-2 font-bold align-top">
                  (السلامة والجرعة الإشعاعية)
                </td>
                <td className="border border-black p-2 align-top">
                  حصول المريض علي الخدمة بطريقة آمنه
                </td>
                <td className="border border-black p-2 align-top space-y-1">
                  <div>{techCareInterventions.includes("حساب جرعة الإشعاع المناسب للمريض و الإجراء") ? "☒" : "☐"} حساب جرعة الإشعاع المناسب للمريض و الإجراء</div>
                  <div>{techCareInterventions.includes("توفير الوسائل اللازمة لحماية المريض اثناء تلقي الاجراء") ? "☒" : "☐"} توفير الوسائل اللازمة لحماية المريض اثناء تلقي الاجراء</div>
                  <div>{techCareInterventions.includes("تأمين المريض اثناء الاجراء") ? "☒" : "☐"} تأمين المريض اثناء الاجراء</div>
                  <div>{techCareInterventions.includes("الحفاظ علي خصوصية المريض أثناء تلقي الاجراء") ? "☒" : "☐"} الحفاظ علي خصوصية المريض أثناء تلقي الاجراء</div>
                  <div>{techCareInterventions.includes("اتباع دليل الاجراءات لفحص الأشعة") ? "☒" : "☐"} اتباع دليل الاجراءات لفحص الأشعة</div>
                  <div>{techCareInterventions.includes("تثقيف المريض علي تعليمات ما بعد الفحص") ? "☒" : "☐"} تثقيف المريض علي تعليمات ما بعد الفحص</div>
                </td>
                <td className="border border-black p-2 align-top text-center">
                  <div>{techCareResponsible.includes("فني الأشعة") ? "☒" : "☐"} فني الأشعة</div>
                </td>
                <td className="border border-black p-2 align-top text-center">
                  <div>{techCareTimeFrame === "15 دقيقة" ? "☒" : "☐"} 15 دقيقة</div>
                  <div>{techCareTimeFrame === "أخرى" ? `☒ أخرى: ${techCareTimeFrameCustom}` : "☐ أخرى"}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Connections Table */}
          <div>
            <div className="font-bold text-xs mb-1">الوصلات التي تم تركيبها للمريض connection :</div>
            <table className="w-full text-center border-collapse border border-black text-[10px]">
              <thead className="bg-slate-100 font-bold">
                <tr>
                  <th className="border border-black p-1.5">الوصلة connection</th>
                  <th className="border border-black p-1.5">المقاس Size</th>
                  <th className="border border-black p-1.5">المكان Site</th>
                  <th className="border border-black p-1.5">وقت وتاريخ التركيب</th>
                  <th className="border border-black p-1.5">القائم بالتركيب Inserted by</th>
                  <th className="border border-black p-1.5">وقت وتاريخ إزالة الوصلة</th>
                </tr>
              </thead>
              <tbody>
                {connections.length > 0 ? (
                  connections.map((c, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1.5 font-bold">{c.name || "-"}</td>
                      <td className="border border-black p-1.5">{c.size || "-"}</td>
                      <td className="border border-black p-1.5">{c.site || "-"}</td>
                      <td className="border border-black p-1.5 font-mono">{c.inserted_at || "-"}</td>
                      <td className="border border-black p-1.5">{c.inserted_by || "-"}</td>
                      <td className="border border-black p-1.5 font-mono">{c.removed_at || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="border border-black p-2 text-slate-400" colSpan={6}>لا توجد وصلات مسجلة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Medications Table */}
          <div>
            <div className="font-bold text-xs mb-1">الأدوية Medications:</div>
            <table className="w-full text-center border-collapse border border-black text-[10px]">
              <thead className="bg-slate-100 font-bold">
                <tr>
                  <th className="border border-black p-1.5">الوقت</th>
                  <th className="border border-black p-1.5">اسم الدواء Medication name</th>
                  <th className="border border-black p-1.5">الجرعة Dose</th>
                  <th className="border border-black p-1.5">طريقة الاعطاء Route</th>
                  <th className="border border-black p-1.5">معدل الإعطاء Frequency</th>
                  <th className="border border-black p-1.5">توقيع الطبيب مصدر الأمر Ordering physician</th>
                  <th className="border border-black p-1.5">توقيع القائم بالإعطاء Administrated by</th>
                </tr>
              </thead>
              <tbody>
                {medications.length > 0 ? (
                  medications.map((m, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1.5 font-mono">{m.time || "-"}</td>
                      <td className="border border-black p-1.5 font-bold">{m.name || "-"}</td>
                      <td className="border border-black p-1.5">{m.dose || "-"}</td>
                      <td className="border border-black p-1.5">{m.route || "-"}</td>
                      <td className="border border-black p-1.5">{m.frequency || "-"}</td>
                      <td className="border border-black p-1.5">{m.ordering_doctor || "-"}</td>
                      <td className="border border-black p-1.5">{m.administered_by || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="border border-black p-2 text-slate-400" colSpan={7}>لا توجد أدوية مسجلة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="border border-black p-2 pt-3 text-[11px] font-bold mt-4">
            <div className="flex justify-between items-center pb-2 border-b border-black">
              <div>توقيع التمريض: <span className="font-normal underline mr-2">{nurseSignature || "......................................."}</span></div>
              <div>التاريخ: <span className="font-normal mr-1">{visitDate}</span></div>
              <div>الوقت: <span className="font-normal mr-1">{visitTime}</span></div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <div>توقيع الطبيب: <span className="font-normal underline mr-2">{physicianSignature || "......................................."}</span></div>
              <div>التاريخ: <span className="font-normal mr-1">{visitDate}</span></div>
              <div>الوقت: <span className="font-normal mr-1">{visitTime}</span></div>
            </div>
          </div>

          <div className="absolute bottom-2 right-4 text-[10px] font-mono">TRC-ICD</div>
          <div className="absolute bottom-2 left-4 text-[10px] font-mono">3</div>
        </div>
      </div>
    </div>
  );
}

export default function PatientAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">جاري التحميل...</div>}>
      <FormRoleGuard
        allowedRoles={["nurse", "technician", "radiologist"]}
        formTitle="نموذج تقييم المريض الشامل — TRC-ICD"
      >
        <PatientAssessmentContent />
      </FormRoleGuard>
    </Suspense>
  );
}
