"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Ambulance,
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
  ArrowRightLeft,
  Users,
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

const RSTP_PARAMETERS = [
  {
    id: "hemodynamic",
    title_en: "Hemodynamic",
    title_ar: "استقرار الدورة الدموية",
    options: [
      { score: 0, label_en: "Stable", label_ar: "مستقر (0)" },
      { score: 1, label_en: "Moderately Stable (<15 ml/min)", label_ar: "متوسط الاستقرار (<15 مل/د) (+1)" },
      { score: 2, label_en: "Unstable (>15 ml/min or Inotropics)", label_ar: "غير مستقر (>15 مل/د أو مقويات) (+2)" },
    ],
  },
  {
    id: "arrhythmias",
    title_en: "Arrhythmias (Existing or Probable)",
    title_ar: "اضطراب ضربات القلب",
    options: [
      { score: 0, label_en: "No", label_ar: "لا يوجد (0)" },
      { score: 1, label_en: "Yes, Not Serious", label_ar: "نعم، غير خطير (+1)" },
      { score: 2, label_en: "Serious (And AMI in first 48h)", label_ar: "خطير / جلطة حادة (+2)" },
    ],
  },
  {
    id: "ecg_monitoring",
    title_en: "ECG Monitoring",
    title_ar: "مراقبة رسم القلب (ECG)",
    options: [
      { score: 0, label_en: "No", label_ar: "غير مطلوب (0)" },
      { score: 1, label_en: "Yes (Desirable)", label_ar: "مستحسن (+1)" },
      { score: 2, label_en: "Yes (Essential)", label_ar: "ضروري وحتمي (+2)" },
    ],
  },
  {
    id: "iv_line",
    title_en: "Intravenous Line",
    title_ar: "الخط الوريدي (IV Line)",
    options: [
      { score: 0, label_en: "No", label_ar: "لا يوجد (0)" },
      { score: 1, label_en: "Yes (Standard Line)", label_ar: "نعم خط وريدي عادي (+1)" },
      { score: 2, label_en: "Pulmonary Artery Catheter", label_ar: "قسطرة الشريان الرئوي (+2)" },
    ],
  },
  {
    id: "provisional_pacemaker",
    title_en: "Provisional Pacemaker",
    title_ar: "منظم ضربات القلب المؤقت",
    options: [
      { score: 0, label_en: "No", label_ar: "لا يوجد (0)" },
      { score: 1, label_en: "Yes (Not Invasive)", label_ar: "نعم غير جراحي (+1)" },
      { score: 2, label_en: "Yes (Endocarditis)", label_ar: "نعم جراحي / التهاب بطانة القلب (+2)" },
    ],
  },
  {
    id: "respiration",
    title_en: "Respiration",
    title_ar: "معدل التنفس",
    options: [
      { score: 0, label_en: "RR Between 10 and 14 bpm", label_ar: "معدل طبيعي 10-14/د (0)" },
      { score: 1, label_en: "RR Between 15–35 bpm", label_ar: "معدل 15-35/د (+1)" },
      { score: 2, label_en: "Apnoea <10 or >36 or Irregular", label_ar: "انقطاع تنفس <10 أو >36 أو غير منتظم (+2)" },
    ],
  },
  {
    id: "airway",
    title_en: "Airway",
    title_ar: "مجرى الهواء",
    options: [
      { score: 0, label_en: "No", label_ar: "طبيعي بدون أجهزة (0)" },
      { score: 1, label_en: "Yes (Guedel Tube)", label_ar: "أنبوب مجرى هوائي Guedel (+1)" },
      { score: 2, label_en: "Yes (Intubation or Tracheostomy)", label_ar: "أنبوبة حنجرية أو شق حنجري (+2)" },
    ],
  },
  {
    id: "respiratory_support",
    title_en: "Respiratory Support",
    title_ar: "الدعم التنفسي",
    options: [
      { score: 0, label_en: "No", label_ar: "لا يوجد (0)" },
      { score: 1, label_en: "Yes (Oxygen Therapy)", label_ar: "علاج بالأكسجين (+1)" },
      { score: 2, label_en: "Yes (Mechanical Ventilation)", label_ar: "تنفس صناعي ميكانيكي (+2)" },
    ],
  },
  {
    id: "neurological",
    title_en: "Neurological Assessment",
    title_ar: "التقييم العصبي (GCS)",
    options: [
      { score: 0, label_en: "GCS = 15", label_ar: "واعي تماماً GCS = 15 (0)" },
      { score: 1, label_en: "GCS 8–14", label_ar: "متوسط الوعي GCS 8–14 (+1)" },
      { score: 2, label_en: "GCS < 8 and/or Neuro Disorder", label_ar: "غيبوبة GCS < 8 أو اضطراب عصبي حاد (+2)" },
    ],
  },
  {
    id: "prematurely",
    title_en: "Prematurely / Newborn Weight",
    title_ar: "الأطفال حديثي الولادة",
    options: [
      { score: 0, label_en: "Newborn > 2000 g / Adult", label_ar: "بالغ أو مولود > 2000 جم (0)" },
      { score: 1, label_en: "Newborn 1200 – 2000 g", label_ar: "مولود بين 1200 و 2000 جم (+1)" },
      { score: 2, label_en: "Newborn < 1200 g", label_ar: "مولود مبتسر < 1200 جم (+2)" },
    ],
  },
  {
    id: "techno_pharmacological",
    title_en: "Techno-pharmacological Support",
    title_ar: "الدعم الدوائي والتقني",
    options: [
      { score: 0, label_en: "None", label_ar: "لا يوجد (0)" },
      { score: 1, label_en: "Group I (Inotropics, Sedatives, etc.)", label_ar: "المجموعة 1 (مقويات، مهدئات، مدرات بول) (+1)" },
      { score: 2, label_en: "Group II (Inotropics + Vasodilators, MAST, Incubator)", label_ar: "المجموعة 2 (حضّانة، تخدير كلي، مقويات+موسعات) (+2)" },
    ],
  },
];

function PatientTransferContent() {
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

  // Transfer Route Details
  const [transferDate, setTransferDate] = useState(() => getCurrentDate());
  const [transferTime, setTransferTime] = useState(() => getCurrentTimeShort());
  const [transferPeriod, setTransferPeriod] = useState<"AM" | "PM">("AM");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [transferReason, setTransferReason] = useState("");

  // 11 RSTP Scores (0, 1, 2) - Empty initially so nothing is pre-selected
  const [scores, setScores] = useState<{ [key: string]: number | null }>({});

  // Transfer Instructions & Signatures
  const [transferInstructions, setTransferInstructions] = useState("");
  const [receivingNurseSignature, setReceivingNurseSignature] = useState("");
  const [receivingPhysicianSignature, setReceivingPhysicianSignature] = useState("");
  const [receivingDate, setReceivingDate] = useState(() => getCurrentDate());
  const [receivingTime, setReceivingTime] = useState(() => getCurrentTimeShort());

  // Total RSTP Score Calculation
  const totalRstpScore: number = useMemo(() => {
    return Object.values(scores).reduce<number>((acc: number, curr) => acc + (typeof curr === "number" ? curr : 0), 0);
  }, [scores]);

  // Transportation Group & Vehicle Logic
  const transportInterpretation = useMemo(() => {
    if (totalRstpScore <= 2) {
      return {
        group: "0",
        vehicle_ar: "كرسي متحرك – مشي",
        vehicle_en: "Wheelchair – Walking",
        staff_ar: "مساعد تمريض (Nurse Aid)",
        staff_en: "Nurse Aid",
        continuousMonitoring: false,
      };
    } else if (totalRstpScore <= 6) {
      return {
        group: "I",
        vehicle_ar: "سرير – حامل متحرك (ترولي)",
        vehicle_en: "Bed – Trolley",
        staff_ar: "مساعد تمريض + ممرضة (Nurse Aid, Nurse)",
        staff_en: "Nurse Aid, Nurse",
        continuousMonitoring: true,
      };
    } else {
      return {
        group: "II",
        vehicle_ar: "سرير – حامل متحرك (ترولي)",
        vehicle_en: "Bed – Trolley",
        staff_ar: "مساعد تمريض + ممرضة + طبيب (Nurse Aid, Nurse and Physician)",
        staff_en: "Nurse Aid, Nurse and Physician",
        continuousMonitoring: true,
      };
    }
  }, [totalRstpScore]);

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
        .from("patient_transfers")
        .select("*, patients(id, full_name, mrn)")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setEditId(data.id);
        setPatientId(data.patient_id);
        setPatientName(data.patients?.full_name || "");
        setMrn(data.patients?.mrn || "");
        if (data.transfer_date) setTransferDate(data.transfer_date);
        if (data.transfer_time) setTransferTime(formatTime12(data.transfer_time));
        if (data.transfer_period) setTransferPeriod(data.transfer_period as any);
        setFromLocation(data.from_location || "");
        setToLocation(data.to_location || "");
        setTransferReason(data.transfer_reason || "");
        setScores({
          hemodynamic: data.hemodynamic_score ?? 0,
          arrhythmias: data.arrhythmias_score ?? 0,
          ecg_monitoring: data.ecg_monitoring_score ?? 0,
          iv_line: data.iv_line_score ?? 0,
          provisional_pacemaker: data.pacemaker_score ?? data.provisional_pacemaker_score ?? 0,
          respiration: data.respiration_score ?? 0,
          airway: data.airway_score ?? 0,
          respiratory_support: data.respiratory_support_score ?? 0,
          neurological: data.neurological_score ?? 0,
          prematurely: data.prematurely_score ?? 0,
          techno_pharmacological: data.techno_pharmacological_score ?? 0,
        });
        setTransferInstructions(data.transfer_instructions || "");
        setReceivingNurseSignature(data.receiving_nurse_signature || "");
        setReceivingPhysicianSignature(data.receiving_physician_signature || "");
        if (data.receiving_date) setReceivingDate(data.receiving_date);
        if (data.receiving_time) setReceivingTime(formatTime12(data.receiving_time));
        setIsLocked(false);
      }
    } catch (err: any) {
      setErrorMsg("تعذر تحميل بيانات النقل للتعديل: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function searchPatientByMrn(searchMrn: string) {
    if (!searchMrn.trim() || editId) return;
    try {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("mrn", searchMrn.trim())
        .single();

      if (data) {
        setPatientId(data.id);
        setPatientName(data.full_name);
      }
    } catch (err) {}
  }

  function validateForm() {
    const errors: { [key: string]: string } = {};
    if (!mrn.trim()) errors.mrn = "رقم الملف الطبي مطلوب";
    if (!patientName.trim()) errors.patientName = "اسم المريض رباعي مطلوب";
    if (!fromLocation.trim()) errors.fromLocation = "مكان النقل (من) مطلوب";
    if (!toLocation.trim()) errors.toLocation = "وجهة النقل (إلى) مطلوبة";
    if (!transferReason.trim()) errors.transferReason = "سبب النقل مطلوب";
    if (!receivingNurseSignature.trim())
      errors.receivingNurseSignature = "توقيع الممرض/ة المحول له المريض مطلوب";

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
          .upsert({ mrn: mrn.trim(), full_name: patientName.trim() }, { onConflict: "mrn" })
          .select()
          .single();

        if (pError) throw new Error(`خطأ بيانات المريض: ${pError.message}`);
        currentPid = newPatient.id;
        setPatientId(currentPid);
      } else {
        await supabase
          .from("patients")
          .update({ full_name: patientName.trim(), mrn: mrn.trim() })
          .eq("id", currentPid);
      }

      const payloadData = {
        mrn,
        patient_name: patientName,
        transfer_date: transferDate,
        transfer_time: transferTime,
        transfer_period: transferPeriod,
        from_location: fromLocation,
        to_location: toLocation,
        transfer_reason: transferReason,
        rstp_scores: scores,
        total_rstp_score: totalRstpScore,
        group_code: transportInterpretation.group,
        recommended_vehicle: transportInterpretation.vehicle_ar,
        recommended_staff: transportInterpretation.staff_ar,
        continuous_monitoring: transportInterpretation.continuousMonitoring,
        transfer_instructions: transferInstructions,
        receiving_nurse_signature: receivingNurseSignature,
        receiving_physician_signature: receivingPhysicianSignature,
        receiving_date: receivingDate,
        receiving_time: receivingTime,
      };

      if (editId) {
        const { error: updateErr } = await supabase
          .from("patient_transfers")
          .update({
            transfer_date: transferDate,
            transfer_time: sanitizeSqlTime(transferTime),
            transfer_period: transferPeriod,
            from_location: fromLocation,
            to_location: toLocation,
            transfer_reason: transferReason,
            hemodynamic_score: scores.hemodynamic ?? 0,
            arrhythmias_score: scores.arrhythmias ?? 0,
            ecg_monitoring_score: scores.ecg_monitoring ?? 0,
            iv_line_score: scores.iv_line ?? 0,
            pacemaker_score: scores.provisional_pacemaker ?? 0,
            respiration_score: scores.respiration ?? 0,
            airway_score: scores.airway ?? 0,
            respiratory_support_score: scores.respiratory_support ?? 0,
            neurological_score: scores.neurological ?? 0,
            prematurely_score: scores.prematurely ?? 0,
            techno_pharmacological_score: scores.techno_pharmacological ?? 0,
            total_rstp_score: totalRstpScore,
            group_code: transportInterpretation.group,
            recommended_vehicle: transportInterpretation.vehicle_ar,
            recommended_staff: transportInterpretation.staff_ar,
            continuous_monitoring_applicable: transportInterpretation.continuousMonitoring,
            transfer_instructions: transferInstructions,
            receiving_nurse_signature: receivingNurseSignature,
            receiving_physician_signature: receivingPhysicianSignature,
            receiving_date: receivingDate,
            receiving_time: sanitizeSqlTime(receivingTime),
          })
          .eq("id", editId);

        if (updateErr) throw new Error(`خطأ تحديث نموذج النقل: ${updateErr.message}`);

        playSuccessSound();
        setLastSavedRecord({
          id: editId,
          patientName,
          mrn,
          group: transportInterpretation.group,
        });
        setIsLocked(true);
      } else {
        const { data: template } = await supabase
          .from("form_templates")
          .select("id")
          .eq("code", "TRC_ACT_PATIENT_TRANSFER")
          .single();

        let submissionId = null;
        if (template) {
          const { data: subData } = await supabase
            .from("form_submissions")
            .insert({
              patient_id: currentPid,
              template_id: template.id,
              form_code: "TRC_ACT_PATIENT_TRANSFER",
              data: payloadData,
            })
            .select()
            .single();

          if (subData) submissionId = subData.id;
        }

        const { data: savedTransfer, error: tErr } = await supabase
          .from("patient_transfers")
          .insert({
            submission_id: submissionId,
            patient_id: currentPid,
            transfer_date: transferDate,
            transfer_time: sanitizeSqlTime(transferTime),
            transfer_period: transferPeriod,
            from_location: fromLocation,
            to_location: toLocation,
            transfer_reason: transferReason,
            hemodynamic_score: scores.hemodynamic ?? 0,
            arrhythmias_score: scores.arrhythmias ?? 0,
            ecg_monitoring_score: scores.ecg_monitoring ?? 0,
            iv_line_score: scores.iv_line ?? 0,
            pacemaker_score: scores.provisional_pacemaker ?? 0,
            respiration_score: scores.respiration ?? 0,
            airway_score: scores.airway ?? 0,
            respiratory_support_score: scores.respiratory_support ?? 0,
            neurological_score: scores.neurological ?? 0,
            prematurely_score: scores.prematurely ?? 0,
            techno_pharmacological_score: scores.techno_pharmacological ?? 0,
            total_rstp_score: totalRstpScore,
            group_code: transportInterpretation.group,
            recommended_vehicle: transportInterpretation.vehicle_ar,
            recommended_staff: transportInterpretation.staff_ar,
            continuous_monitoring_applicable: transportInterpretation.continuousMonitoring,
            transfer_instructions: transferInstructions,
            receiving_nurse_signature: receivingNurseSignature,
            receiving_physician_signature: receivingPhysicianSignature,
            receiving_date: receivingDate,
            receiving_time: sanitizeSqlTime(receivingTime),
          })
          .select()
          .single();

        if (tErr) throw new Error(`خطأ حفظ نموذج النقل: ${tErr.message}`);

        playSuccessSound();
        setEditId(savedTransfer?.id || submissionId);
        setLastSavedRecord({
          id: savedTransfer?.id || submissionId,
          patientName,
          mrn,
          group: transportInterpretation.group,
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
    setFromLocation("");
    setToLocation("");
    setTransferReason("");
    setScores({});
    setTransferInstructions("");
    setReceivingNurseSignature("");
    setReceivingPhysicianSignature("");
    setTransferDate(getCurrentDate());
    setTransferTime(getCurrentTimeShort());
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
                نموذج نقل المريض (Patient Transfer)
              </h2>
              <span className="bg-purple-50 text-purple-900 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-purple-200">
                TRC.ACT
              </span>
            </div>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • Risk Score for Transport Patient (RSTP)</p>
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5 no-print">
        {/* SECTION 1: Patient & Route Details */}
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
                      : "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                    : "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                }`}
              />
              {fieldErrors.patientName && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.patientName}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ النقل</label>
              <input
                type="date"
                disabled={isLocked}
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الوقت</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={isLocked}
                  value={transferTime}
                  onChange={(e) => setTransferTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                />
                <select
                  disabled={isLocked}
                  value={transferPeriod}
                  onChange={(e) => setTransferPeriod(e.target.value as any)}
                  className="px-2 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                >
                  <option value="AM">صباحاً (AM)</option>
                  <option value="PM">مساءً (PM)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                من (From) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                placeholder="مثال: قسم الطوارئ / العناية..."
                className={`w-full px-3 py-2 border rounded-xl text-xs sm:text-sm ${
                  fieldErrors.fromLocation ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                إلى (To) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                placeholder="مثال: قسم الأشعة المقطعية..."
                className={`w-full px-3 py-2 border rounded-xl text-xs sm:text-sm ${
                  fieldErrors.toLocation ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سبب النقل <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="أذكر سبب النقل..."
                className={`w-full px-3 py-2 border rounded-xl text-xs sm:text-sm ${
                  fieldErrors.transferReason ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                }`}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: RSTP Live Interpretation Result Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-xs text-blue-300 font-semibold block">نتيجة تقييم معدل الخطر عند نقل المريض</span>
              <h3 className="text-xl font-extrabold">
                مجموع نقاط الخطر (RSTP Score): {totalRstpScore} نقطة
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-500/30 border border-blue-400/40 rounded-xl font-bold text-sm">
                المجموعة {transportInterpretation.group} (Group {transportInterpretation.group})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
            <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs space-y-1">
              <span className="text-blue-200 block text-[11px]">وسيلة النقل المطلوبة (Vehicle):</span>
              <strong className="text-sm font-bold block">{transportInterpretation.vehicle_ar}</strong>
              <span className="text-[10px] text-slate-300 block">{transportInterpretation.vehicle_en}</span>
            </div>

            <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs space-y-1">
              <span className="text-blue-200 block text-[11px]">طاقم النقل المرافق (Staff):</span>
              <strong className="text-sm font-bold block">{transportInterpretation.staff_ar}</strong>
              <span className="text-[10px] text-slate-300 block">{transportInterpretation.staff_en}</span>
            </div>

            <div className="bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs space-y-1">
              <span className="text-blue-200 block text-[11px]">نموذج المتابعة المستمرة:</span>
              <strong
                className={`text-sm font-bold block ${
                  transportInterpretation.continuousMonitoring ? "text-amber-300" : "text-slate-300"
                }`}
              >
                {transportInterpretation.continuousMonitoring ? "مطبق (Applicable ✓)" : "غير مطبق (NA)"}
              </strong>
            </div>
          </div>
        </div>

        {/* SECTION 3: 11 RSTP Parameters Checklist */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              دراسة الخطورة ومعدل الخطر عند نقل المريض (RSTP 11 Parameters)
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            {RSTP_PARAMETERS.map((param, pIdx) => {
              const currentVal = scores[param.id];
              const hasValue = typeof currentVal === "number";
              return (
                <div
                  key={param.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">
                      {pIdx + 1}. {param.title_ar} — ({param.title_en})
                    </span>
                    <span className={`font-bold px-2.5 py-0.5 rounded-md border text-[11px] ${
                      hasValue ? "text-blue-700 bg-blue-50 border-blue-200" : "text-slate-500 bg-slate-100 border-slate-200 font-normal"
                    }`}>
                      {hasValue ? `${currentVal} نقاط` : "غير محدد"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {param.options.map((opt) => {
                      const isSelected = hasValue && currentVal === opt.score;
                      return (
                        <button
                          key={opt.score}
                          type="button"
                          disabled={isLocked}
                          onClick={() => setScores((prev) => ({ ...prev, [param.id]: opt.score }))}
                          className={`p-2.5 rounded-xl border text-right transition-all text-xs font-semibold ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span className="block font-bold">{opt.label_ar}</span>
                          <span
                            className={`block text-[10px] ${
                              isSelected ? "text-blue-100" : "text-slate-400"
                            }`}
                          >
                            {opt.label_en}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: Transfer Instructions */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <label className="block text-xs font-bold text-slate-800">
            تعليمات النقل (Transfer Instructions):
          </label>
          <textarea
            rows={3}
            disabled={isLocked}
            value={transferInstructions}
            onChange={(e) => setTransferInstructions(e.target.value)}
            placeholder="أدخل أي تعليمات خاصة بنقل المريض، احتياطات التنفس، والأجهزة المرافقة..."
            className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs outline-none"
          />
        </div>

        {/* SECTION 5: Signatures & Timestamp */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                توقيع الممرض/ة المحول له المريض <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={receivingNurseSignature}
                onChange={(e) => setReceivingNurseSignature(e.target.value)}
                placeholder="اسم وتوقيع الممرض/ة..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm ${
                  fieldErrors.receivingNurseSignature ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                توقيع الطبيب المستلم (Receiving Physician)
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={receivingPhysicianSignature}
                onChange={(e) => setReceivingPhysicianSignature(e.target.value)}
                placeholder="اسم وتوقيع الطبيب المستلم..."
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
                  <span>{editId ? "حفظ وتوثيق التعديلات" : "حفظ وتوثيق نموذج النقل"}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-emerald-950">
                تم حفظ نموذج نقل المريض بنجاح! ({lastSavedRecord?.patientName || patientName})
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
                <span>إدخال نموذج نقل جديد</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {/* PRINT VIEW SHEET (100% MATCHING نموذج نقل المريض.pdf) */}
      <div className="hidden print:block bg-white p-6 text-black font-sans text-xs">
        <div className="flex justify-between items-center pb-2 mb-2 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <img src="/tiba-scan.jpg" alt="Tiba Scan" className="h-11 w-auto object-contain" />
            <div className="text-right">
              <h2 className="text-sm font-bold">Tiba Scan Radiology Center</h2>
              <h3 className="text-xs font-bold">مركز طيبة سكان للأشعة</h3>
            </div>
          </div>
          <div className="text-left font-mono font-bold">
            <div className="border border-black px-2 py-0.5 text-xs">TRC.ACT</div>
            <p className="text-[10px] mt-0.5">Page 1 of 2</p>
          </div>
        </div>

        <div className="text-center py-1.5 bg-slate-200 border border-black font-bold text-sm mb-3">
          نقل مريض / Patient Transfer
        </div>

        {/* Transfer Header Grid */}
        <div className="border border-black p-2.5 mb-3 space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <div>اسم المريض رباعي: <span className="underline font-bold">{patientName || "..................................................."}</span></div>
            <div>رقم الملف الطبي: <span className="underline font-bold font-mono">{mrn || "......................."}</span></div>
          </div>
          <div className="flex justify-between pt-1">
            <div>Date of Transfer: <span className="underline">{transferDate}</span></div>
            <div>Time الوقت: <span className="underline">{transferTime} ({transferPeriod})</span></div>
            <div>From من: <span className="underline">{fromLocation || "................."}</span> إلى To: <span className="underline">{toLocation || "................."}</span></div>
          </div>
          <div>سبب النقل: <span className="underline">{transferReason || "...................................................................................................."}</span></div>
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
                <td className="border border-black p-1 font-bold">{totalRstpScore <= 2 ? "✓" : ""}</td>
                <td className="border border-black p-1">0–2</td>
                <td className="border border-black p-1">0</td>
                <td className="border border-black p-1">Wheelchair – Walking (كرسي متحرك – مشي)</td>
                <td className="border border-black p-1">Nurse Aid (مساعد تمريض)</td>
                <td className="border border-black p-1">NA (غير مطبق)</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold">{totalRstpScore >= 3 && totalRstpScore <= 6 ? "✓" : ""}</td>
                <td className="border border-black p-1">3–6</td>
                <td className="border border-black p-1">I</td>
                <td className="border border-black p-1">Bed – Trolley (سرير – حامل متحرك)</td>
                <td className="border border-black p-1">Nurse Aid, Nurse (مساعد تمريض - ممرضة)</td>
                <td className="border border-black p-1">Applicable (مطبق)</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold">{totalRstpScore > 6 ? "✓" : ""}</td>
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
          <div className="font-bold underline mb-1">معدل الخطر عند نقل المريض (RSTP Score: {totalRstpScore}):</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {RSTP_PARAMETERS.map((p) => (
              <div key={p.id} className="border border-black p-1 flex justify-between">
                <span>{p.title_ar} ({p.title_en})</span>
                <span className="font-bold">+{scores[p.id] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {transferInstructions && (
          <div className="border border-black p-2 mb-3 text-[10px]">
            <div className="font-bold underline mb-1">تعليمات النقل:</div>
            <p>{transferInstructions}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-black text-[11px] font-bold">
          <div>
            توقيع الممرض/ة المحول له: <span className="font-normal underline">{receivingNurseSignature || "...................."}</span>
          </div>
          <div>
            توقيع الطبيب المستلم: <span className="font-normal underline">{receivingPhysicianSignature || "...................."}</span>
          </div>
          <div>التاريخ: {transferDate}</div>
          <div>الوقت: {transferTime}</div>
        </div>

        <div className="text-center text-[10px] font-mono text-slate-500 mt-4 pt-1 border-t border-slate-300">
          TRC.ACT
        </div>
      </div>
    </div>
  );
}

export default function PatientTransferPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">جاري التحميل...</div>}>
      <PatientTransferContent />
    </Suspense>
  );
}
