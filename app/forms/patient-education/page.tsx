"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  HeartPulse,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Search,
  PlusCircle,
  RefreshCw,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import FormSubmitButton from "@/components/FormSubmitButton";
import { findPatientByMrn } from "@/lib/numberUtils";

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

const CORE_PDF_TOPICS = [
  "تعليمات تحضير المريض للفحص",
  "بالنسبة للسيدات: التنبيه علي السيدة بضرورة الإفصاح لطبيب الأشعة أو فني الأشعة إذا كانت حامل أو تخطط للحمل خلال ال 3 أشهر القادمة أو في مرحلة الرضاعة.",
  "تثقيف المريض/ ذويه علي مخاطر السقوط",
  "تثقيف السيدات علي المخاطر المحتملة للتصوير التشخيصي الذي ستخضع له السيدة علي صحة الطفل اثناء الحمل أو الرضاعة.",
  "بالنسبة للتصوير بالصبغة: تثقيف المريض علي المخاطر المحتملة للتصوير التشخيصي بالصبغة.",
  "تثقيف المريض علي تعليمات ما بعد الإجراء.",
];

interface TopicItem {
  id: string;
  topic_name: string;
  custom_text: string;
  educator_name: string;
  is_comprehended: boolean | null;
  reeducation_required: boolean;
  is_custom: boolean;
}

function PatientEducationContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const mrnInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<any | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [editAssessmentId, setEditAssessmentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Patient Header - ALL REQUIRED
  const [mrn, setMrn] = useState("");
  const [patientName, setPatientName] = useState("");
  const [procedureName, setProcedureName] = useState("");
  const [procedureLocation, setProcedureLocation] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);

  // Initial Assessment - ALL REQUIRED
  const [educationLevel, setEducationLevel] = useState<string | null>(null);
  const [learningReceptivity, setLearningReceptivity] = useState<string | null>(null);
  const [barriers, setBarriers] = useState<string[]>([]);
  const [targetRecipient, setTargetRecipient] = useState<string | null>(null);
  
  // Single choice for education method
  const [educationMethod, setEducationMethod] = useState<string | null>(null);
  const [otherMethodText, setOtherMethodText] = useState("");

  // Topics Table State: 6 core topics + customizable other topics
  const [topics, setTopics] = useState<TopicItem[]>([
    ...CORE_PDF_TOPICS.map((t, idx) => ({
      id: `core_${idx}`,
      topic_name: t,
      custom_text: "",
      educator_name: "",
      is_comprehended: null as boolean | null,
      reeducation_required: false,
      is_custom: false,
    })),
    {
      id: `custom_${Date.now()}`,
      topic_name: "تثقيف آخر:",
      custom_text: "",
      educator_name: "",
      is_comprehended: null as boolean | null,
      reeducation_required: false,
      is_custom: true,
    },
  ]);

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
        .from("health_education_assessments")
        .select("*, patients(id, full_name, mrn), health_education_topic_entries(*)")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setEditAssessmentId(data.id);
        setPatientId(data.patient_id);
        setPatientName(data.patients?.full_name || "");
        setMrn(data.patients?.mrn || "");
        setProcedureName(data.procedure_name || "");
        setProcedureLocation(data.procedure_location || "");
        setEducationLevel(data.education_level || null);
        setLearningReceptivity(data.learning_receptivity || null);
        setBarriers(data.barriers || []);
        setTargetRecipient(data.target_recipient || null);

        // Parse education_method
        const methodArr = data.education_method || [];
        if (methodArr.length > 0) {
          const firstMethod = methodArr[0];
          if (firstMethod.startsWith("أخري (") || firstMethod.startsWith("أخرى (")) {
            setEducationMethod("أخري (أذكر)");
            const match = firstMethod.match(/أخر[ىي]\s*\((.*)\)/);
            if (match && match[1]) setOtherMethodText(match[1]);
          } else {
            setEducationMethod(firstMethod);
          }
        }

        // Map topic entries
        if (data.health_education_topic_entries && data.health_education_topic_entries.length > 0) {
          const entryMap: { [key: string]: any } = {};
          const customEntries: any[] = [];

          data.health_education_topic_entries.forEach((entry: any) => {
            if (CORE_PDF_TOPICS.includes(entry.topic_name)) {
              entryMap[entry.topic_name] = entry;
            } else {
              customEntries.push(entry);
            }
          });

          const coreMapped: TopicItem[] = CORE_PDF_TOPICS.map((t, idx) => {
            const found = entryMap[t];
            return {
              id: found?.id || `core_${idx}`,
              topic_name: t,
              custom_text: "",
              educator_name: found?.educator_name || "",
              is_comprehended: found !== undefined ? found.is_comprehended : null,
              reeducation_required: found?.reeducation_required || false,
              is_custom: false,
            };
          });

          const customMapped: TopicItem[] = customEntries.map((c, idx) => {
            const extractedText = c.topic_name
              .replace(/^تثقيف\s+آخر\s*[:：]?\s*/, "")
              .trim();
            return {
              id: c.id || `custom_${idx}`,
              topic_name: c.topic_name,
              custom_text: extractedText,
              educator_name: c.educator_name || "",
              is_comprehended: c.is_comprehended,
              reeducation_required: c.reeducation_required || false,
              is_custom: true,
            };
          });

          if (customMapped.length === 0) {
            customMapped.push({
              id: `custom_${Date.now()}`,
              topic_name: "تثقيف آخر:",
              custom_text: "",
              educator_name: "",
              is_comprehended: null,
              reeducation_required: false,
              is_custom: true,
            });
          }

          setTopics([...coreMapped, ...customMapped]);
        }
        setIsLocked(false);
      }
    } catch (err: any) {
      setErrorMsg("تعذر تحميل بيانات السجل للتعديل: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAddCustomTopic() {
    if (isLocked) return;
    setTopics((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        topic_name: "تثقيف آخر:",
        custom_text: "",
        educator_name: "",
        is_comprehended: null,
        reeducation_required: false,
        is_custom: true,
      },
    ]);
  }

  function handleRemoveCustomTopic(id: string) {
    if (isLocked) return;
    setTopics((prev) => prev.filter((t) => t.id !== id));
  }

  async function searchPatientByMrn(searchMrn: string) {
    if (!searchMrn.trim()) return;
    try {
      const data = await findPatientByMrn(supabase, searchMrn);

      if (data) {
        setPatientId(data.id);
        setPatientName(data.full_name || "");
      }
    } catch (err) {}
  }

  function handleBarrierToggle(val: string) {
    if (isLocked) return;
    setBarriers((prev) => (prev.includes(val) ? prev.filter((b) => b !== val) : [...prev, val]));
  }

  // STRICT VALIDATION
  function validateForm() {
    const errors: { [key: string]: string } = {};
    if (!patientName.trim()) errors.patientName = "اسم المريض رباعي مطلوب";
    if (!mrn.trim()) errors.mrn = "رقم الملف الطبي مطلوب";
    if (!procedureName.trim()) errors.procedureName = "الإجراء مطلوب";
    if (!procedureLocation.trim()) errors.procedureLocation = "مكان الإجراء مطلوب";
    if (!educationLevel) errors.educationLevel = "يرجى تحديد المستوى التعليمي للمريض";
    if (!learningReceptivity) errors.learningReceptivity = "يرجى تحديد القابلية للتعلم";
    if (!targetRecipient) errors.targetRecipient = "يرجى تحديد جهة تقديم التثقيف (المريض أم الأسرة)";
    if (!educationMethod) errors.educationMethod = "يرجى تحديد طريقة التثقيف (اختيار واحد)";
    if (educationMethod === "أخري (أذكر)" && !otherMethodText.trim()) {
      errors.otherMethodText = "يرجى كتابة طريقة التثقيف في خانة (أذكر)";
    }

    // Validate 6 core topics
    const coreTopics = topics.filter((t) => !t.is_custom);
    const unselectedCore = coreTopics.filter((t) => t.is_comprehended === null);
    if (unselectedCore.length > 0) {
      errors.topicsComprehension = `يرجى تحديد (نعم أو لا) لكافة المواضيع التثقيفية الأساسية (${unselectedCore.length} متبقية).`;
    }

    const unsignedCore = coreTopics.filter((t) => !t.educator_name.trim());
    if (unsignedCore.length > 0) {
      errors.topicsSignature = `يرجى كتابة توقيع القائم بالتثقيف لكافة المواضيع التثقيفية الأساسية.`;
    }

    // Validate all custom topics
    const customTopics = topics.filter((t) => t.is_custom);
    customTopics.forEach((ct, idx) => {
      const hasText = ct.custom_text.trim().length > 0;
      const hasSig = ct.educator_name.trim().length > 0;
      const hasComp = ct.is_comprehended !== null;

      if (hasText || hasSig || hasComp) {
        if (!hasText) {
          errors.customOtherTopic = `يرجى كتابة نص التثقيف الإضافي في البند رقم (${6 + idx + 1}).`;
        }
        if (!hasSig) {
          errors.topicsSignature = (errors.topicsSignature ? errors.topicsSignature + " • " : "") + `يرجى توقيع القائم بالتثقيف للبند رقم (${6 + idx + 1}).`;
        }
        if (!hasComp) {
          errors.topicsComprehension = (errors.topicsComprehension ? errors.topicsComprehension + " • " : "") + `يرجى تحديد الاستيعاب (نعم/لا) للبند رقم (${6 + idx + 1}).`;
        }
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!validateForm()) {
      setErrorMsg("يرجى استكمال البيانات الإجبارية الموضحة باللون الأحمر وتحديد الاستيعاب والتوقيع للمواضيع التثقيفية.");
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
            .update({ full_name: patientName.trim() })
            .eq("id", currentPid);
        } else {
          const { data: newPatient, error: pErr } = await supabase
            .from("patients")
            .upsert({ mrn: mrn.trim(), full_name: patientName.trim() }, { onConflict: "mrn" })
            .select()
            .single();

          if (pErr) throw new Error(`خطأ بيانات المريض: ${pErr.message}`);
          currentPid = newPatient.id;
          setPatientId(currentPid);
        }
      } else {
        await supabase
          .from("patients")
          .update({ full_name: patientName.trim(), mrn: mrn.trim() })
          .eq("id", currentPid);
      }

      const finalMethodString =
        educationMethod === "أخري (أذكر)" && otherMethodText.trim()
          ? `أخري (${otherMethodText.trim()})`
          : educationMethod;

      // Filter out empty custom rows that were never filled
      const processedTopics = topics
        .filter((t) => !t.is_custom || t.custom_text.trim().length > 0)
        .map((t) => {
          if (t.is_custom) {
            return {
              ...t,
              topic_name: `تثقيف آخر: ${t.custom_text.trim()}`,
            };
          }
          return t;
        });

      if (editAssessmentId) {
        // UPDATE EXISTING ASSESSMENT
        const { error: aUpdateErr } = await supabase
          .from("health_education_assessments")
          .update({
            procedure_name: procedureName,
            procedure_location: procedureLocation,
            education_level: educationLevel,
            learning_receptivity: learningReceptivity,
            barriers,
            target_recipient: targetRecipient,
            education_method: finalMethodString ? [finalMethodString] : [],
          })
          .eq("id", editAssessmentId);

        if (aUpdateErr) throw new Error(`خطأ تحديث التقييم: ${aUpdateErr.message}`);

        // Delete old topics and insert fresh topic entries
        await supabase
          .from("health_education_topic_entries")
          .delete()
          .eq("assessment_id", editAssessmentId);

        const topicRows = processedTopics.map((t) => ({
          assessment_id: editAssessmentId,
          topic_name: t.topic_name,
          educator_name: t.educator_name || "مسؤول التثقيف",
          is_comprehended: t.is_comprehended === true,
          reeducation_required: t.reeducation_required,
        }));

        const { error: tErr } = await supabase
          .from("health_education_topic_entries")
          .insert(topicRows);

        if (tErr) throw new Error(`خطأ مواضيع التثقيف: ${tErr.message}`);

        playSuccessSound();
        setLastSavedRecord({
          id: editAssessmentId,
          patientName,
          mrn,
        });
        setIsLocked(true);
      } else {
        // INSERT NEW ASSESSMENT
        const { data: template } = await supabase
          .from("form_templates")
          .select("id")
          .eq("code", "TRC_MRS_EDU")
          .single();

        const submissionPayload = {
          mrn,
          patient_name: patientName,
          procedure_name: procedureName,
          procedure_location: procedureLocation,
          education_level: educationLevel,
          learning_receptivity: learningReceptivity,
          barriers,
          target_recipient: targetRecipient,
          education_method: finalMethodString ? [finalMethodString] : [],
          other_method_text: otherMethodText.trim() || null,
          topics: processedTopics,
        };

        let submissionId = null;
        if (template) {
          const { data: subData, error: subErr } = await supabase
            .from("form_submissions")
            .insert({
              patient_id: currentPid,
              template_id: template.id,
              data: submissionPayload,
            })
            .select()
            .single();
          if (subErr) throw new Error(`خطأ تقديم النموذج: ${subErr.message}`);
          if (subData) submissionId = subData.id;
        }

        const { data: assessment, error: aErr } = await supabase
          .from("health_education_assessments")
          .insert({
            submission_id: submissionId,
            patient_id: currentPid,
            procedure_name: procedureName,
            procedure_location: procedureLocation,
            education_level: educationLevel,
            learning_receptivity: learningReceptivity,
            barriers,
            target_recipient: targetRecipient,
            education_method: finalMethodString ? [finalMethodString] : [],
          })
          .select()
          .single();

        if (aErr) throw new Error(`خطأ تقييم التثقيف: ${aErr.message}`);

        if (assessment && processedTopics.length > 0) {
          const topicRows = processedTopics.map((t) => ({
            assessment_id: assessment.id,
            topic_name: t.topic_name,
            educator_name: t.educator_name || "مسؤول التثقيف",
            is_comprehended: t.is_comprehended === true,
            reeducation_required: t.reeducation_required,
          }));

          const { error: tErr } = await supabase
            .from("health_education_topic_entries")
            .insert(topicRows);

          if (tErr) throw new Error(`خطأ مواضيع التثقيف: ${tErr.message}`);
        }

        playSuccessSound();
        setEditAssessmentId(assessment?.id || submissionId);
        setLastSavedRecord({
          id: assessment?.id || submissionId,
          patientName,
          mrn,
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
    setEditAssessmentId(null);
    setMrn("");
    setPatientName("");
    setPatientId(null);
    setProcedureName("");
    setProcedureLocation("");
    setEducationLevel(null);
    setLearningReceptivity(null);
    setBarriers([]);
    setTargetRecipient(null);
    setEducationMethod(null);
    setOtherMethodText("");
    setTopics([
      ...CORE_PDF_TOPICS.map((t, idx) => ({
        id: `core_${idx}`,
        topic_name: t,
        custom_text: "",
        educator_name: "",
        is_comprehended: null,
        reeducation_required: false,
        is_custom: false,
      })),
      {
        id: `custom_${Date.now()}`,
        topic_name: "تثقيف آخر:",
        custom_text: "",
        educator_name: "",
        is_comprehended: null,
        reeducation_required: false,
        is_custom: true,
      },
    ]);
    setFieldErrors({});
    setErrorMsg("");
    setTimeout(() => mrnInputRef.current?.focus(), 50);
  }

  function handleUnlockForEdit() {
    setIsLocked(false);
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
                نموذج التثقيف الصحي للمريض والأسرة
              </h2>
              <span className="bg-purple-50 text-purple-900 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-purple-200">
                TRC.MRS
              </span>
            </div>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • Tiba Scan Radiology Center</p>
          </div>
        </div>

        {editAssessmentId && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
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
                  placeholder="رقم الملف الطبي..."
                  className={`w-full pl-9 pr-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm font-mono transition-all ${
                    isLocked
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : fieldErrors.mrn
                      ? "border-rose-400 bg-rose-50/40"
                      : "border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                    : "border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                }`}
              />
              {fieldErrors.patientName && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.patientName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الإجراء <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                placeholder="الإجراء..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.procedureName
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                }`}
              />
              {fieldErrors.procedureName && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.procedureName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                مكان الإجراء <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={procedureLocation}
                onChange={(e) => setProcedureLocation(e.target.value)}
                placeholder="مكان الإجراء..."
                className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                  isLocked
                    ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                    : fieldErrors.procedureLocation
                    ? "border-rose-400 bg-rose-50/40"
                    : "border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                }`}
              />
              {fieldErrors.procedureLocation && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.procedureLocation}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: Initial Needs Assessment */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              تقييم مبدئي للاحتياجات التعليمية للمريض / الأسرة:
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Education Level */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 ${
                fieldErrors.educationLevel ? "bg-rose-50/50 border-rose-300" : "bg-slate-50 border-slate-200"
              }`}
            >
              <label className="block text-xs font-bold text-slate-800">
                التعليم : <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {["مؤهل عالي", "مؤهل متوسط", "يقرأ ويكتب", "أمي"].map((opt) => {
                  const isSelected = educationLevel === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setEducationLevel(opt)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-white bg-white" : "border-slate-400"
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.educationLevel && (
                <p className="text-[10px] text-rose-600 font-medium">{fieldErrors.educationLevel}</p>
              )}
            </div>

            {/* Receptivity */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 ${
                fieldErrors.learningReceptivity
                  ? "bg-rose-50/50 border-rose-300"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <label className="block text-xs font-bold text-slate-800">
                القابلية للتعلم : <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {["يريد ويستجيب", "لا يريد ولا يستجيب"].map((opt) => {
                  const isSelected = learningReceptivity === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setLearningReceptivity(opt)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-white bg-white" : "border-slate-400"
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.learningReceptivity && (
                <p className="text-[10px] text-rose-600 font-medium">{fieldErrors.learningReceptivity}</p>
              )}
            </div>

            {/* Barriers */}
            <div className="md:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                عوائق التثقيف:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: "عضوي", label: "عضوي (السمع ، الكلام ، أخري)" },
                  { id: "معرفي", label: "معرفي (مستوي الذكاء ، الاستيعاب)" },
                ].map((item) => {
                  const isChecked = barriers.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleBarrierToggle(item.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isChecked
                          ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="accent-emerald-600 w-3.5 h-3.5 rounded pointer-events-none"
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 ${
                fieldErrors.targetRecipient ? "bg-rose-50/50 border-rose-300" : "bg-slate-50 border-slate-200"
              }`}
            >
              <label className="block text-xs font-bold text-slate-800">
                بناءا علي المعوقات السابقة سيتم تقديم التثقيف ل : <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                {["المريض", "الأسرة"].map((target) => {
                  const isSelected = targetRecipient === target;
                  return (
                    <button
                      key={target}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setTargetRecipient(target)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-white bg-white" : "border-slate-400"
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>}
                      </span>
                      <span>{target}</span>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.targetRecipient && (
                <p className="text-[10px] text-rose-600 font-medium">{fieldErrors.targetRecipient}</p>
              )}
            </div>

            {/* Method - STRICTLY ONE CHOICE */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 ${
                fieldErrors.educationMethod ? "bg-rose-50/50 border-rose-300" : "bg-slate-50 border-slate-200"
              }`}
            >
              <label className="block text-xs font-bold text-slate-800">
                طريقة التثقيف: <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {["شفهية", "مكتوبة", "أخري (أذكر)"].map((method) => {
                  const isSelected = educationMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setEducationMethod(method)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-white bg-white" : "border-slate-400"
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>}
                      </span>
                      <span>{method}</span>
                    </button>
                  );
                })}
              </div>
              {educationMethod === "أخري (أذكر)" && (
                <input
                  type="text"
                  disabled={isLocked}
                  value={otherMethodText}
                  onChange={(e) => setOtherMethodText(e.target.value)}
                  placeholder="أذكر طريقة التثقيف..."
                  className={`w-full mt-1.5 px-3 py-1.5 border rounded-lg text-xs outline-none ${
                    isLocked
                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                      : fieldErrors.otherMethodText
                      ? "border-rose-400 bg-rose-50/30"
                      : "bg-white border-slate-300 focus:border-emerald-500"
                  }`}
                />
              )}
              {fieldErrors.educationMethod && (
                <p className="text-[10px] text-rose-600 font-medium">{fieldErrors.educationMethod}</p>
              )}
              {fieldErrors.otherMethodText && (
                <p className="text-[10px] text-rose-600 font-medium">{fieldErrors.otherMethodText}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: Checklist matching PDF with dynamic additional topics */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800">
              المواضيع التثقيفية المنفذة
            </h3>
            {!isLocked && (
              <button
                type="button"
                onClick={handleAddCustomTopic}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة موضوع تثقيف آخر</span>
              </button>
            )}
          </div>

          {fieldErrors.topicsComprehension && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{fieldErrors.topicsComprehension}</span>
            </div>
          )}

          {fieldErrors.topicsSignature && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{fieldErrors.topicsSignature}</span>
            </div>
          )}

          {fieldErrors.customOtherTopic && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{fieldErrors.customOtherTopic}</span>
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-right text-xs min-w-[640px]">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3">الموضوع التثقيفي</th>
                  <th className="p-3 w-40">توقيع القائم بالتثقيف *</th>
                  <th className="p-3 w-36 text-center">استيعاب التثقيف (نعم / لا) *</th>
                  <th className="p-3 w-24 text-center">إعادة التثقيف</th>
                  {!isLocked && <th className="p-3 w-12 text-center">حذف</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {topics.map((t, idx) => {
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>

                      <td className="p-3 font-semibold text-slate-800 leading-relaxed">
                        {t.is_custom ? (
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 font-bold text-slate-800">تثقيف آخر:</span>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={t.custom_text}
                              onChange={(e) => {
                                const updated = [...topics];
                                updated[idx].custom_text = e.target.value;
                                setTopics(updated);
                              }}
                              placeholder="اكتب موضوع التثقيف الإضافي هنا..."
                              className={`flex-1 px-3 py-1.5 border rounded-lg text-xs font-normal outline-none transition-all ${
                                isLocked
                                  ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                                  : "border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 bg-emerald-50/20"
                              }`}
                            />
                          </div>
                        ) : (
                          t.topic_name
                        )}
                      </td>

                      <td className="p-3">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={t.educator_name}
                          onChange={(e) => {
                            const updated = [...topics];
                            updated[idx].educator_name = e.target.value;
                            setTopics(updated);
                          }}
                          placeholder="توقيع القائم بالتثقيف..."
                          className={`w-full px-2.5 py-1 border rounded-lg text-xs outline-none ${
                            isLocked
                              ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                              : "border-slate-200 focus:border-emerald-500 bg-white"
                          }`}
                        />
                      </td>

                      {/* Radio for comprehension */}
                      <td className="p-3 text-center">
                        <div className={`inline-flex items-center gap-1.5 p-1 rounded-lg border ${
                          t.is_comprehended === null && fieldErrors.topicsComprehension && (!t.is_custom || t.custom_text.trim()) ? "border-rose-300 bg-rose-50/40" : "border-slate-200 bg-white"
                        }`}>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => {
                              const updated = [...topics];
                              updated[idx].is_comprehended = true;
                              setTopics(updated);
                            }}
                            className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                              t.is_comprehended === true
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-slate-600 hover:bg-slate-100"
                            } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                          >
                            نعم
                          </button>

                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => {
                              const updated = [...topics];
                              updated[idx].is_comprehended = false;
                              setTopics(updated);
                            }}
                            className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                              t.is_comprehended === false
                                ? "bg-rose-600 text-white shadow-xs"
                                : "text-slate-600 hover:bg-slate-100"
                            } ${isLocked ? "cursor-not-allowed opacity-80" : ""}`}
                          >
                            لا
                          </button>
                        </div>
                      </td>

                      {/* Re-education */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={t.reeducation_required}
                          onChange={(e) => {
                            const updated = [...topics];
                            updated[idx].reeducation_required = e.target.checked;
                            setTopics(updated);
                          }}
                          className="accent-emerald-600 w-3.5 h-3.5 rounded cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Delete Custom Row Button */}
                      {!isLocked && (
                        <td className="p-3 text-center">
                          {t.is_custom ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomTopic(t.id)}
                              className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors"
                              title="حذف هذا البند"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* BOTTOM ACTION AREA */}
        {!isLocked ? (
          <FormSubmitButton
            loading={loading}
            isLocked={isLocked}
            fieldErrors={fieldErrors}
            defaultText="حفظ وتوثيق كشف التثقيف الصحي"
            editText="حفظ وتوثيق التعديلات"
            isEdit={!!editAssessmentId}
            shakeTrigger={shakeTrigger}
          />
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

      {/* Print View Sheet (100% Matching نموذج_التثقيف_الصحي_للمريض_والأسرة.pdf) */}
      <div className="hidden print:block bg-white p-4 text-black font-sans">
        {/* Top Header */}
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

        {/* Patient and MRN Line */}
        <div className="flex justify-between items-center text-xs font-bold py-2 mb-2 border-b border-black">
          <div>
            اسم المريض رباعي :{" "}
            <span className="font-normal underline mr-1">
              {patientName || "................................................................"}
            </span>
          </div>
          <div>
            رقم الملف الطبي ..:{" "}
            <span className="font-normal underline mr-1">
              {mrn || "........................................................."}
            </span>
          </div>
        </div>

        {/* Title Banner */}
        <div className="text-center py-1.5 bg-slate-200 border border-black font-bold text-sm mb-3">
          نموذج التثقيف الصحي للمريض والأسرة
        </div>

        {/* Procedure & Location */}
        <div className="flex justify-between items-center text-xs font-bold mb-3">
          <div>
            الإجراء:{" "}
            <span className="font-normal underline mr-1">
              {procedureName || "........................................................"}
            </span>
          </div>
          <div>
            مكان الإجراء:{" "}
            <span className="font-normal underline mr-1">
              {procedureLocation || "........................................................................."}
            </span>
          </div>
        </div>

        {/* Initial Assessment Checklist Text */}
        <div className="border border-black p-2.5 mb-3 text-[11px] space-y-1.5 leading-relaxed">
          <div className="font-bold underline mb-1">
            تقييم مبدئي للاحتياجات التعليمية للمريض / الأسرة:
          </div>
          <div>
            <strong>التعليم :</strong>{" "}
            {["مؤهل عالي", "مؤهل متوسط", "يقرأ ويكتب", "أمي"].map((opt) => (
              <span key={opt} className="ml-3">
                {educationLevel === opt ? "■" : "□"} {opt}
              </span>
            ))}
          </div>
          <div>
            <strong>القابلية للتعلم :</strong>{" "}
            {["يريد ويستجيب", "لا يريد ولا يستجيب"].map((opt) => (
              <span key={opt} className="ml-3">
                {learningReceptivity === opt ? "■" : "□"} {opt}
              </span>
            ))}
          </div>
          <div>
            <strong>عوائق التثقيف:</strong>{" "}
            <span className="ml-3">{barriers.includes("عضوي") ? "■" : "□"} عضوي (السمع ، الكلام ، أخري)</span>
            <span className="ml-3">{barriers.includes("معرفي") ? "■" : "□"} معرفي (مستوي الذكاء ، الاستيعاب)</span>
          </div>
          <div>
            <strong>بناءا علي المعوقات السابقة سيتم تقديم التثقيف ل :</strong>{" "}
            <span className="ml-3">{targetRecipient === "المريض" ? "■" : "□"} المريض</span>
            <span className="ml-3">{targetRecipient === "الأسرة" ? "■" : "□"} الأسرة</span>
          </div>
          <div>
            <strong>طريقة التثقيف:</strong>{" "}
            <span className="ml-3">{educationMethod === "شفهية" ? "■" : "□"} شفهية</span>
            <span className="ml-3">{educationMethod === "مكتوبة" ? "■" : "□"} مكتوبة</span>
            <span className="ml-3">
              {educationMethod === "أخري (أذكر)" ? "■" : "□"} أخري (أذكر) : {educationMethod === "أخري (أذكر)" && otherMethodText ? otherMethodText : ".............."}
            </span>
          </div>
        </div>

        {/* Topics Table strictly with matching columns & subheaders */}
        <table className="w-full border-collapse border border-black text-center text-xs">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black">
              <th rowSpan={2} className="border border-black p-1.5 w-20">التاريخ</th>
              <th rowSpan={2} className="border border-black p-1.5">الموضوع التثقيفي</th>
              <th className="border border-black p-1.5 w-32">القائم بالتثقيف</th>
              <th colSpan={3} className="border border-black p-1.5">تقييم عملية التثقيف</th>
            </tr>
            <tr className="bg-slate-100 font-bold border-b border-black text-[11px]">
              <th className="border border-black p-1">توقيع القائم بالتثقيف</th>
              <th className="border border-black p-1 w-12">نعم</th>
              <th className="border border-black p-1 w-12">لا</th>
              <th className="border border-black p-1 w-16">إعادة التثقيف</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t, idx) => {
              return (
                <tr key={idx}>
                  <td className="border border-black p-1.5">{new Date().toLocaleDateString("ar-EG")}</td>
                  <td className="border border-black p-1.5 text-right leading-snug">
                    {t.is_custom ? (
                      <>
                        تثقيف آخر :{" "}
                        <span className="font-normal">
                          {t.custom_text.trim() || (t.topic_name.startsWith("تثقيف آخر") && t.topic_name.replace(/^تثقيف\s+آخر\s*[:：]?\s*/, "").trim()) || "........................................................"}
                        </span>
                      </>
                    ) : (
                      t.topic_name
                    )}
                  </td>
                  <td className="border border-black p-1.5">{t.educator_name || ""}</td>
                  <td className="border border-black p-1.5 font-bold">{t.is_comprehended === true ? "✓" : ""}</td>
                  <td className="border border-black p-1.5 font-bold">{t.is_comprehended === false ? "✓" : ""}</td>
                  <td className="border border-black p-1.5">{t.reeducation_required ? "✓" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer TRC.MRS */}
        <div className="text-center text-xs font-mono font-bold mt-8 pt-2 border-t border-black">
          TRC.MRS
        </div>
      </div>
    </div>
  );
}

export default function PatientEducationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">جاري التحميل...</div>}>
      <PatientEducationContent />
    </Suspense>
  );
}
