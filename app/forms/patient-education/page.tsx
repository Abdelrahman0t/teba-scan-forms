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
  Lock,
  RotateCcw,
  Loader2,
  AlertCircle,
  Info as InfoIcon,
} from "lucide-react";
import FormSubmitButton from "@/components/FormSubmitButton";
import FormRoleGuard from "@/components/FormRoleGuard";
import { findPatientByMrn } from "@/lib/numberUtils";
import { useUser } from "@/lib/supabase/auth";
import { notifyFormSubmission } from "@/lib/syncEvents";
import { getFormStatusInfo } from "@/lib/formStatus";

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
  const latestSearchMrnRef = useRef("");

  const [loading, setLoading] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<any | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [editAssessmentId, setEditAssessmentId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  const [searchMrnInput, setSearchMrnInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState<{
    type: "idle" | "loading" | "success" | "warning" | "error" | "info";
    message: string;
  } | null>(null);

  function handleResetSearch() {
    setEditAssessmentId(null);
    setSearchMrnInput("");
    setSearchStatus(null);
    clearPatientFields();
    setProcedureName("");
    setProcedureLocation("");
    setEducationLevel(null);
    setLearningReceptivity(null);
    setBarriers([]);
    setBarrierType(null);
    setOrganicSubtype(null);
    setOrganicOtherText("");
    setTargetRecipient(null);
    setEducationMethod(null);
    setOtherMethodText("");
    setIsLocked(false);
  }

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
  const [barrierType, setBarrierType] = useState<"عضوي" | "معرفي" | null>(null);
  const [organicSubtype, setOrganicSubtype] = useState<"سمع" | "كلام" | "أخرى" | null>(null);
  const [organicOtherText, setOrganicOtherText] = useState("");
  const [targetRecipient, setTargetRecipient] = useState<string | null>(null);
  
  // Single choice for education method
  const [educationMethod, setEducationMethod] = useState<string | null>(null);
  const [otherMethodText, setOtherMethodText] = useState("");

  // Sync structured barrier states with barriers array
  useEffect(() => {
    if (barrierType === "معرفي") {
      setBarriers(["معرفي (مستوي الذكاء ، الاستيعاب)"]);
    } else if (barrierType === "عضوي") {
      if (organicSubtype === "سمع") {
        setBarriers(["عضوي (سمع)"]);
      } else if (organicSubtype === "كلام") {
        setBarriers(["عضوي (كلام)"]);
      } else if (organicSubtype === "أخرى") {
        setBarriers([organicOtherText.trim() ? `عضوي (أخرى: ${organicOtherText.trim()})` : "عضوي (أخرى)"]);
      } else {
        setBarriers(["عضوي"]);
      }
    } else {
      setBarriers([]);
    }
  }, [barrierType, organicSubtype, organicOtherText]);

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

  const { profile, role, isAdmin } = useUser();
  const canEditNurse = isAdmin || role === "nurse";
  const canEditTech = isAdmin || role === "technician";
  const isNurseDisabled = isLocked || !canEditNurse;

  // Auto-fill educator name according to user role
  useEffect(() => {
    if (profile?.full_name && !editAssessmentId) {
      setTopics((prev) =>
        prev.map((t, idx) => {
          if (t.educator_name) return t;
          if (role === "nurse" && idx < 3) {
            return { ...t, educator_name: profile.full_name };
          }
          if (role === "technician" && idx >= 3 && idx < 6) {
            return { ...t, educator_name: profile.full_name };
          }
          return t;
        })
      );
    }
  }, [profile?.full_name, role, editAssessmentId]);

  // Load from editId or mrn if present in URL
  useEffect(() => {
    const editId = searchParams.get("editId");
    const mrnParam = searchParams.get("mrn");
    const nameParam = searchParams.get("name");

    if (editId) {
      loadRecordForEdit(editId);
    } else if (mrnParam) {
      setMrn(mrnParam);
      if (nameParam) setPatientName(nameParam);
      searchPatientByMrn(mrnParam);
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
        
        const loadedBarriers: string[] = data.barriers || [];
        setBarriers(loadedBarriers);
        if (loadedBarriers.length > 0) {
          const bStr = loadedBarriers.join(" ");
          if (bStr.includes("معرفي")) {
            setBarrierType("معرفي");
            setOrganicSubtype(null);
            setOrganicOtherText("");
          } else if (bStr.includes("عضوي")) {
            setBarrierType("عضوي");
            if (bStr.includes("سمع")) {
              setOrganicSubtype("سمع");
              setOrganicOtherText("");
            } else if (bStr.includes("كلام")) {
              setOrganicSubtype("كلام");
              setOrganicOtherText("");
            } else if (bStr.includes("أخر") || bStr.includes("أخرى") || bStr.includes("أخري")) {
              setOrganicSubtype("أخرى");
              const match = bStr.match(/أخر[ىي]:?\s*([^)]*)/);
              if (match && match[1]) {
                setOrganicOtherText(match[1].trim());
              } else {
                setOrganicOtherText("");
              }
            } else {
              setOrganicSubtype(null);
              setOrganicOtherText("");
            }
          } else {
            setBarrierType(null);
            setOrganicSubtype(null);
            setOrganicOtherText("");
          }
        } else {
          setBarrierType(null);
          setOrganicSubtype(null);
          setOrganicOtherText("");
        }

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
        setIsLocked(true);
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
        educator_name: profile?.full_name || "",
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

  function clearPatientFields() {
    setPatientId(null);
    setPatientName("");
    setProcedureName("");
    setProcedureLocation("");
  }

  async function searchPatientByMrn(searchMrn: string) {
    const cleanMrn = searchMrn ? searchMrn.trim() : "";
    latestSearchMrnRef.current = cleanMrn;
    const thisSearch = cleanMrn;
    if (editAssessmentId) return;

    if (!cleanMrn) {
      clearPatientFields();
      setSearchStatus(null);
      return;
    }

    // NON-NURSE (Technician, Radiologist, Staff):
    // Cannot create a new education form from scratch; can only complete existing education initiated by nursing!
    if (!canEditNurse) {
      setSearchLoading(true);
      setSearchStatus({ type: "loading", message: "جاري البحث عن نموذج تثقيف غير مكتمل لهذا المريض..." });
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

        // Query all existing education records for this patient
        const { data: educations, error: eErr } = await supabase
          .from("health_education_assessments")
          .select("*, patients(id, full_name, mrn), health_education_topic_entries(*)")
          .eq("patient_id", patient.id)
          .order("created_at", { ascending: false });

        if (latestSearchMrnRef.current !== thisSearch) return;
        if (eErr) throw eErr;

        if (!educations || educations.length === 0) {
          clearPatientFields();
          setSearchStatus({
            type: "warning",
            message: `المريض (${patient.full_name}) ليس لديه أي نموذج تثقيف مسجل من قِبل التمريض بعد. يجب على التمريض إنشاء التثقيف واستكمال بنوده أولاً.`,
          });
          return;
        }

        // Filter for incomplete models only
        const incompleteList = educations.filter((e) => {
          const s = getFormStatusInfo({ ...e, formType: "education" });
          return !s.isComplete;
        });

        if (incompleteList.length === 0) {
          clearPatientFields();
          setSearchStatus({
            type: "info",
            message: `نموذج تثقيف المريض الخاص بالمريض (${patient.full_name}) مكتمل بالفعل وموقع من كافة الأطراف (التمريض وفني الأشعة). لا توجد نماذج غير مكتملة بحاجة إلى استكمال.`,
          });
          return;
        }

        // Target the incomplete education form where technician is missing, or the most recent one
        const target = incompleteList.find((e) => {
          const s = getFormStatusInfo({ ...e, formType: "education" });
          return role ? s.missingRoles.includes(role as any) : true;
        }) || incompleteList[0];

        await loadRecordForEdit(target.id);
        setSearchStatus({
          type: "success",
          message: `تم العثور على نموذج غير مكتمل للمريض (${patient.full_name || cleanMrn}). تم تحميل بيانات التثقيف بنجاح، يمكنك الآن استكمال وتوثيق بنود فني الأشعة (4-6).`,
        });
      } catch (err: any) {
        console.error("searchPatientByMrn error:", err);
        clearPatientFields();
        setSearchStatus({
          type: "error",
          message: `حدث خطأ أثناء البحث: ${err.message || "تعذر إكمال البحث"}`,
        });
      } finally {
        setSearchLoading(false);
      }
      return;
    }

    // NURSE / ADMIN:
    try {
      const data = await findPatientByMrn(supabase, cleanMrn);
      if (latestSearchMrnRef.current !== thisSearch) return;

      if (!data) {
        clearPatientFields();
        return;
      }

      setPatientId(data.id);
      setPatientName(data.full_name || "");

      // Check if patient already has an INCOMPLETE education record to resume
      const { data: educations } = await supabase
        .from("health_education_assessments")
        .select("*, health_education_topic_entries(*)")
        .eq("patient_id", data.id)
        .order("created_at", { ascending: false });

      if (educations && educations.length > 0) {
        const incompleteList = educations.filter((e) => {
          const s = getFormStatusInfo({ ...e, formType: "education" });
          return !s.isComplete;
        });

        // Only load if there is an incomplete education form; never auto-load a completed one!
        if (incompleteList.length > 0) {
          loadRecordForEdit(incompleteList[0].id);
        }
      }
    } catch (err) {}
  }

  function handleBarrierToggle(val: string) {
    if (isLocked) return;
    setBarriers((prev) => (prev.includes(val) ? prev.filter((b) => b !== val) : [...prev, val]));
  }

  // STRICT VALIDATION ACCORDING TO ROLE
  function validateForm() {
    const errors: { [key: string]: string } = {};

    // Header & Initial Assessment are required when Nurse is creating/editing or Admin
    if (canEditNurse || !editAssessmentId) {
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
      if (barrierType === "عضوي") {
        if (!organicSubtype) {
          errors.barriers = "عند اختيار عائق عضوي، يرجى تحديد نوع العائق (سمع، كلام، أو أخرى)";
        } else if (organicSubtype === "أخرى" && !organicOtherText.trim()) {
          errors.organicOtherText = "يرجى كتابة سبب / تفاصيل العائق العضوي الآخر في الخانة المخصصة";
        }
      }
    }

    // Role-based topics validation:
    // Nurse must fill items 1, 2, 3 (indices 0, 1, 2)
    if (role === "nurse") {
      const nurseTopics = topics.slice(0, 3);
      const unselectedNurse = nurseTopics.filter((t) => t.is_comprehended === null);
      if (unselectedNurse.length > 0) {
        errors.topicsComprehension = `يرجى تحديد (نعم أو لا) للمواضيع التثقيفية الخاصة بالتمريض (بنود 1-3). المتبقي: ${unselectedNurse.length}`;
      }
    }

    // Technician must fill items 4, 5, 6 (indices 3, 4, 5)
    if (role === "technician") {
      const techTopics = topics.slice(3, 6);
      const unselectedTech = techTopics.filter((t) => t.is_comprehended === null);
      if (unselectedTech.length > 0) {
        errors.topicsComprehension = `يرجى تحديد (نعم أو لا) للمواضيع التثقيفية الخاصة بفني الأشعة (بنود 4-6). المتبقي: ${unselectedTech.length}`;
      }
    }

    // Admin or when role is not technician/nurse: ensure appropriate topics are filled
    if (isAdmin && role !== "nurse" && role !== "technician") {
      const coreTopics = topics.filter((t) => !t.is_custom);
      const unselected = coreTopics.filter((t) => t.is_comprehended === null);
      if (unselected.length > 3 && !editAssessmentId) {
        errors.topicsComprehension = `يرجى تحديد (نعم أو لا) للمواضيع التثقيفية المنفذة.`;
      }
    }

    // Validate any custom topics that have been partially filled
    const customTopics = topics.filter((t) => t.is_custom);
    customTopics.forEach((ct, idx) => {
      const hasText = ct.custom_text.trim().length > 0;
      const hasComp = ct.is_comprehended !== null;

      if (hasText || hasComp) {
        if (!hasText) {
          errors.customOtherTopic = `يرجى كتابة نص التثقيف الإضافي في البند رقم (${6 + idx + 1}).`;
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

    if (editAssessmentId) {
      setErrorMsg("هذا النموذج معتمد ومسجل مسبقاً ولا يمكن التعديل عليه.");
      return;
    }

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
        .map((t, idx) => {
          let effectiveEducator = t.educator_name;
          if (t.is_comprehended !== null && !effectiveEducator) {
            effectiveEducator = profile?.full_name || "موثق معتمد";
          }
          if (t.is_custom) {
            return {
              ...t,
              topic_name: `تثقيف آخر: ${t.custom_text.trim()}`,
              educator_name: effectiveEducator,
            };
          }
          return {
            ...t,
            educator_name: effectiveEducator,
          };
        });

      if (editAssessmentId) {
        // UPDATE EXISTING ASSESSMENT
        // Only update assessment fields if nurse or admin
        if (canEditNurse) {
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
        }

        // Delete old topics and insert fresh topic entries
        await supabase
          .from("health_education_topic_entries")
          .delete()
          .eq("assessment_id", editAssessmentId);

        // Insert only completed topics
        const completedTopics = processedTopics.filter((t) => t.is_comprehended !== null);

        const topicRows = completedTopics.map((t) => ({
          assessment_id: editAssessmentId,
          topic_name: t.topic_name,
          educator_name: t.educator_name || profile?.full_name || "مسؤول التثقيف",
          is_comprehended: t.is_comprehended === true,
          reeducation_required: t.reeducation_required,
        }));

        if (topicRows.length > 0) {
          const { error: tErr } = await supabase
            .from("health_education_topic_entries")
            .insert(topicRows);

          if (tErr) throw new Error(`خطأ مواضيع التثقيف: ${tErr.message}`);
        }

        playSuccessSound();
        notifyFormSubmission({ formType: "education", patientId: currentPid });
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

        const completedTopics = processedTopics.filter((t) => t.is_comprehended !== null);
        if (assessment && completedTopics.length > 0) {
          const topicRows = completedTopics.map((t) => ({
            assessment_id: assessment.id,
            topic_name: t.topic_name,
            educator_name: t.educator_name || profile?.full_name || "مسؤول التثقيف",
            is_comprehended: t.is_comprehended === true,
            reeducation_required: t.reeducation_required,
          }));

          const { error: tErr } = await supabase
            .from("health_education_topic_entries")
            .insert(topicRows);

          if (tErr) throw new Error(`خطأ مواضيع التثقيف: ${tErr.message}`);
        }

        playSuccessSound();
        notifyFormSubmission({ formType: "education", patientId: currentPid });
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
    setBarrierType(null);
    setOrganicSubtype(null);
    setOrganicOtherText("");
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
          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
            نموذج مسجل ومعتمد (للقراءة والطباعة فقط)
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

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
            e.preventDefault();
          }
        }}
        className="space-y-5 no-print"
      >
        {/* SECTION 1: Patient Details */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className={`text-xs sm:text-sm font-bold ${isNurseDisabled ? "text-slate-500" : "text-slate-800"}`}>
              1. البيانات العامة للمريض والفحص
            </h3>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
              isNurseDisabled ? "bg-slate-200 text-slate-600 border-slate-300" : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              {isNurseDisabled && <Lock className="w-3 h-3" />}
              <span>{isNurseDisabled ? "غير متاح لدورك (خاص بالتمريض)" : "خاص بالتمريض"}</span>
            </span>
          </div>

          {/* EXACT SEARCH BAR AS IN PATIENT-ASSESSMENT WITH FULL OPACITY & CRISP VISIBILITY */}
          {isNurseDisabled && !searchParams.get("editId") && (
            <div className="space-y-3">
              {!editAssessmentId ? (
                <div className="bg-sky-50 border border-sky-300 p-4 rounded-2xl space-y-3 text-xs text-sky-950 shadow-2xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="font-semibold text-sky-950 text-xs sm:text-sm">
                        لتحميل واستكمال نموذج تثقيف مريض غير مكتمل، أدخل رقم الملف الطبي (MRN):
                      </span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        value={searchMrnInput}
                        onChange={(e) => setSearchMrnInput(e.target.value)}
                        placeholder="رقم الملف الطبي..."
                        className="px-3.5 py-2 border border-sky-300 focus:border-sky-500 rounded-xl text-xs bg-white text-slate-900 outline-none w-full sm:w-48 font-mono shadow-2xs font-bold placeholder:text-slate-400"
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
                        className="px-3.5 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
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
                      className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-medium transition-all ${
                        searchStatus.type === "loading"
                          ? "bg-sky-100/80 text-sky-900 border-sky-300"
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
                      <span className="font-semibold">{searchStatus.message}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-extrabold text-emerald-950 flex items-center gap-2">
                        <span>تم تحميل نموذج تثقيف المريض غير المكتمل</span>
                        <span className="font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                          MRN: {mrn}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium">
                        المريض: <strong>{patientName}</strong> {procedureName ? `• الفحص: ${procedureName}` : ""} • يمكنك الآن استكمال وتوثيق بنود فني الأشعة (4-6).
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

          <div className={`space-y-4 transition-all ${isNurseDisabled ? "opacity-45 pointer-events-none select-none" : ""}`}>
            {isNurseDisabled && !editAssessmentId && (
              <div className="p-3 bg-slate-100/80 rounded-xl border border-slate-200 text-slate-500 text-xs flex items-center gap-2 font-medium">
                <InfoIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  البيانات العامة والتقييم المبدئي خاص بالتمريض (للقراءة فقط). يرجى استخدام شريط البحث بالأعلى لاستدعاء المريض واستكمال بنود فني الأشعة (4-6).
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
                  disabled={isNurseDisabled}
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="اسم المريض رباعي..."
                  className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                    isNurseDisabled
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
                  disabled={isNurseDisabled}
                  value={procedureName}
                  onChange={(e) => setProcedureName(e.target.value)}
                  placeholder="الإجراء..."
                  className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                    isNurseDisabled
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
                  disabled={isNurseDisabled}
                  value={procedureLocation}
                  onChange={(e) => setProcedureLocation(e.target.value)}
                  placeholder="مكان الإجراء..."
                  className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-xs sm:text-sm transition-all ${
                    isNurseDisabled
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
        </div>

        {/* SECTION 2: Initial Needs Assessment */}
        <div className={`p-5 sm:p-6 rounded-2xl border shadow-xs space-y-4 transition-all ${
          isNurseDisabled
            ? "bg-slate-50/80 border-slate-200/80 opacity-40 pointer-events-none select-none"
            : "bg-white border-slate-200/80"
        }`}>
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h3 className={`text-xs sm:text-sm font-bold ${isNurseDisabled ? "text-slate-500" : "text-slate-800"}`}>
              تقييم مبدئي للاحتياجات التعليمية للمريض / الأسرة:
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Education Level */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
                fieldErrors.educationLevel
                  ? "bg-rose-50/50 border-rose-300"
                  : isNurseDisabled
                  ? "bg-slate-100/50 border-slate-200/70"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <label className={`block text-xs font-bold ${isNurseDisabled ? "text-slate-500" : "text-slate-800"}`}>
                التعليم : <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {["مؤهل عالي", "مؤهل متوسط", "يقرأ ويكتب", "أمي"].map((opt) => {
                  const isSelected = educationLevel === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isNurseDisabled}
                      onClick={() => setEducationLevel(opt)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? isNurseDisabled
                            ? "bg-slate-300 text-slate-700 border-slate-400 cursor-not-allowed shadow-none font-extrabold"
                            : "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : isNurseDisabled
                          ? "bg-slate-100/40 text-slate-400 border-slate-200/60 cursor-not-allowed"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? isNurseDisabled
                              ? "border-slate-500 bg-slate-500"
                              : "border-white bg-white"
                            : "border-slate-400"
                        }`}
                      >
                        {isSelected && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isNurseDisabled ? "bg-slate-700" : "bg-emerald-600"
                            }`}
                          />
                        )}
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
              className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
                fieldErrors.learningReceptivity
                  ? "bg-rose-50/50 border-rose-300"
                  : isNurseDisabled
                  ? "bg-slate-100/50 border-slate-200/70"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <label className={`block text-xs font-bold ${isNurseDisabled ? "text-slate-500" : "text-slate-800"}`}>
                القابلية للتعلم : <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {["يريد ويستجيب", "لا يريد ولا يستجيب"].map((opt) => {
                  const isSelected = learningReceptivity === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isNurseDisabled}
                      onClick={() => setLearningReceptivity(opt)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? isNurseDisabled
                            ? "bg-slate-300 text-slate-700 border-slate-400 cursor-not-allowed shadow-none font-extrabold"
                            : "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : isNurseDisabled
                          ? "bg-slate-100/40 text-slate-400 border-slate-200/60 cursor-not-allowed"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? isNurseDisabled
                              ? "border-slate-500 bg-slate-500"
                              : "border-white bg-white"
                            : "border-slate-400"
                        }`}
                      >
                        {isSelected && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isNurseDisabled ? "bg-slate-700" : "bg-emerald-600"
                            }`}
                          />
                        )}
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

            {/* Barriers - Single Selection + Organic Sub-options */}
            <div className={`md:col-span-2 p-3.5 rounded-xl border space-y-3 transition-colors ${
              fieldErrors.barriers || fieldErrors.organicOtherText
                ? "bg-rose-50/60 border-rose-300"
                : isNurseDisabled
                ? "bg-slate-100/50 border-slate-200/70"
                : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex items-center justify-between">
                <label className={`block text-xs font-bold ${isNurseDisabled ? "text-slate-500" : "text-slate-800"}`}>
                  عوائق التثقيف: <span className="text-slate-400 font-normal text-[11px]">(اختيار واحد كحد أقصى)</span>
                </label>
                {barrierType && !isNurseDisabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setBarrierType(null);
                      setOrganicSubtype(null);
                      setOrganicOtherText("");
                    }}
                    className="text-[10px] text-slate-400 hover:text-rose-600 underline cursor-pointer"
                  >
                    إلغاء التحديد (لا توجد عوائق)
                  </button>
                )}
              </div>

              {/* Main barrier options (Only one can be chosen) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. عضوي */}
                <button
                  type="button"
                  disabled={isNurseDisabled}
                  onClick={() => {
                    if (isLocked) return;
                    if (barrierType === "عضوي") {
                      setBarrierType(null);
                      setOrganicSubtype(null);
                      setOrganicOtherText("");
                    } else {
                      setBarrierType("عضوي");
                    }
                  }}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border text-right cursor-pointer ${
                    barrierType === "عضوي"
                      ? isNurseDisabled
                        ? "bg-slate-200 text-slate-700 border-slate-300 cursor-not-allowed"
                        : "bg-emerald-50 text-emerald-900 border-emerald-400 shadow-xs ring-1 ring-emerald-300"
                      : isNurseDisabled
                      ? "bg-slate-100/40 text-slate-400 border-slate-200/60 cursor-not-allowed"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      barrierType === "عضوي"
                        ? "border-emerald-600 bg-emerald-600"
                        : "border-slate-300 bg-white"
                    }`}>
                      {barrierType === "عضوي" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span>عضوي (السمع ، الكلام ، أخري)</span>
                  </div>
                </button>

                {/* 2. معرفي */}
                <button
                  type="button"
                  disabled={isNurseDisabled}
                  onClick={() => {
                    if (isLocked) return;
                    if (barrierType === "معرفي") {
                      setBarrierType(null);
                      setOrganicSubtype(null);
                      setOrganicOtherText("");
                    } else {
                      setBarrierType("معرفي");
                      setOrganicSubtype(null);
                      setOrganicOtherText("");
                    }
                  }}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border text-right cursor-pointer ${
                    barrierType === "معرفي"
                      ? isNurseDisabled
                        ? "bg-slate-200 text-slate-700 border-slate-300 cursor-not-allowed"
                        : "bg-emerald-50 text-emerald-900 border-emerald-400 shadow-xs ring-1 ring-emerald-300"
                      : isNurseDisabled
                      ? "bg-slate-100/40 text-slate-400 border-slate-200/60 cursor-not-allowed"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      barrierType === "معرفي"
                        ? "border-emerald-600 bg-emerald-600"
                        : "border-slate-300 bg-white"
                    }`}>
                      {barrierType === "معرفي" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span>معرفي (مستوي الذكاء ، الاستيعاب)</span>
                  </div>
                </button>
              </div>

              {/* Sub-options when عضوي is selected */}
              {barrierType === "عضوي" && (
                <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-3 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      تحديد نوع العائق العضوي:
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">اختر عائق عضوي محدد</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "سمع", label: "سمع" },
                      { id: "كلام", label: "كلام" },
                      { id: "أخرى", label: "أخرى" },
                    ].map((sub) => {
                      const isSubSelected = organicSubtype === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          disabled={isNurseDisabled}
                          onClick={() => {
                            if (isLocked) return;
                            setOrganicSubtype(sub.id as any);
                          }}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                            isSubSelected
                              ? isNurseDisabled
                                ? "bg-slate-200 text-slate-700 border-slate-300 cursor-not-allowed"
                                : "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : isNurseDisabled
                              ? "bg-slate-100/40 text-slate-400 border-slate-200/60 cursor-not-allowed"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSubSelected ? "border-white bg-white" : "border-slate-400 bg-white"
                          }`}>
                            {isSubSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                          </span>
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Input field if أخرى is selected */}
                  {organicSubtype === "أخرى" && (
                    <div className="space-y-1.5 pt-1 animate-in fade-in duration-150">
                      <label className="block text-[11px] font-bold text-emerald-950">
                        اذكر سبب / نوع العائق الآخر بالتفصيل: <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        disabled={isNurseDisabled}
                        value={organicOtherText}
                        onChange={(e) => setOrganicOtherText(e.target.value)}
                        placeholder="اكتب سبب أو نوع العائق العضوي هنا (مثل: ضعف بصر شديد، شلل حركي، إلخ)..."
                        className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 transition-all ${
                          fieldErrors.organicOtherText
                            ? "border-rose-400 focus:ring-rose-300"
                            : "border-emerald-300 focus:ring-emerald-400"
                        } ${isNurseDisabled ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "text-slate-800"}`}
                      />
                      {fieldErrors.organicOtherText && (
                        <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.organicOtherText}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {fieldErrors.barriers && (
                <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.barriers}</p>
              )}
            </div>

            {/* Target */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
                fieldErrors.targetRecipient
                  ? "bg-rose-50/50 border-rose-300"
                  : isNurseDisabled
                  ? "bg-slate-100/50 border-slate-200/70"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <label className={`block text-xs font-bold ${isNurseDisabled ? "text-slate-500" : "text-slate-800"}`}>
                بناءا علي المعوقات السابقة سيتم تقديم التثقيف ل : <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                {["المريض", "الأسرة"].map((target) => {
                  const isSelected = targetRecipient === target;
                  return (
                    <button
                      key={target}
                      type="button"
                      disabled={isNurseDisabled}
                      onClick={() => setTargetRecipient(target)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? isNurseDisabled
                            ? "bg-slate-300 text-slate-700 border-slate-400 cursor-not-allowed shadow-none font-extrabold"
                            : "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : isNurseDisabled
                          ? "bg-slate-100/40 text-slate-400 border-slate-200/60 cursor-not-allowed"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? isNurseDisabled
                              ? "border-slate-500 bg-slate-500"
                              : "border-white bg-white"
                            : "border-slate-400"
                        }`}
                      >
                        {isSelected && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isNurseDisabled ? "bg-slate-700" : "bg-emerald-600"
                            }`}
                          />
                        )}
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
              className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
                fieldErrors.educationMethod
                  ? "bg-rose-50/50 border-rose-300"
                  : isNurseDisabled
                  ? "bg-slate-100/50 border-slate-200/70"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <label className={`block text-xs font-bold ${isNurseDisabled ? "text-slate-500" : "text-slate-800"}`}>
                طريقة التثقيف: <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {["شفهية", "مكتوبة", "أخري (أذكر)"].map((method) => {
                  const isSelected = educationMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      disabled={isNurseDisabled}
                      onClick={() => setEducationMethod(method)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? isNurseDisabled
                            ? "bg-slate-300 text-slate-700 border-slate-400 cursor-not-allowed shadow-none font-extrabold"
                            : "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : isNurseDisabled
                          ? "bg-slate-100/40 text-slate-400 border-slate-200/60 cursor-not-allowed"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? isNurseDisabled
                              ? "border-slate-500 bg-slate-500"
                              : "border-white bg-white"
                            : "border-slate-400"
                        }`}
                      >
                        {isSelected && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isNurseDisabled ? "bg-slate-700" : "bg-emerald-600"
                            }`}
                          />
                        )}
                      </span>
                      <span>{method}</span>
                    </button>
                  );
                })}
              </div>
              {educationMethod === "أخري (أذكر)" && (
                <input
                  type="text"
                  disabled={isNurseDisabled}
                  value={otherMethodText}
                  onChange={(e) => setOtherMethodText(e.target.value)}
                  placeholder="أذكر طريقة التثقيف..."
                  className={`w-full mt-1.5 px-3 py-1.5 border rounded-lg text-xs outline-none ${
                    isNurseDisabled
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
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                المواضيع التثقيفية المنفذة
              </h3>
              <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                بنود 1-3 تمريض • بنود 4-6 فني الأشعة
              </span>
            </div>
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
                  <th className="p-3 w-48">القائم بالتثقيف (معتمد)</th>
                  <th className="p-3 w-36 text-center">استيعاب التثقيف (نعم / لا) *</th>
                  <th className="p-3 w-24 text-center">إعادة التثقيف</th>
                  {!isLocked && <th className="p-3 w-12 text-center">حذف</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {topics.map((t, idx) => {
                  const isNurseItem = idx < 3;
                  const isTechItem = idx >= 3 && idx < 6;
                  const isCustomItem = t.is_custom;

                  const canEditThisRow = !isLocked && (
                    isAdmin ||
                    (isNurseItem && role === "nurse") ||
                    (isTechItem && role === "technician") ||
                    (isCustomItem && (role === "nurse" || role === "technician"))
                  );

                  return (
                    <tr key={t.id} className={`transition-colors ${canEditThisRow ? "hover:bg-slate-50/60" : "bg-slate-50/40 opacity-50 select-none"}`}>
                      <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>

                      <td className="p-3 font-semibold text-slate-800 leading-relaxed">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            {t.is_custom ? (
                              <div className="flex items-center gap-2">
                                <span className="shrink-0 font-bold text-slate-800">تثقيف آخر:</span>
                                <input
                                  type="text"
                                  disabled={!canEditThisRow}
                                  value={t.custom_text}
                                  onChange={(e) => {
                                    const updated = [...topics];
                                    updated[idx].custom_text = e.target.value;
                                    setTopics(updated);
                                  }}
                                  placeholder="اكتب موضوع التثقيف الإضافي هنا..."
                                  className={`flex-1 px-3 py-1.5 border rounded-lg text-xs font-normal outline-none transition-all ${
                                    !canEditThisRow
                                      ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                                      : "border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 bg-emerald-50/20"
                                  }`}
                                />
                              </div>
                            ) : (
                              t.topic_name
                            )}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold self-start shrink-0 border ${
                            isNurseItem
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : isTechItem
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {isNurseItem ? "خاص بالتمريض" : isTechItem ? "خاص بفني الأشعة" : "إضافي"}
                          </span>
                        </div>
                      </td>

                      <td className="p-3">
                        {t.educator_name ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-bold text-[11px] truncate font-mono">
                              {t.educator_name}
                            </span>
                          </div>
                        ) : canEditThisRow ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-[11px]">
                            <span className="font-medium truncate font-mono">{profile?.full_name || "جاري التوثيق..."}</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-[10px] font-bold inline-block">
                            {isNurseItem ? "بانتظار التمريض" : isTechItem ? "بانتظار فني الأشعة" : "غير محدد"}
                          </span>
                        )}
                      </td>

                      {/* Radio for comprehension */}
                      <td className="p-3 text-center">
                        <div className={`inline-flex items-center gap-1.5 p-1 rounded-lg border ${
                          t.is_comprehended === null && fieldErrors.topicsComprehension && canEditThisRow ? "border-rose-300 bg-rose-50/40" : "border-slate-200 bg-white"
                        }`}>
                          <button
                            type="button"
                            disabled={!canEditThisRow}
                            onClick={() => {
                              const updated = [...topics];
                              updated[idx].is_comprehended = true;
                              if (!updated[idx].educator_name || (isNurseItem && role === "nurse") || (isTechItem && role === "technician")) {
                                updated[idx].educator_name = profile?.full_name || updated[idx].educator_name;
                              }
                              setTopics(updated);
                            }}
                            className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                              t.is_comprehended === true
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-slate-600 hover:bg-slate-100"
                            } ${!canEditThisRow ? "cursor-not-allowed opacity-60" : ""}`}
                          >
                            نعم
                          </button>

                          <button
                            type="button"
                            disabled={!canEditThisRow}
                            onClick={() => {
                              const updated = [...topics];
                              updated[idx].is_comprehended = false;
                              if (!updated[idx].educator_name || (isNurseItem && role === "nurse") || (isTechItem && role === "technician")) {
                                updated[idx].educator_name = profile?.full_name || updated[idx].educator_name;
                              }
                              setTopics(updated);
                            }}
                            className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                              t.is_comprehended === false
                                ? "bg-rose-600 text-white shadow-xs"
                                : "text-slate-600 hover:bg-slate-100"
                            } ${!canEditThisRow ? "cursor-not-allowed opacity-60" : ""}`}
                          >
                            لا
                          </button>
                        </div>
                      </td>

                      {/* Re-education */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          disabled={!canEditThisRow}
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
                          {t.is_custom && canEditThisRow ? (
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
            defaultText={
              role === "technician"
                ? "اعتماد وتوثيق بنود فني الأشعة (4-6)"
                : role === "nurse"
                ? "اعتماد وتوثيق بنود التمريض (1-3)"
                : "حفظ وتوثيق كشف التثقيف الصحي"
            }
            editText={
              role === "technician"
                ? "حفظ وتوثيق بنود فني الأشعة (4-6)"
                : role === "nurse"
                ? "حفظ وتوثيق بنود التمريض (1-3)"
                : "حفظ وتوثيق التعديلات"
            }
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
            <span className="ml-3">
              {barrierType === "عضوي" ? "■" : "□"} عضوي (
              {barrierType === "عضوي" && organicSubtype === "سمع" ? "■" : "□"} السمع ،{" "}
              {barrierType === "عضوي" && organicSubtype === "كلام" ? "■" : "□"} الكلام ،{" "}
              {barrierType === "عضوي" && organicSubtype === "أخرى" ? "■" : "□"} أخري
              {barrierType === "عضوي" && organicSubtype === "أخرى" && organicOtherText ? `: ${organicOtherText}` : ""}
              )
            </span>
            <span className="ml-3">
              {barrierType === "معرفي" ? "■" : "□"} معرفي (مستوي الذكاء ، الاستيعاب)
            </span>
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
                  <td className="border border-black p-1.5">{t.educator_name || profile?.full_name || ""}</td>
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
      <FormRoleGuard allowedRoles={["nurse", "technician"]} formTitle="نموذج التثقيف الصحي — TRC.MRS">
        <PatientEducationContent />
      </FormRoleGuard>
    </Suspense>
  );
}
