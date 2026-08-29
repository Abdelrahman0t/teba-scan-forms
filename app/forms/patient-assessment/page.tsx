"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ClipboardCheck,
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
  HeartPulse,
  Activity,
  Plus,
  Trash2,
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
  const [psychologicalStatus, setPsychologicalStatus] = useState("");
  const [mentalStatus, setMentalStatus] = useState("");
  const [mentalDetails, setMentalDetails] = useState("");
  const [abuseSigns, setAbuseSigns] = useState(false);
  const [abuseDetails, setAbuseDetails] = useState("");

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
        setMentalStatus(data.mental_status || "طبيعي");
        setMentalDetails(data.mental_status_details || "");
        setAbuseSigns(data.abuse_neglect_signs || false);
        setAbuseDetails(data.abuse_neglect_details || "");
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
          const [fallScreenRes, fallAdultRes, fallPedRes, radRes] = await Promise.all([
            supabase.from("fall_risk_screenings").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_adult_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_pediatric_assessments").select("age, gender").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
            supabase.from("radiation_exposure_logs").select("age").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(1),
          ]);

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
      }
    } catch (err) {
      console.error("searchPatientByMrn error:", err);
    }
  }

  function handleAllergyToggle(val: string) {
    if (isLocked) return;
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
    if (isLocked) return;
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
    if (isLocked) return;
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
    if (!gender) errors.gender = "يرجى تحديد الجنس";
    if (age === "" || Number(age) < 0) errors.age = "السن مطلوب";
    if (!procedureName.trim()) errors.procedureName = "اسم الإجراء مطلوب";
    if (!nurseSignature.trim()) errors.nurseSignature = "توقيع التمريض مطلوب";

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
        connections,
        medications,
        nurse_signature: nurseSignature,
        physician_signature: physicianSignature,
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
            psychological_status: psychologicalStatus,
            mental_status: mentalStatus,
            abuse_neglect_signs: abuseSigns,
            abuse_neglect_details: abuseDetails,
            lab_gfr: labGfr !== "" ? Number(labGfr) : null,
            lab_bun: labBun !== "" ? Number(labBun) : null,
            lab_potassium: labPotassium !== "" ? Number(labPotassium) : null,
            lab_sodium: labSodium !== "" ? Number(labSodium) : null,
            lab_urea: labUrea !== "" ? Number(labUrea) : null,
            lab_creatinine: labCreatinine !== "" ? Number(labCreatinine) : null,
            connections,
            medications,
            nurse_signature: nurseSignature,
            physician_signature: physicianSignature,
          })
          .eq("id", editId);

        if (updateErr) throw new Error(`خطأ تحديث التقييم: ${updateErr.message}`);

        playSuccessSound();
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
            psychological_status: psychologicalStatus,
            mental_status: mentalStatus,
            abuse_neglect_signs: abuseSigns,
            abuse_neglect_details: abuseDetails,
            lab_gfr: labGfr !== "" ? Number(labGfr) : null,
            lab_bun: labBun !== "" ? Number(labBun) : null,
            lab_potassium: labPotassium !== "" ? Number(labPotassium) : null,
            lab_sodium: labSodium !== "" ? Number(labSodium) : null,
            lab_urea: labUrea !== "" ? Number(labUrea) : null,
            lab_creatinine: labCreatinine !== "" ? Number(labCreatinine) : null,
            connections,
            medications,
            nurse_signature: nurseSignature,
            physician_signature: physicianSignature,
          })
          .select()
          .single();

        if (aErr) throw new Error(`خطأ حفظ تقييم المريض: ${aErr.message}`);

        playSuccessSound();
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
    setPsychologicalStatus("");
    setMentalStatus("");
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
    setNurseSignature("");
    setPhysicianSignature("");
    setFieldErrors({});
    setErrorMsg("");
    setTimeout(() => mrnInputRef.current?.focus(), 50);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16 px-2 sm:px-0">
      {/* Top Header Card */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl border border-slate-200/80 shadow-xs no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                نموذج تقييم المريض الشامل
              </h2>
              <span className="bg-slate-100 text-slate-600 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-slate-200">
                TRC-ICD
              </span>
            </div>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • Patient Assessment Form</p>
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
        {/* SECTION 1: Patient & Visit Info */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">1. البيانات العامة للمريض والزيارة</h3>
          </div>

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
                disabled={isLocked}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="الاسم الرباعي كاملاً..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
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
                    disabled={isLocked}
                    onClick={() => setGender(normalizeGender(g))}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                      normalizeGender(gender) === normalizeGender(g)
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
                disabled={isLocked}
                value={age}
                onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
                placeholder="السن..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الطول (سم)</label>
              <input
                type="number"
                disabled={isLocked}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value ? Number(e.target.value) : "")}
                placeholder="الطول..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الوزن (كجم)</label>
              <input
                type="number"
                disabled={isLocked}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : "")}
                placeholder="الوزن..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الطبيب المعالج</label>
              <input
                type="text"
                disabled={isLocked}
                value={attendingPhysician}
                onChange={(e) => setAttendingPhysician(e.target.value)}
                placeholder="اسم الطبيب المعالج..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">هاتف الطبيب المعالج</label>
              <input
                type="text"
                disabled={isLocked}
                value={physicianPhone}
                onChange={(e) => setPhysicianPhone(e.target.value)}
                placeholder="رقم هاتف الطبيب..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Vital Signs */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-rose-600" />
              <span>2. العلامات الحيوية (Vital Signs)</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">ضغط الدم (BP)</label>
              <input
                type="text"
                disabled={isLocked}
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                placeholder="120/80"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">درجة الحرارة (°C)</label>
              <input
                type="number"
                step="0.1"
                disabled={isLocked}
                value={temperature}
                onChange={(e) => setTemperature(e.target.value ? Number(e.target.value) : "")}
                placeholder="37.0"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">النبض (HR bpm)</label>
              <input
                type="number"
                disabled={isLocked}
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value ? Number(e.target.value) : "")}
                placeholder="72"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">معدل التنفس (RR)</label>
              <input
                type="number"
                disabled={isLocked}
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(e.target.value ? Number(e.target.value) : "")}
                placeholder="16"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">تشبع الأكسجين (SaO2 %)</label>
              <input
                type="number"
                disabled={isLocked}
                value={oxygenSaturation}
                onChange={(e) => setOxygenSaturation(e.target.value ? Number(e.target.value) : "")}
                placeholder="98"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Clinical Diagnosis, History, Allergy & Mobility */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">3. التقييم السريري والتاريخ المرضي</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الإجراء المطلوب <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                placeholder="مثال: أشعة مقطعية على المخ بالصبغة..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm ${
                  fieldErrors.procedureName ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">التشخيص (Diagnosis)</label>
              <input
                type="text"
                disabled={isLocked}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="التشخيص المبدئي..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none text-xs sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              التاريخ المرضي والجراحي (Past medical & surgical history)
            </label>
            <textarea
              rows={2}
              disabled={isLocked}
              value={pastHistory}
              onChange={(e) => setPastHistory(e.target.value)}
              placeholder="العمليات السابقة والأمراض المزمنة..."
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs outline-none"
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
                    disabled={isLocked}
                    onClick={() => handleAllergyToggle(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      isSelected
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
                disabled={isLocked}
                value={allergyDetails}
                onChange={(e) => setAllergyDetails(e.target.value)}
                placeholder="أذكر تفاصيل الحساسية..."
                className="w-full mt-2 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
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
                    disabled={isLocked}
                    onClick={() => setMobilityStatus(m)}
                    className={`p-2 rounded-lg text-[11px] font-semibold border transition-all text-right ${
                      mobilityStatus === m
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
                    disabled={isLocked}
                    onClick={() => setIsSmoker(s.val)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      isSmoker === s.val
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

        {/* SECTION 4: Women Assessment (Conditional or Available) */}
        {gender === "انثي" && (
          <div className="bg-rose-50/40 p-5 sm:p-6 rounded-2xl border border-rose-200 shadow-xs space-y-4">
            <div className="border-b border-rose-200 pb-2 flex justify-between items-center">
              <h3 className="text-xs sm:text-sm font-bold text-rose-900">
                4. فحص الحمل والتثقيف الإشعاعي للسيدات
              </h3>
              <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                خاص بالإناث
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ آخر دورة شهرية (LMP)</label>
                <input
                  type="date"
                  disabled={isLocked}
                  value={lmpDate}
                  onChange={(e) => setLmpDate(e.target.value)}
                  className="w-full px-3 py-2 border border-rose-200 rounded-xl text-xs bg-white"
                />
              </div>

              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isLocked}
                    checked={menopause}
                    onChange={(e) => setMenopause(e.target.checked)}
                    className="accent-rose-600 w-4 h-4 rounded"
                  />
                  <span>في مرحلة انقطاع الطمث (Menopause)</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-rose-200 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 block">تأخر في موعد الدورة الشهرية؟</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => setDelayedPeriod(true)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold ${
                      delayedPeriod === true ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    نعم
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => setDelayedPeriod(false)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold ${
                      delayedPeriod === false ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    لا
                  </button>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-rose-200 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 block">تناول وسائل لمنع الحمل؟</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => setContraceptiveUse(true)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold ${
                      contraceptiveUse === true ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    نعم
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => setContraceptiveUse(false)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold ${
                      contraceptiveUse === false ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    لا
                  </button>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-rose-200 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 block">هل تخططين للحمل؟</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => setPlanningPregnancy(true)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold ${
                      planningPregnancy === true ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    نعم
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => setPlanningPregnancy(false)}
                    className={`flex-1 py-1 rounded-lg text-xs font-bold ${
                      planningPregnancy === false ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    لا
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={pregnantOrSuspected}
                  onChange={(e) => setPregnantOrSuspected(e.target.checked)}
                  className="accent-rose-600 w-4 h-4 rounded"
                />
                <span>حامل أو يشتبه في الحمل</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={lactating}
                  onChange={(e) => setLactating(e.target.checked)}
                  className="accent-rose-600 w-4 h-4 rounded"
                />
                <span>في مرحلة الرضاعة</span>
              </label>
            </div>
          </div>
        )}

        {/* SECTION 5: Medical Screening & Devices */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              5. مسح الأمراض المزمنة والأجهزة التعويضية (Medical Review)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border space-y-1.5">
              <label className="flex items-center justify-between font-bold text-slate-800">
                <span>أمراض خاصة بالكلى؟</span>
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={kidneyDisease}
                  onChange={(e) => setKidneyDisease(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4 rounded"
                />
              </label>
              {kidneyDisease && (
                <input
                  type="text"
                  disabled={isLocked}
                  value={kidneyDetails}
                  onChange={(e) => setKidneyDetails(e.target.value)}
                  placeholder="أذكر تفاصيل مرض الكلى..."
                  className="w-full px-2.5 py-1 border rounded-lg text-xs bg-white"
                />
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border space-y-1.5">
              <label className="flex items-center justify-between font-bold text-slate-800">
                <span>أمراض خاصة بالقلب؟</span>
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={heartDisease}
                  onChange={(e) => setHeartDisease(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4 rounded"
                />
              </label>
              {heartDisease && (
                <input
                  type="text"
                  disabled={isLocked}
                  value={heartDetails}
                  onChange={(e) => setHeartDetails(e.target.value)}
                  placeholder="أذكر تفاصيل مرض القلب..."
                  className="w-full px-2.5 py-1 border rounded-lg text-xs bg-white"
                />
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border space-y-1.5">
              <label className="flex items-center justify-between font-bold text-slate-800">
                <span>أدوية مضادة للتجلط؟</span>
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={anticoagulants}
                  onChange={(e) => setAnticoagulants(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4 rounded"
                />
              </label>
              {anticoagulants && (
                <input
                  type="text"
                  disabled={isLocked}
                  value={anticoagulantDetails}
                  onChange={(e) => setAnticoagulantDetails(e.target.value)}
                  placeholder="اسم الدواء المضاد للتجلط..."
                  className="w-full px-2.5 py-1 border rounded-lg text-xs bg-white"
                />
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border space-y-1.5">
              <label className="flex items-center justify-between font-bold text-slate-800">
                <span>جهاز تنظيم ضربات القلب (Pacemaker)؟</span>
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={pacemaker}
                  onChange={(e) => setPacemaker(e.target.checked)}
                  className="accent-rose-600 w-4 h-4 rounded"
                />
              </label>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border space-y-1.5">
              <label className="flex items-center justify-between font-bold text-slate-800">
                <span>مشبك تمدد الأوعية الدماغية (Aneurysm Clip)؟</span>
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={aneurysmClip}
                  onChange={(e) => setAneurysmClip(e.target.checked)}
                  className="accent-rose-600 w-4 h-4 rounded"
                />
              </label>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border space-y-1.5">
              <label className="flex items-center justify-between font-bold text-slate-800">
                <span>مرضى منقوصي المناعة (سكر/سرطان/كورتيزون/كيماوي)؟</span>
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={immunocompromised}
                  onChange={(e) => setImmunocompromised(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4 rounded"
                />
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 6: Lab Results */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">6. نتائج المعمل (Lab Results)</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Creatinine</label>
              <input
                type="number"
                step="0.01"
                disabled={isLocked}
                value={labCreatinine}
                onChange={(e) => setLabCreatinine(e.target.value ? Number(e.target.value) : "")}
                placeholder="0.9"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">GFR</label>
              <input
                type="number"
                disabled={isLocked}
                value={labGfr}
                onChange={(e) => setLabGfr(e.target.value ? Number(e.target.value) : "")}
                placeholder="90"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Urea</label>
              <input
                type="number"
                disabled={isLocked}
                value={labUrea}
                onChange={(e) => setLabUrea(e.target.value ? Number(e.target.value) : "")}
                placeholder="30"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">BUN</label>
              <input
                type="number"
                disabled={isLocked}
                value={labBun}
                onChange={(e) => setLabBun(e.target.value ? Number(e.target.value) : "")}
                placeholder="15"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Sodium (Na+)</label>
              <input
                type="number"
                disabled={isLocked}
                value={labSodium}
                onChange={(e) => setLabSodium(e.target.value ? Number(e.target.value) : "")}
                placeholder="140"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-center"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Potassium (K+)</label>
              <input
                type="number"
                step="0.1"
                disabled={isLocked}
                value={labPotassium}
                onChange={(e) => setLabPotassium(e.target.value ? Number(e.target.value) : "")}
                placeholder="4.0"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono text-center"
              />
            </div>
          </div>
        </div>

        {/* SECTION 7: Cannula & Connections & Medications */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              7. الوصلات الوريدية والأدوية المنصرفة (Connections & Medications)
            </h3>
            {!isLocked && (
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
                    {!isLocked && <th className="p-2.5 text-center">حذف</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {connections.map((c, idx) => (
                    <tr key={c.id}>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={c.name}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].name = e.target.value;
                            setConnections(arr);
                          }}
                          placeholder="اسم الوصلة..."
                          className="w-full px-2 py-1 border rounded text-xs bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={c.size}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].size = e.target.value;
                            setConnections(arr);
                          }}
                          placeholder="المقاس..."
                          className="w-20 px-2 py-1 border rounded text-xs bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={c.site}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].site = e.target.value;
                            setConnections(arr);
                          }}
                          placeholder="المكان..."
                          className="w-full px-2 py-1 border rounded text-xs bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={c.inserted_at}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].inserted_at = e.target.value;
                            setConnections(arr);
                          }}
                          className="w-24 px-2 py-1 border rounded text-xs bg-white font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={c.inserted_by}
                          onChange={(e) => {
                            const arr = [...connections];
                            arr[idx].inserted_by = e.target.value;
                            setConnections(arr);
                          }}
                          className="w-24 px-2 py-1 border rounded text-xs bg-white"
                        />
                      </td>
                      {!isLocked && (
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
                    <th className="p-2.5">توقيع الطبيب</th>
                    <th className="p-2.5">القائم بالإعطاء</th>
                    {!isLocked && <th className="p-2.5 text-center">حذف</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medications.map((m, idx) => (
                    <tr key={m.id}>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={m.time}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].time = e.target.value;
                            setMedications(arr);
                          }}
                          className="w-16 px-2 py-1 border rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={m.name}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].name = e.target.value;
                            setMedications(arr);
                          }}
                          placeholder="اسم الدواء..."
                          className="w-full px-2 py-1 border rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={m.dose}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].dose = e.target.value;
                            setMedications(arr);
                          }}
                          placeholder="الجرعة..."
                          className="w-20 px-2 py-1 border rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={m.route}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].route = e.target.value;
                            setMedications(arr);
                          }}
                          className="w-16 px-2 py-1 border rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={m.ordering_doctor}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].ordering_doctor = e.target.value;
                            setMedications(arr);
                          }}
                          className="w-24 px-2 py-1 border rounded text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={m.administered_by}
                          onChange={(e) => {
                            const arr = [...medications];
                            arr[idx].administered_by = e.target.value;
                            setMedications(arr);
                          }}
                          className="w-24 px-2 py-1 border rounded text-xs"
                        />
                      </td>
                      {!isLocked && (
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

        {/* SECTION 8: Signatures */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                توقيع التمريض <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={nurseSignature}
                onChange={(e) => setNurseSignature(e.target.value)}
                placeholder="اسم وتوقيع الممرض/ة..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm ${
                  fieldErrors.nurseSignature ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">توقيع الطبيب</label>
              <input
                type="text"
                disabled={isLocked}
                value={physicianSignature}
                onChange={(e) => setPhysicianSignature(e.target.value)}
                placeholder="اسم وتوقيع الطبيب..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        {!isLocked ? (
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-8 py-3 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editId ? "حفظ وتوثيق التعديلات" : "حفظ وتوثيق تقييم المريض"}</span>
                </>
              )}
            </button>
          </div>
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
                onClick={() => setIsLocked(false)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
              >
                <Pencil className="w-4 h-4 text-amber-700" />
                <span>تعديل</span>
              </button>

              <button
                type="button"
                onClick={handleNewForm}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إدخال تقييم جديد</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* PRINT VIEW SHEET (100% MATCHING نموذج تقييم المريض .pdf) */}
      <div className="hidden print:block bg-white p-6 text-black font-sans text-xs">
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
              اسم المريض رباعي: <span className="underline font-bold">{patientName || "..................................................."}</span>
            </div>
            <div>
              رقم الملف الطبي: <span className="underline font-bold font-mono">{mrn || "......................."}</span>
            </div>
          </div>
          <div className="flex justify-between pt-1">
            <div>تاريخ الزيارة: {visitDate} / وقت الزيارة: {visitTime}</div>
            <div>الطبيب المعالج: {attendingPhysician || "-"} ({physicianPhone || "-"})</div>
          </div>
          <div className="flex justify-between pt-1">
            <div>الجنس: {gender || "-"} | السن: {age || "-"} سنة</div>
            <div>الوزن: {weightKg ? `${weightKg} كجم` : "-"} | الطول: {heightCm ? `${heightCm} سم` : "-"}</div>
          </div>
        </div>

        {/* Vitals */}
        <div className="border border-black p-2 mb-3">
          <div className="font-bold underline mb-1">العلامات الحيوية (Vital Signs):</div>
          <div className="grid grid-cols-5 text-center font-semibold text-[11px]">
            <div>ضغط الدم: {bloodPressure || "-"}</div>
            <div>الحرارة: {temperature ? `${temperature} °C` : "-"}</div>
            <div>النبض: {heartRate ? `${heartRate} bpm` : "-"}</div>
            <div>التنفس: {respiratoryRate ? `${respiratoryRate}/min` : "-"}</div>
            <div>الأكسجين SaO2: {oxygenSaturation ? `${oxygenSaturation} %` : "-"}</div>
          </div>
        </div>

        {/* Clinical Info */}
        <div className="border border-black p-2 mb-3 space-y-1 text-[11px]">
          <div><strong>الإجراء المطلوب:</strong> <span className="underline font-bold">{procedureName || "-"}</span></div>
          <div><strong>التشخيص:</strong> {diagnosis || "-"}</div>
          <div><strong>التاريخ المرضي والجراحي:</strong> {pastHistory || "-"}</div>
          <div><strong>الحساسية:</strong> {allergyTypes.join(" ، ") || "لا يوجد"} {allergyDetails ? `(${allergyDetails})` : ""}</div>
          <div><strong>حركة المريض:</strong> {mobilityStatus} | <strong>التدخين:</strong> {isSmoker ? "مدخن" : "لا يدخن"}</div>
        </div>

        {/* Labs & Checklist */}
        <div className="border border-black p-2 mb-3 text-[11px]">
          <div className="font-bold underline mb-1">نتائج المعمل والمراجعة الإكلينيكية:</div>
          <div className="grid grid-cols-3 gap-2">
            <div>Creatinine: {labCreatinine || "-"}</div>
            <div>GFR: {labGfr || "-"}</div>
            <div>Urea: {labUrea || "-"}</div>
          </div>
          <div className="pt-2 grid grid-cols-2 gap-1 text-[10px]">
            <div>أمراض الكلى: {kidneyDisease ? `نعم (${kidneyDetails})` : "لا"}</div>
            <div>أمراض القلب: {heartDisease ? `نعم (${heartDetails})` : "لا"}</div>
            <div>أدوية مضادة للتجلط: {anticoagulants ? `نعم (${anticoagulantDetails})` : "لا"}</div>
            <div>جهاز تنظيم ضربات القلب: {pacemaker ? "نعم ⚠️" : "لا"}</div>
          </div>
        </div>

        {/* Connections & Medications */}
        {connections.length > 0 && (
          <div className="border border-black p-2 mb-3 text-[11px]">
            <div className="font-bold underline mb-1">الوصلات الوريدية (Connections):</div>
            {connections.map((c, i) => (
              <div key={i}>{c.name} ({c.size}) - المكان: {c.site} - التركيب: {c.inserted_at} بواسطة: {c.inserted_by}</div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t-2 border-black text-xs font-bold">
          <div>توقيع التمريض: <span className="font-normal underline">{nurseSignature || "...................."}</span></div>
          <div>توقيع الطبيب: <span className="font-normal underline">{physicianSignature || "...................."}</span></div>
          <div>التاريخ: {visitDate}</div>
        </div>

        <div className="text-center text-[10px] font-mono text-slate-500 mt-4 pt-1 border-t border-slate-300">
          TRC-ICD
        </div>
      </div>
    </div>
  );
}

export default function PatientAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">جاري التحميل...</div>}>
      <PatientAssessmentContent />
    </Suspense>
  );
}
