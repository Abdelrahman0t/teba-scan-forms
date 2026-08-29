"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  PlusCircle,
  Pencil,
} from "lucide-react";
import { getCurrentTimeShort, getCurrentDate, formatTime12 } from "@/lib/timeUtils";

function playSuccessSound() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

function RadiationExposureContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const mrnInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<any | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [editLogId, setEditLogId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Form Fields - ALL MANDATORY
  const [mrn, setMrn] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);

  const [heightCm, setHeightCm] = useState<number | "">("");
  const [weightKg, setWeightKg] = useState<number | "">("");
  const [age, setAge] = useState<number | "">("");
  const [procedureName, setProcedureName] = useState("");
  const [procedureLocation, setProcedureLocation] = useState("");
  const [radiationDose, setRadiationDose] = useState<number | "">("");
  const [cumulativeDose, setCumulativeDose] = useState<number | "">("");
  const [previousCumulativeDose, setPreviousCumulativeDose] = useState<number>(0);
  const [techSignature, setTechSignature] = useState("");

  // Load from editId if present in URL
  useEffect(() => {
    const editId = searchParams.get("editId");
    if (editId) {
      loadRecordForEdit(editId);
    }
  }, [searchParams]);

  async function loadRecordForEdit(id: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("radiation_exposure_logs")
        .select("*, patients(id, full_name, mrn)")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        const curDose = Number(data.radiation_dose) || 0;
        const curCum = Number(data.cumulative_dose) || curDose;
        const priorDose = Math.max(0, curCum - curDose);

        setEditLogId(data.id);
        setPatientId(data.patient_id);
        setPatientName(data.patients?.full_name || "");
        setMrn(data.patients?.mrn || "");
        setHeightCm(data.height_cm || "");
        setWeightKg(data.weight_kg || "");
        setAge(data.age || "");
        setProcedureName(data.procedure_name || "");
        setProcedureLocation(data.procedure_location || "");
        setRadiationDose(curDose);
        setCumulativeDose(curCum);
        setPreviousCumulativeDose(priorDose);
        setTechSignature(data.tech_signature || "");
        setIsLocked(false);
      }
    } catch (err: any) {
      setErrorMsg("تعذر تحميل بيانات السجل للتعديل: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchPatientByMrn(searchMrn: string) {
    if (!searchMrn.trim() || editLogId) return;
    try {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("mrn", searchMrn.trim())
        .single();

      if (data) {
        setPatientId(data.id);
        setPatientName(data.full_name || "");
        if (data.age !== null && data.age !== undefined && data.age !== "") {
          setAge(data.age);
        } else {
          // Check other tables as fallback
          const [assessRes, fallRes] = await Promise.all([
            supabase.from("patient_assessments").select("age").eq("patient_id", data.id).not("age", "is", null).order("created_at", { ascending: false }).limit(1),
            supabase.from("fall_risk_screenings").select("age").eq("patient_id", data.id).not("age", "is", null).order("created_at", { ascending: false }).limit(1),
          ]);
          const foundAge = assessRes.data?.[0]?.age || fallRes.data?.[0]?.age;
          if (foundAge) setAge(foundAge);
        }
        fetchPatientRadiationLogs(data.id);
      } else {
        setPatientId(null);
        setPreviousCumulativeDose(0);
      }
    } catch (err) {}
  }

  async function fetchPatientRadiationLogs(pid: string) {
    if (editLogId) return; // Never overwrite baseline in edit mode
    const { data } = await supabase
      .from("radiation_exposure_logs")
      .select("*")
      .eq("patient_id", pid)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const latestPriorCumulative = Number(data[0].cumulative_dose || 0);
      setPreviousCumulativeDose(latestPriorCumulative);

      if (data[0].height_cm && !heightCm) setHeightCm(data[0].height_cm);
      if (data[0].weight_kg && !weightKg) setWeightKg(data[0].weight_kg);
      if (data[0].age && !age) setAge(data[0].age);
      if (data[0].tech_signature && !techSignature) setTechSignature(data[0].tech_signature);

      if (radiationDose !== "") {
        setCumulativeDose(latestPriorCumulative + Number(radiationDose));
      }
    } else {
      setPreviousCumulativeDose(0);
      if (radiationDose !== "") {
        setCumulativeDose(Number(radiationDose));
      }
    }
  }

  function handleRadiationDoseChange(val: string) {
    const num = val === "" ? "" : Number(val);
    setRadiationDose(num);
    if (num !== "") {
      setCumulativeDose(previousCumulativeDose + Number(num));
    } else {
      setCumulativeDose(previousCumulativeDose > 0 ? previousCumulativeDose : "");
    }
  }

  // STRICT VALIDATION FOR ALL FIELDS
  function validateForm() {
    const errors: { [key: string]: string } = {};
    if (!mrn.trim()) errors.mrn = "رقم الملف الطبي مطلوب";
    if (!patientName.trim()) errors.patientName = "اسم المريض رباعي مطلوب";
    if (age === "" || Number(age) <= 0) errors.age = "السن مطلوب";
    if (heightCm === "" || Number(heightCm) <= 0) errors.heightCm = "الطول (سم) مطلوب";
    if (weightKg === "" || Number(weightKg) <= 0) errors.weightKg = "الوزن (كجم) مطلوب";
    if (!procedureName.trim()) errors.procedureName = "الاجراء مطلوب";
    if (!procedureLocation.trim()) errors.procedureLocation = "مكان الاجراء مطلوب";
    if (!techSignature.trim()) errors.techSignature = "توقيع فني الاشعة مطلوب";
    if (radiationDose === "" || Number(radiationDose) <= 0)
      errors.radiationDose = "جرعة الاشعاع مطلوبة";
    if (cumulativeDose === "" || Number(cumulativeDose) <= 0)
      errors.cumulativeDose = "الجرعة التراكمية مطلوبة";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!validateForm()) {
      setErrorMsg("كافة الحقول إجبارية. يرجى استكمال البيانات الموضحة باللون الأحمر.");
      return;
    }

    setLoading(true);

    const doseVal = Number(radiationDose) || 0;
    const cumDoseVal = Number(cumulativeDose) || (previousCumulativeDose + doseVal);

    try {
      let currentPid = patientId;
      if (!currentPid) {
        const { data: newPatient, error: pError } = await supabase
          .from("patients")
          .upsert(
            {
              mrn: mrn.trim(),
              full_name: patientName.trim(),
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
            age: age !== "" ? Number(age) : null,
          })
          .eq("id", currentPid);
      }

      if (editLogId) {
        // UPDATE EXISTING RECORD (Keep exact cumulative dose as displayed)
        const { error: updateErr } = await supabase
          .from("radiation_exposure_logs")
          .update({
            height_cm: Number(heightCm),
            weight_kg: Number(weightKg),
            age: Number(age),
            procedure_name: procedureName,
            procedure_location: procedureLocation,
            radiation_dose: doseVal,
            cumulative_dose: cumDoseVal,
            tech_signature: techSignature,
          })
          .eq("id", editLogId);

        if (updateErr) throw new Error(`خطأ تحديث الجرعة: ${updateErr.message}`);

        playSuccessSound();
        setPreviousCumulativeDose(Math.max(0, cumDoseVal - doseVal));
        setCumulativeDose(cumDoseVal);
        setLastSavedRecord({
          id: editLogId,
          patientName,
          mrn,
          procedureName,
          dose: doseVal,
          cumulativeDose: cumDoseVal,
        });
        setIsLocked(true);
      } else {
        // INSERT NEW RECORD
        const { data: template } = await supabase
          .from("form_templates")
          .select("id")
          .eq("code", "TRC_MRS_DOSE")
          .single();

        const formData = {
          mrn,
          patient_name: patientName,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          age: Number(age),
          procedure_name: procedureName,
          procedure_location: procedureLocation,
          radiation_dose: doseVal,
          cumulative_dose: cumDoseVal,
          tech_signature: techSignature,
        };

        let submissionId = null;
        if (template) {
          const { data: subData, error: subErr } = await supabase
            .from("form_submissions")
            .insert({
              patient_id: currentPid,
              template_id: template.id,
              data: formData,
            })
            .select()
            .single();
          if (subErr) throw new Error(`خطأ التقديم: ${subErr.message}`);
          if (subData) submissionId = subData.id;
        }

        const { data: savedLog, error: logErr } = await supabase
          .from("radiation_exposure_logs")
          .insert({
            submission_id: submissionId,
            patient_id: currentPid,
            height_cm: Number(heightCm),
            weight_kg: Number(weightKg),
            age: Number(age),
            procedure_name: procedureName,
            procedure_location: procedureLocation,
            radiation_dose: doseVal,
            cumulative_dose: cumDoseVal,
            tech_signature: techSignature,
          })
          .select()
          .single();

        if (logErr) throw new Error(`خطأ تسجيل الجرعة: ${logErr.message}`);

        playSuccessSound();
        setEditLogId(savedLog?.id || submissionId);
        setPreviousCumulativeDose(Math.max(0, cumDoseVal - doseVal));
        setCumulativeDose(cumDoseVal);
        setLastSavedRecord({
          id: savedLog?.id || submissionId,
          patientName,
          mrn,
          procedureName,
          dose: doseVal,
          cumulativeDose: cumDoseVal,
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
    setEditLogId(null);
    setMrn("");
    setPatientName("");
    setPatientId(null);
    setHeightCm("");
    setWeightKg("");
    setAge("");
    setProcedureName("");
    setProcedureLocation("");
    setRadiationDose("");
    setCumulativeDose("");
    setPreviousCumulativeDose(0);
    setTechSignature("");
    setFieldErrors({});
    setErrorMsg("");
    setTimeout(() => mrnInputRef.current?.focus(), 50);
  }

  function handleUnlockForEdit() {
    setIsLocked(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16 px-2 sm:px-0">
      {/* Form Header */}
      <div className="flex items-center justify-between bg-white px-5 py-4 rounded-3xl border border-purple-100 shadow-sm no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white p-0.5 shadow-sm border border-purple-200 flex items-center justify-center shrink-0">
            <img src="/tiba-scan.jpg" alt="Tiba Scan" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-[#481454]">
                نموذج تسجيل التعرض لجرعات الاشعة
              </h2>
              <span className="bg-purple-50 text-purple-900 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-purple-200">
                TRC.MRS
              </span>
            </div>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • Tiba Scan Radiology Center</p>
          </div>
        </div>

        {editLogId && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg">
            {isLocked ? "تم الحفظ والتوثيق" : "وضع التعديل"}
          </span>
        )}
      </div>

      {/* Error Alert Box */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm no-print">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Main Form */}
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
                  placeholder="أدخل رقم الملف الطبي..."
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
                placeholder="الاسم الرباعي كاملاً..."
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                السن <span className="text-rose-500">*</span>
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الطول (سم) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                disabled={isLocked}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value ? Number(e.target.value) : "")}
                placeholder="الطول بالسم..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.heightCm
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                }`}
              />
              {fieldErrors.heightCm && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.heightCm}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الوزن (كجم) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                disabled={isLocked}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : "")}
                placeholder="الوزن بالكجم..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.weightKg
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                }`}
              />
              {fieldErrors.weightKg && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.weightKg}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: Examination & Radiation Dose Details */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الاجراء <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                placeholder="الاجراء..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.procedureName
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                }`}
              />
              {fieldErrors.procedureName && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.procedureName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مكان الاجراء <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={procedureLocation}
                onChange={(e) => setProcedureLocation(e.target.value)}
                placeholder="مكان الاجراء..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.procedureLocation
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                }`}
              />
              {fieldErrors.procedureLocation && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.procedureLocation}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                توقيع فني الاشعة <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={techSignature}
                onChange={(e) => setTechSignature(e.target.value)}
                placeholder="اسم / توقيع فني الاشعة..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.techSignature
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                }`}
              />
              {fieldErrors.techSignature && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.techSignature}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                جرعة الاشعاع <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                disabled={isLocked}
                value={radiationDose}
                onChange={(e) => handleRadiationDoseChange(e.target.value)}
                placeholder="0.00"
                className={`w-full px-3.5 py-2.5 border rounded-xl font-bold text-sm text-sky-900 bg-white ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.radiationDose
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                }`}
              />
              {fieldErrors.radiationDose && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.radiationDose}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                الجرعة التراكمية <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                disabled={isLocked}
                value={cumulativeDose}
                onChange={(e) => setCumulativeDose(e.target.value ? Number(e.target.value) : "")}
                placeholder="0.00"
                className={`w-full px-3.5 py-2.5 border rounded-xl font-bold text-sm text-sky-950 bg-sky-50/50 ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.cumulativeDose
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-sky-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                }`}
              />
              {fieldErrors.cumulativeDose && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.cumulativeDose}</p>
              )}
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
                  <span>{editLogId ? "حفظ وتوثيق التعديلات" : "حفظ وتوثيق الجرعة"}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-emerald-950">
                تم الحفظ بنجاح! ({lastSavedRecord?.patientName || patientName})
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
                onClick={handleUnlockForEdit}
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
                <span>إدخال نموذج جديد</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Print View Sheet (100% Matching نموذج تسجيل التعرض لجرعات الاشعة.pdf) */}
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

        <div className="flex justify-between items-center text-xs font-bold py-2 mb-2 border-b border-black">
          <div>
            اسم المريض رباعي:{" "}
            <span className="font-normal underline mr-1">
              {patientName || "......................................................."}
            </span>
          </div>
          <div>
            رقم الملف الطبي:{" "}
            <span className="font-normal underline mr-1">
              {mrn || "......................................................."}
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
              <td className="border border-black p-2">{new Date().toLocaleDateString("ar-EG")}</td>
              <td className="border border-black p-2 font-mono">
                {getCurrentTimeShort()}
              </td>
              <td className="border border-black p-2">{heightCm ? `${heightCm}` : "-"}</td>
              <td className="border border-black p-2">{weightKg ? `${weightKg}` : "-"}</td>
              <td className="border border-black p-2">{age || "-"}</td>
              <td className="border border-black p-2">
                {procedureName} {procedureLocation ? `(${procedureLocation})` : ""}
              </td>
              <td className="border border-black p-2 font-bold">{radiationDose || 0}</td>
              <td className="border border-black p-2 font-bold">{cumulativeDose || 0}</td>
              <td className="border border-black p-2">{techSignature || "فني الأشعة"}</td>
            </tr>
          </tbody>
        </table>

        <div className="text-center text-xs font-mono font-bold mt-12 pt-4 border-t border-black">
          TRC.MRS
        </div>
      </div>
    </div>
  );
}

export default function RadiationExposurePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">جاري التحميل...</div>}>
      <RadiationExposureContent />
    </Suspense>
  );
}
