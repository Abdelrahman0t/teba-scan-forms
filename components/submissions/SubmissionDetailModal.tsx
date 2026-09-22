"use client";

import React from "react";
import {
  X,
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  HeartPulse,
  Baby,
  ClipboardCheck,
  Ambulance,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Stethoscope,
  AlertOctagon,
  Check,
  PenTool,
  ArrowRight,
  AlertCircle,
  Pill,
  Syringe,
  Thermometer,
  Zap,
} from "lucide-react";
import { formatTime12 } from "@/lib/timeUtils";
import { getFormStatusInfo } from "@/lib/formStatus";

interface SubmissionDetailModalProps {
  submission: any | null;
  onClose: () => void;
  effectiveRole?: string;
  effectiveIsAdmin?: boolean;
  role?: any;
  isAdmin?: boolean;
}

export default function SubmissionDetailModal({
  submission,
  onClose,
  effectiveRole,
  effectiveIsAdmin,
  role,
  isAdmin,
}: SubmissionDetailModalProps) {
  if (!submission) return null;

  const currentRole = effectiveRole || role;
  const currentIsAdmin = effectiveIsAdmin ?? isAdmin ?? false;

  const modalStatus = getFormStatusInfo(submission);
  const canCompleteModal =
    !modalStatus.isComplete &&
    (currentIsAdmin || (currentRole && (modalStatus.missingRoles as string[]).includes(currentRole)));

  const editUrl = submission.editUrl || (
    submission.formType === "assessment" ? `/forms/patient-assessment?editId=${submission.id}` :
    submission.formType === "transfer" ? `/forms/patient-transfer?editId=${submission.id}` :
    submission.formType === "education" ? `/forms/patient-education?editId=${submission.id}` :
    `#`
  );

  // Helper for BMI calculation
  const getBmiInfo = (weight?: number | null, height?: number | null) => {
    if (!weight || !height || height <= 0) return null;
    const hM = height / 100;
    const bmi = Number((weight / (hM * hM)).toFixed(1));
    let label = "طبيعي";
    let color = "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (bmi < 18.5) {
      label = "نحافة";
      color = "text-amber-700 bg-amber-50 border-amber-200";
    } else if (bmi >= 25 && bmi < 30) {
      label = "وزن زائد";
      color = "text-amber-700 bg-amber-50 border-amber-200";
    } else if (bmi >= 30) {
      label = "سمنة";
      color = "text-rose-700 bg-rose-50 border-rose-200";
    }
    return { bmi, label, color };
  };

  const bmiData = getBmiInfo(submission.weight_kg, submission.height_cm);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 no-print overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${submission.color || "bg-purple-50 text-purple-700"} shadow-xs`}>
              {submission.icon ? (
                <submission.icon className="w-6 h-6" />
              ) : (
                <FileText className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-900">
                  {submission.formTypeName}
                </h3>
                <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                  {submission.headerCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">مركز طيبة سكان للأشعة • تفاصيل النموذج المعتمد الكاملة</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Status & Action Banner if Incomplete */}
        {!modalStatus.isComplete && (
          <div className="bg-amber-50 border-2 border-amber-300/80 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h5 className="font-extrabold text-amber-950 text-xs sm:text-sm">
                  هذا النموذج مشترك وغير مكتمل بعد
                </h5>
                <p className="text-xs text-amber-800 font-semibold mt-0.5">
                  {modalStatus.badgeDesc}
                </p>
              </div>
            </div>
            {canCompleteModal ? (
              <a
                href={editUrl}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#621c6f] hover:bg-[#481454] text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap animate-pulse hover:animate-none cursor-pointer"
              >
                <PenTool className="w-4 h-4" />
                <span>استكمال دورك وتوثيق النموذج الآن ➔</span>
              </a>
            ) : (
              <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
                بانتظار استكمال باقي الطاقم
              </span>
            )}
          </div>
        )}

        {/* Patient Clinical Profile Card */}
        <div className="bg-gradient-to-l from-slate-50 via-white to-purple-50/30 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#621c6f] to-[#8d2799] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
              <User className="w-6 h-6 text-purple-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded-md">
                  ملف مريض
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {submission.resolvedMrn || submission.mrn ? `#${submission.resolvedMrn || submission.mrn}` : ""}
                </span>
              </div>
              <h4 className="font-extrabold text-slate-900 text-sm sm:text-base mt-0.5">
                {submission.resolvedPatientName || submission.patient_name || submission.full_name || "مريض غير مسجل بالاسم"}
              </h4>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                <span className="inline-flex items-center gap-1">
                  <span className="text-slate-400">الجنس:</span>
                  <strong className="text-slate-800">{submission.resolvedGender || submission.gender || "-"}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <span className="text-slate-400">السن:</span>
                  <strong className="text-slate-800 font-mono">{submission.resolvedAge || submission.age || "-"}</strong>
                  <span>سنة</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-start sm:items-end justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 gap-2">
            <div className="bg-[#2c0b36] text-white px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-xs">
              <FileText className="w-3.5 h-3.5 text-purple-300" />
              <span className="text-xs font-mono font-bold tracking-wider">
                MRN: {submission.resolvedMrn || submission.mrn || "-"}
              </span>
            </div>
            <div className="text-slate-500 text-[11px] flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                تاريخ التسجيل: {submission.created_at ? new Date(submission.created_at).toLocaleDateString("ar-EG") : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FULL DETAILS BY FORM TYPE (EVERY SINGLE DATA POINT DISPLAYED)             */}
        {/* ========================================================================= */}
        <div className="space-y-4 text-xs">
          
          {/* ================= 1. RADIATION EXPOSURE (TRC.MRS) ================= */}
          {submission.formType === "radiation" && (
            <div className="space-y-4">
              <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 space-y-3">
                <h5 className="font-bold text-purple-950 flex items-center gap-2 text-xs">
                  <Activity className="w-4 h-4 text-purple-600" />
                  <span>بيانات الفحص والجرعات الإشعاعية وموقع الإجراء</span>
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-purple-100">
                  <div><span className="text-slate-400 block text-[11px]">اسم الإجراء:</span><strong className="text-slate-900">{submission.procedure_name || "-"}</strong></div>
                  <div><span className="text-slate-400 block text-[11px]">المكان / الجهاز:</span><strong className="text-slate-900">{submission.procedure_location || "قسم الأشعة"}</strong></div>
                  <div><span className="text-slate-400 block text-[11px]">تاريخ الفحص:</span><strong className="text-slate-900 font-mono">{submission.exposure_date || "-"}</strong></div>
                  <div><span className="text-slate-400 block text-[11px]">وقت الفحص:</span><strong className="text-slate-900 font-mono">{formatTime12(submission.exposure_time)}</strong></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 flex justify-between items-center">
                  <div>
                    <span className="text-amber-800 text-[11px] font-bold block">جرعة الفحص الحالية (Current Dose)</span>
                    <h4 className="text-2xl font-extrabold text-amber-950 font-mono mt-1">
                      {submission.radiation_dose || 0} <span className="text-xs font-normal">mGy / DLP</span>
                    </h4>
                  </div>
                  <Activity className="w-8 h-8 text-amber-600/50" />
                </div>

                <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 flex justify-between items-center">
                  <div>
                    <span className="text-indigo-800 text-[11px] font-bold block">الجرعة التراكمية الإجمالية (Cumulative Dose)</span>
                    <h4 className="text-2xl font-extrabold text-indigo-950 font-mono mt-1">
                      {submission.cumulative_dose || 0} <span className="text-xs font-normal">mGy / DLP</span>
                    </h4>
                  </div>
                  <ShieldAlert className="w-8 h-8 text-indigo-600/50" />
                </div>
              </div>

              {/* Physical measurements & BMI */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border">
                <div><span className="text-slate-500 block text-[11px]">الطول:</span><strong>{submission.height_cm ? `${submission.height_cm} سم` : "-"}</strong></div>
                <div><span className="text-slate-500 block text-[11px]">الوزن:</span><strong>{submission.weight_kg ? `${submission.weight_kg} كجم` : "-"}</strong></div>
                <div>
                  <span className="text-slate-500 block text-[11px]">مؤشر كتلة الجسم (BMI):</span>
                  {bmiData ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${bmiData.color}`}>
                      {bmiData.bmi} ({bmiData.label})
                    </span>
                  ) : "-"}
                </div>
                <div><span className="text-slate-500 block text-[11px]">توقيع فني الأشعة:</span><strong className="text-teal-800 font-bold">{submission.tech_signature || "فني الأشعة"}</strong></div>
              </div>

              {submission.notes && (
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-400 block text-[11px] font-bold">ملاحظات الفحص والجرعة:</span>
                  <p className="text-slate-800 text-xs">{submission.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ================= 2. HEALTH EDUCATION (TRC.MRS) ================= */}
          {submission.formType === "education" && (
            <div className="space-y-4">
              <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-100 space-y-3">
                <h5 className="font-bold text-rose-950 flex items-center gap-2 text-xs">
                  <HeartPulse className="w-4 h-4 text-rose-600" />
                  <span>تقييم الاحتياجات التعليمية والقابلية للتعلم</span>
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white p-3.5 rounded-xl border border-rose-100">
                  <div><span className="text-slate-400 block text-[11px]">المستوى التعليمي:</span><strong>{submission.education_level || "-"}</strong></div>
                  <div><span className="text-slate-400 block text-[11px]">القابلية للتعلم:</span><strong>{submission.learning_receptivity || "-"}</strong></div>
                  <div><span className="text-slate-400 block text-[11px]">المتلقي للتثقيف:</span><strong>{submission.target_recipient || "-"}</strong></div>
                  <div><span className="text-slate-400 block text-[11px]">الإجراء المطلوب:</span><strong>{submission.procedure_name || "-"}</strong></div>
                  <div><span className="text-slate-400 block text-[11px]">لغة التثقيف:</span><strong>{submission.language || "العربية"}</strong></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">عوائق التثقيف المرصودة (Barriers):</span>
                  <div className="space-y-1.5">
                    {submission.barriers && submission.barriers.length > 0 ? (
                      submission.barriers.map((b: string) => {
                        const isOrganic = b.includes("عضوي");
                        const isCognitive = b.includes("معرفي");

                        if (isOrganic) {
                          const isHearing = b.includes("سمع");
                          const isSpeech = b.includes("كلام");
                          const isOther = b.includes("أخر") || b.includes("أخرى") || b.includes("أخري");

                          let customReason = "";
                          const otherMatch = b.match(/أخر[ىي]:?\s*([^)]*)/);
                          if (otherMatch && otherMatch[1]) {
                            customReason = otherMatch[1].trim();
                          }

                          return (
                            <div key={b} className="p-2.5 bg-rose-50/90 border border-rose-200 rounded-xl space-y-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 bg-rose-200 text-rose-900 rounded-md font-bold text-xs">
                                  عائق عضوي
                                </span>
                                {isHearing && (
                                  <span className="px-2 py-0.5 bg-white text-rose-800 border border-rose-300 rounded-md font-bold text-xs">
                                    السمع
                                  </span>
                                )}
                                {isSpeech && (
                                  <span className="px-2 py-0.5 bg-white text-rose-800 border border-rose-300 rounded-md font-bold text-xs">
                                    الكلام
                                  </span>
                                )}
                                {isOther && (
                                  <span className="px-2 py-0.5 bg-white text-rose-800 border border-rose-300 rounded-md font-bold text-xs">
                                    أخرى
                                  </span>
                                )}
                              </div>
                              {isOther && customReason && (
                                <div className="text-xs text-rose-950 bg-white p-2 rounded-lg border border-rose-200 font-medium">
                                  <span className="font-bold text-rose-900">السبب / التفاصيل: </span>
                                  <span>{customReason}</span>
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (isCognitive) {
                          return (
                            <div key={b} className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl">
                              <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md font-bold text-xs">
                                عائق معرفي (مستوي الذكاء ، الاستيعاب)
                              </span>
                            </div>
                          );
                        }

                        return (
                          <span key={b} className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-semibold text-[11px] block">
                            {b}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-slate-500 text-xs">لا توجد عوائق مسجلة</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">طرق ووسائل التثقيف المستخدمة:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {submission.education_method && submission.education_method.length > 0 ? (
                      submission.education_method.map((m: string) => (
                        <span key={m} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-semibold text-[11px]">
                          ✓ {m}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">شرح شفهي ومناقشة مباشرة</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Topics Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-slate-800 text-xs flex justify-between items-center">
                  <span>مواضيع التثقيف المنجزة واستيعاب المريض</span>
                  <span className="text-[11px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                    {submission.health_education_topic_entries?.length || 0} مواضيع
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="p-2.5">الموضوع التعليمي</th>
                        <th className="p-2.5">مسؤول التثقيف</th>
                        <th className="p-2.5 text-center">مدى الاستيعاب</th>
                        <th className="p-2.5 text-center">إعادة التثقيف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(submission.health_education_topic_entries || []).map((t: any) => (
                        <tr key={t.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-medium text-slate-900">{t.topic_name}</td>
                          <td className="p-2.5 text-slate-600">{t.educator_name}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              t.is_comprehended ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}>
                              {t.is_comprehended ? "مستوعب ✓" : "غير مستوعب ✗"}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {t.reeducation_required ? (
                              <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">مطلوب إعادة</span>
                            ) : (
                              <span className="text-slate-400">غير مطلوب</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border">
                <div>
                  <span className="text-slate-400 block text-[11px]">مسؤول التثقيف الصحي:</span>
                  <strong className="text-slate-900">{submission.educator_signature || submission.nurse_signature || "-"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">تاريخ ووقت التثقيف:</span>
                  <strong className="font-mono">{submission.education_date || "-"} ({formatTime12(submission.education_time)})</strong>
                </div>
              </div>
            </div>
          )}

          {/* ================= 3. FALL RISK SCREENING (TRC.MRS) ================= */}
          {submission.formType === "fall_screen" && (
            <div className="space-y-4">
              {/* Risk Level Banner */}
              <div className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-xs ${
                submission.is_high_risk 
                  ? "bg-gradient-to-l from-rose-50/90 via-rose-50/50 to-white border-rose-200" 
                  : "bg-gradient-to-l from-emerald-50/90 via-emerald-50/50 to-white border-emerald-200"
              }`}>
                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                    submission.is_high_risk
                      ? "bg-rose-100 text-rose-600 border border-rose-200"
                      : "bg-emerald-100 text-emerald-600 border border-emerald-200"
                  }`}>
                    {submission.is_high_risk ? (
                      <AlertTriangle className="w-6 h-6" />
                    ) : (
                      <ShieldCheck className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h4 className={`font-black text-sm sm:text-base ${
                      submission.is_high_risk ? "text-rose-950" : "text-emerald-950"
                    }`}>
                      {submission.is_high_risk
                        ? "المريض مصنف: معرّض لمخاطر السقوط (High Risk)"
                        : "المريض مصنف: غير معرّض لمخاطر السقوط (Low Risk)"}
                    </h4>
                    <p className={`text-xs mt-0.5 font-medium ${
                      submission.is_high_risk ? "text-rose-800" : "text-emerald-800"
                    }`}>
                      {submission.is_high_risk
                        ? "يلزم تطبيق تدابير الأمان السريرية، تعليق شارة خطر السقوط (F)، وتأمين كرسي متحرك للمريض."
                        : "المريض بحالة حركية وإدراكية مستقرة ولا يتطلب بروتوكول سقوط خاص."}
                    </p>
                  </div>
                </div>

                <div className="self-end sm:self-center shrink-0">
                  <span className={`px-4 py-1.5 rounded-xl text-xs font-black tracking-wide shadow-xs inline-flex items-center gap-1.5 ${
                    submission.is_high_risk 
                      ? "bg-rose-600 text-white shadow-rose-200" 
                      : "bg-emerald-600 text-white shadow-emerald-200"
                  }`}>
                    {submission.is_high_risk ? (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>خطر عالي (High Risk)</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>خطر منخفض (Low Risk)</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Checklist Grid */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-purple-700" />
                    <span className="font-extrabold text-slate-800 text-xs sm:text-sm">
                      نتائج الفحص المبدئي لعوامل الخطورة (Checklist — 6 معايير)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    TRC.MRS
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: "gait_disturbance", num: "1", label: "اضطراب في المشي أو عدم اتزان (Gait disturbance)" },
                    { id: "use_mobility_aids", num: "2", label: "استخدام وسائل مساعدة (عصا / عكاز / مشاية)" },
                    { id: "bed_ridden", num: "3", label: "مريض ملازم للفراش (Bed-ridden)" },
                    { id: "mental_disability", num: "4", label: "إعاقة ذهنية أو تشوش إدراكي (Mental impairment)" },
                    { id: "sensory_impairment", num: "5", label: "ضعف شديد في الحواس (بصر أو سمع)" },
                    { id: "child_under_15", num: "6", label: "طفل أقل من 15 عاماً (Child under 15)" },
                  ].map((item) => {
                    const isPositive = Boolean(submission[item.id]);
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isPositive
                            ? "bg-rose-50/90 border-rose-300 text-rose-950 font-bold shadow-xs ring-1 ring-rose-200/80"
                            : "bg-slate-50/50 hover:bg-slate-50 border-slate-200 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                            isPositive ? "bg-rose-600 text-white" : "bg-slate-200 text-slate-700"
                          }`}>
                            {item.num}
                          </span>
                          <span className="text-xs truncate">{item.label}</span>
                        </div>

                        <div className="shrink-0">
                          {isPositive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>نعم (خطر)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-400 text-[11px] font-semibold">
                              <X className="w-3 h-3 text-slate-300" />
                              <span>لا</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Verification & Metadata Stamp */}
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/90 grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] font-medium">تاريخ وتوقيت المسح</span>
                    <strong className="text-slate-900 font-mono text-xs block truncate">
                      {submission.screening_date} • {formatTime12(submission.screening_time)}
                    </strong>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    submission.wheelchair_used ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] font-medium">استخدام كرسي متحرك وشارة F</span>
                    <strong className={`text-xs block ${submission.wheelchair_used ? "text-amber-900 font-bold" : "text-slate-700"}`}>
                      شارة F: {submission.f_badge_applied ? "نعم ✓" : "لا"} • كرسي: {submission.wheelchair_used ? "مستخدم ✓" : "لا"}
                    </strong>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <PenTool className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] font-medium">القائم بالمسح السريري</span>
                    <strong className="text-slate-900 text-xs block truncate capitalize">
                      {submission.screener_signature || "طاقم التمريض"}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 4. ADULT FALL RISK (HENDRICH II) (TRC-ICD) ================= */}
          {submission.formType === "fall_adult" && (() => {
            const isDirect = Boolean(
              submission.bed_ridden ||
              submission.physical_disability ||
              submission.mental_disability ||
              submission.anesthesia_first_24h ||
              submission.direct_factors?.bed_ridden ||
              submission.direct_factors?.physical_disability ||
              submission.direct_factors?.mental_disability ||
              submission.direct_factors?.anesthesia_first_24h
            );

            return (
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isDirect || submission.is_high_risk || (submission.total_score >= 5)
                    ? "bg-rose-50 border-rose-300 text-rose-950"
                    : "bg-emerald-50 border-emerald-300 text-emerald-950"
                }`}>
                  <div>
                    {isDirect ? (
                      <>
                        <h4 className="font-extrabold text-sm sm:text-base text-rose-900">
                          عالي الخطورة مباشرة (دون تقييم رقمي)
                        </h4>
                        <span className="text-xs opacity-90 text-rose-800">
                          يندرج المريض تحت معايير الخطورة العالية المباشرة
                        </span>
                      </>
                    ) : (
                      <>
                        <h4 className="font-extrabold text-sm sm:text-base">
                          مجموع نقاط مقياس هندريش 2: {submission.total_score || 0} نقطة
                        </h4>
                        <span className="text-xs opacity-90">
                          {submission.is_high_risk || (submission.total_score >= 5)
                            ? "⚠️ المريض عالي الخطورة للسقوط (5 نقاط فأكثر)"
                            : "✓ المريض منخفض الخطورة للسقوط (أقل من 5 نقاط)"}
                        </span>
                      </>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                    isDirect || submission.is_high_risk || (submission.total_score >= 5) ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                  }`}>
                    {isDirect || submission.is_high_risk || (submission.total_score >= 5) ? "خطر عالي (High Risk)" : "خطر منخفض (Low Risk)"}
                  </span>
                </div>

                {isDirect && (
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                        المعايير المباشرة للخطورة العالية (Direct High Risk Criteria):
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">Direct Criteria</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        { id: "bed_ridden", label: "مريض ملازم للفراش (Bed-ridden)" },
                        { id: "physical_disability", label: "وجود إعاقة جسدية (Physical disability)" },
                        { id: "anesthesia_first_24h", label: "مريض في أول 24 ساعة من التخدير (Anaesthesia ≤24h)" },
                        { id: "mental_disability", label: "وجود إعاقة ذهنية أو تشوش إدراكي" },
                      ].map((df) => {
                        const isChecked = Boolean(submission[df.id] || submission.direct_factors?.[df.id]);
                        return (
                          <div
                            key={df.id}
                            className={`p-3 rounded-xl border flex items-center justify-between select-none transition-all ${
                              isChecked
                                ? "bg-rose-50 border-rose-300 text-rose-950 font-bold shadow-xs ring-1 ring-rose-200"
                                : "bg-slate-50/70 border-slate-200 text-slate-400"
                            }`}
                          >
                            <span className="text-xs">{df.label}</span>
                            <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${
                              isChecked
                                ? "bg-rose-600 text-white shadow-xs"
                                : "border border-slate-300 bg-white"
                            }`}>
                              {isChecked ? "✓" : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Always show 8 Factors Breakdown */}
                <div className="bg-slate-50 p-4 rounded-2xl border space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">تفاصيل درجات المقياس الثمانية (Hendrich II Breakdown):</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-white p-2.5 rounded-xl border"><span>الارتباك/التشوش (+4):</span> <strong className="font-mono text-rose-700">+{submission.confusion_disorientation_score || 0}</strong></div>
                    <div className="bg-white p-2.5 rounded-xl border"><span>الاكتئاب المصحوب بأعراض (+2):</span> <strong className="font-mono text-rose-700">+{submission.symptomatic_depression_score || 0}</strong></div>
                    <div className="bg-white p-2.5 rounded-xl border"><span>تغير في الإخراج (+1):</span> <strong className="font-mono text-rose-700">+{submission.altered_elimination_score || 0}</strong></div>
                    <div className="bg-white p-2.5 rounded-xl border"><span>الدوار / الدوخة (+1):</span> <strong className="font-mono text-rose-700">+{submission.dizziness_vertigo_score || 0}</strong></div>
                    <div className="bg-white p-2.5 rounded-xl border"><span>الجنس ذكر (+1):</span> <strong className="font-mono text-rose-700">+{submission.male_gender_score || 0}</strong></div>
                    <div className="bg-white p-2.5 rounded-xl border"><span>أدوية الصرع والمهدئات (+2):</span> <strong className="font-mono text-rose-700">+{submission.antiepileptics_sedatives_score || 0}</strong></div>
                    <div className="bg-white p-2.5 rounded-xl border"><span>مضادات الاكتئاب (+1):</span> <strong className="font-mono text-rose-700">+{submission.antidepressants_score || 0}</strong></div>
                    <div className="bg-white p-2.5 rounded-xl border"><span>اختبار النهوض والجلوس:</span> <strong className="font-mono text-rose-700">+{submission.get_up_and_go_score || 0}</strong></div>
                  </div>
                </div>

                {submission.interventions && submission.interventions.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-2xl border space-y-2">
                    <span className="font-bold text-slate-800 block text-xs">الإجراءات والاحتياطات الوقائية المطبقة لمنع السقوط:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {submission.interventions.map((intv: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-white text-slate-800 border border-slate-200 rounded-lg text-[11px] font-medium shadow-2xs">
                          ✓ {intv}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border">
                  <div><span className="text-slate-400 block text-[11px]">تاريخ ووقت التقييم:</span><strong className="font-mono">{submission.assessment_date} ({formatTime12(submission.assessment_time)})</strong></div>
                  <div><span className="text-slate-400 block text-[11px]">توقيع القائم بالتقييم:</span><strong>{submission.assessor_signature || submission.nurse_signature || "-"}</strong></div>
                </div>
              </div>
            );
          })()}

          {/* ================= 5. PEDIATRIC FALL RISK (HUMPTY DUMPTY) ================= */}
          {submission.formType === "fall_ped" && (() => {
            const isDirect = Boolean(
              submission.bed_ridden ||
              submission.critical_unit ||
              submission.anesthesia_48h ||
              submission.mental_disability ||
              submission.neonate ||
              submission.physical_disability ||
              submission.has_direct_high_risk ||
              submission.direct_factors?.bed_ridden ||
              submission.direct_factors?.critical_unit ||
              submission.direct_factors?.anesthesia_48h ||
              submission.direct_factors?.mental_disability ||
              submission.direct_factors?.neonate ||
              submission.direct_factors?.physical_disability
            );

            return (
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isDirect || submission.risk_level === "عالية المخاطر" || (submission.total_score >= 12)
                    ? "bg-rose-50 border-rose-300 text-rose-950"
                    : submission.risk_level === "متوسط المخاطر"
                    ? "bg-amber-50 border-amber-300 text-amber-950"
                    : "bg-emerald-50 border-emerald-300 text-emerald-950"
                }`}>
                  <div>
                    {isDirect ? (
                      <>
                        <h4 className="font-extrabold text-sm sm:text-base text-rose-900">
                          عالية المخاطر مباشرة (دون تقييم رقمي)
                        </h4>
                        <span className="text-xs opacity-90 text-rose-800">
                          يندرج الطفل تحت معايير الخطورة العالية المباشرة
                        </span>
                      </>
                    ) : (
                      <>
                        <h4 className="font-extrabold text-sm sm:text-base">
                          مجموع مقياس هامبتي دمبتي: {submission.total_score || 0} نقطة
                        </h4>
                        <span className="text-xs opacity-90">
                          مستوى الخطورة: <strong>{submission.risk_level || (submission.total_score >= 12 ? "عالي الخطورة" : "منخفض الخطورة")}</strong>
                        </span>
                      </>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                    isDirect || submission.risk_level === "عالية المخاطر" || (submission.total_score >= 12)
                      ? "bg-rose-600 text-white shadow-xs"
                      : submission.risk_level === "متوسط المخاطر"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-emerald-600 text-white shadow-xs"
                  }`}>
                    {isDirect ? "عالية المخاطر" : (submission.risk_level || "منخفض المخاطر")}
                  </span>
                </div>

                {isDirect && (
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                        معايير الخطورة العالية المباشرة للأطفال (Direct Pediatric Risk Factors):
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        { id: "critical_unit", label: "مرضى الرعاية المركزة والطوارئ وغرف العمليات (ICU / ER / OR)" },
                        { id: "bed_ridden", label: "ملازم الفراش (Bed Ridden as disease or treatment plan)" },
                        { id: "mental_disability", label: "إعاقة ذهنية (داون، توحد...) (Down Syndrome, Autism...)" },
                        { id: "anesthesia_48h", label: "مريض خضع لتخدير خلال 48 ساعة (Anaesthesia within 48h)" },
                        { id: "physical_disability", label: "إعاقة جسدية (كفيف، بتر...) (Physical Disability)" },
                        { id: "neonate", label: "حديث ولادة (Neonate)" },
                      ].map((df) => {
                        const isChecked = Boolean(submission[df.id] || submission.direct_factors?.[df.id]);
                        return (
                          <div
                            key={df.id}
                            className={`p-3 rounded-xl border flex items-center justify-between select-none transition-all ${
                              isChecked
                                ? "bg-rose-50 border-rose-300 text-rose-950 font-bold shadow-xs ring-1 ring-rose-200"
                                : "bg-slate-50/70 border-slate-200 text-slate-400"
                            }`}
                          >
                            <span className="text-xs">{df.label}</span>
                            <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${
                              isChecked
                                ? "bg-rose-600 text-white shadow-xs"
                                : "border border-slate-300 bg-white"
                            }`}>
                              {isChecked ? "✓" : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 7 Parameters Breakdown */}
                <div className="bg-slate-50 p-4 rounded-2xl border space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">تفاصيل درجات المقياس (Humpty Dumpty Breakdown — 7 معايير):</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-white p-2 rounded-xl border"><span>العمر:</span> <strong className="font-mono text-cyan-700">+{submission.age_score || 0}</strong></div>
                    <div className="bg-white p-2 rounded-xl border"><span>الجنس:</span> <strong className="font-mono text-cyan-700">+{submission.gender_score || 0}</strong></div>
                    <div className="bg-white p-2 rounded-xl border"><span>التشخيص:</span> <strong className="font-mono text-cyan-700">+{submission.diagnosis_score || 0}</strong></div>
                    <div className="bg-white p-2 rounded-xl border"><span>الخلل المعرفي:</span> <strong className="font-mono text-cyan-700">+{submission.cognitive_score || 0}</strong></div>
                    <div className="bg-white p-2 rounded-xl border"><span>العوامل البيئية:</span> <strong className="font-mono text-cyan-700">+{submission.environmental_score || 0}</strong></div>
                    <div className="bg-white p-2 rounded-xl border"><span>الجراحة / التخدير:</span> <strong className="font-mono text-cyan-700">+{submission.surgery_anesthesia_score || 0}</strong></div>
                    <div className="bg-white p-2 rounded-xl border"><span>استخدام الأدوية:</span> <strong className="font-mono text-cyan-700">+{submission.medications_score || 0}</strong></div>
                  </div>
                </div>

                {/* Applied Procedures / Interventions if any */}
                {Array.isArray(submission.procedures) && submission.procedures.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-2xl border space-y-2">
                    <span className="font-bold text-slate-800 block text-xs">إجراءات واحتياطات حماية الأطفال المطبقة:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {submission.procedures.map((p: string, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 bg-white text-slate-800 border border-slate-200 rounded-lg text-[11px] font-medium shadow-2xs">
                          ✓ {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border">
                  <div><span className="text-slate-400 block text-[11px]">تاريخ ووقت التقييم:</span><strong className="font-mono">{submission.assessment_date} ({formatTime12(submission.assessment_time)})</strong></div>
                  <div><span className="text-slate-400 block text-[11px]">توقيع التمريض:</span><strong>{submission.nurse_signature}</strong></div>
                </div>
              </div>
            );
          })()}

          {/* ================= 6. COMPREHENSIVE PATIENT ASSESSMENT (TRC-ICD) ================= */}
          {submission.formType === "assessment" && (
            <div className="space-y-4">
              
              {/* Card 1: Vitals Matrix (8 parameters) */}
              <div className="bg-teal-50/60 p-4 rounded-2xl border border-teal-100 space-y-2.5">
                <h5 className="font-bold text-teal-950 flex items-center gap-2 text-xs">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>العلامات الحيوية (Vital Signs) والقياسات البدنية</span>
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100"><span>ضغط الدم (BP):</span> <strong className="font-mono block text-xs">{submission.blood_pressure || "-"}</strong></div>
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100"><span>النبض (Pulse):</span> <strong className="font-mono block text-xs">{submission.heart_rate ? `${submission.heart_rate} bpm` : "-"}</strong></div>
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100"><span>الحرارة (Temp):</span> <strong className="font-mono block text-xs">{submission.temperature ? `${submission.temperature} °C` : "-"}</strong></div>
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100"><span>الأكسجين (SpO2):</span> <strong className="font-mono block text-xs">{submission.oxygen_saturation ? `${submission.oxygen_saturation}%` : "-"}</strong></div>
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100"><span>معدل التنفس (RR):</span> <strong className="font-mono block text-xs">{submission.respiratory_rate ? `${submission.respiratory_rate}/min` : "-"}</strong></div>
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100"><span>الوزن:</span> <strong className="font-mono block text-xs">{submission.weight_kg ? `${submission.weight_kg} kg` : "-"}</strong></div>
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100"><span>الطول:</span> <strong className="font-mono block text-xs">{submission.height_cm ? `${submission.height_cm} cm` : "-"}</strong></div>
                  <div className="bg-white p-2.5 rounded-xl border border-teal-100"><span>الحالة الحركية:</span> <strong className="block text-xs">{submission.mobility_status || "-"}</strong></div>
                </div>
              </div>

              {/* Card 2: Clinical Assessment & History */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border space-y-2">
                  <span className="font-bold text-slate-800 block text-xs flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5 text-slate-500" /> التشخيص الطبي وتاريخ الفحص:</span>
                  <div className="space-y-1 text-slate-700">
                    <div><span className="text-slate-400">التشخيص:</span> <strong>{submission.diagnosis || "-"}</strong></div>
                    <div><span className="text-slate-400">الإجراء المطلوب:</span> <strong>{submission.procedure_name || "-"}</strong></div>
                    <div><span className="text-slate-400">التاريخ المرضي والجراحي:</span> <span className="text-slate-800">{submission.medical_surgical_history || "لا يوجد"}</span></div>
                    <div><span className="text-slate-400">حالة التدخين:</span> <strong className="text-slate-800">{submission.is_smoker ? "مدخن 🚬" : "غير مدخن 🚭"}</strong></div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border space-y-2">
                  <span className="font-bold text-slate-800 block text-xs flex items-center gap-1.5"><AlertOctagon className="w-3.5 h-3.5 text-rose-500" /> الحساسية والمخاطر السريرية:</span>
                  <div className="space-y-1 text-slate-700">
                    <div>
                      <span className="text-slate-400">الحساسية:</span>{" "}
                      {submission.allergy_types && submission.allergy_types.length > 0 ? (
                        <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {submission.allergy_types.join(", ")} {submission.allergy_details ? `(${submission.allergy_details})` : ""}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">لا توجد حساسية معروفة</span>
                      )}
                    </div>
                    <div><span className="text-slate-400">أمراض الكلى:</span> <strong>{submission.kidney_disease ? `نعم (${submission.kidney_disease_details || ""})` : "لا"}</strong></div>
                    <div><span className="text-slate-400">أمراض القلب:</span> <strong>{submission.heart_disease ? `نعم (${submission.heart_disease_details || ""})` : "لا"}</strong></div>
                    <div><span className="text-slate-400">مضادات التجلط:</span> <strong>{submission.anticoagulants ? `نعم (${submission.anticoagulants_details || ""})` : "لا"}</strong></div>
                  </div>
                </div>
              </div>

              {/* Card 3: Additional Clinical & Psychological & Abuse checks */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border space-y-2 text-xs">
                <span className="font-bold text-slate-800 block text-xs">محددات الأمان السريري وفحص الأجهزة والحالة النفسية:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded-xl border"><span>منظم ضربات القلب:</span> <strong className="block">{submission.pacemaker ? "نعم ⚠️" : "لا"}</strong></div>
                  <div className="bg-white p-2 rounded-xl border"><span>مشبك تمدد أوعية:</span> <strong className="block">{submission.aneurysm_clip ? "نعم ⚠️" : "لا"}</strong></div>
                  <div className="bg-white p-2 rounded-xl border"><span>نقص المناعة:</span> <strong className="block">{submission.immunocompromised ? "نعم ⚠️" : "لا"}</strong></div>
                  <div className="bg-white p-2 rounded-xl border"><span>الحالة النفسية:</span> <strong className="block">{submission.psychological_status || "طبيعية"}</strong></div>
                  <div className="bg-white p-2 rounded-xl border"><span>الحالة الذهنية:</span> <strong className="block">{submission.mental_status || "طبيعي"} {submission.mental_status_details ? `(${submission.mental_status_details})` : ""}</strong></div>
                  <div className="bg-white p-2 rounded-xl border col-span-1 sm:col-span-3"><span>علامات سوء المعاملة أو الإهمال:</span> <strong className="block">{submission.abuse_neglect_signs ? `نعم (${submission.abuse_neglect_details || ""})` : "لا توجد علامات"}</strong></div>
                </div>
              </div>

              {/* Card 4: Female Reproductive History (If female or data present) */}
              {(submission.gender === "أنثى" || submission.resolvedGender === "أنثى" || submission.lmp_date || submission.pregnant_or_suspected) && (
                <div className="bg-pink-50/60 p-3.5 rounded-2xl border border-pink-200 space-y-2">
                  <span className="font-bold text-pink-950 block text-xs flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-pink-600" /> التاريخ الإنجابي والنسائي (Female Reproductive History):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-white p-2 rounded-xl border border-pink-100"><span>تاريخ آخر دورة (LMP):</span> <strong className="block font-mono">{submission.lmp_date || "غير محدد"}</strong></div>
                    <div className="bg-white p-2 rounded-xl border border-pink-100"><span>انقطاع الطمث:</span> <strong className="block">{submission.menopause ? "نعم" : "لا"}</strong></div>
                    <div className="bg-white p-2 rounded-xl border border-pink-100"><span>تأخر الدورة:</span> <strong className="block">{submission.delayed_period ? "نعم" : "لا"}</strong></div>
                    <div className="bg-white p-2 rounded-xl border border-pink-100"><span>وسائل منع الحمل:</span> <strong className="block">{submission.contraceptive_use ? "نعم" : "لا"}</strong></div>
                    <div className="bg-white p-2 rounded-xl border border-pink-100"><span>تخطيط للحمل:</span> <strong className="block">{submission.planning_pregnancy ? "نعم" : "لا"}</strong></div>
                    <div className="bg-white p-2 rounded-xl border border-pink-100"><span>حامل أو اشتباه حمل:</span> <strong className={`block ${submission.pregnant_or_suspected ? "text-rose-700 font-bold" : ""}`}>{submission.pregnant_or_suspected ? "نعم ⚠️" : "لا"}</strong></div>
                    <div className="bg-white p-2 rounded-xl border border-pink-100"><span>مرضعة:</span> <strong className="block">{submission.lactating ? "نعم" : "لا"}</strong></div>
                  </div>
                </div>
              )}

              {/* Card 5: Laboratory Results */}
              {(submission.lab_gfr || submission.lab_creatinine || submission.lab_bun || submission.lab_urea || submission.lab_sodium || submission.lab_potassium) && (
                <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200 space-y-2">
                  <span className="font-bold text-blue-950 block text-xs flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-blue-600" /> نتائج الفحوصات والتحاليل المعملية (Laboratory Tests):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs font-mono">
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-sans">eGFR</span>
                      <strong className="text-blue-900">{submission.lab_gfr || "-"}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-sans">Creatinine</span>
                      <strong className="text-blue-900">{submission.lab_creatinine || "-"}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-sans">BUN</span>
                      <strong className="text-blue-900">{submission.lab_bun || "-"}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-sans">Urea</span>
                      <strong className="text-blue-900">{submission.lab_urea || "-"}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-sans">Sodium (Na)</span>
                      <strong className="text-blue-900">{submission.lab_sodium || "-"}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-slate-400 block font-sans">Potassium (K)</span>
                      <strong className="text-blue-900">{submission.lab_potassium || "-"}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Card 6: Connections Table */}
              {Array.isArray(submission.connections) && submission.connections.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-600" /> الوصلات التي تم تركيبها للمريض (Connections)</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">{submission.connections.length} وصلات</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 text-[11px]">
                        <tr>
                          <th className="p-2">اسم الوصلة</th>
                          <th className="p-2">المقاس</th>
                          <th className="p-2">المكان</th>
                          <th className="p-2">وقت وتاريخ التركيب</th>
                          <th className="p-2">القائم بالتركيب</th>
                          <th className="p-2">تاريخ الإزالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {submission.connections.map((c: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="p-2 font-bold text-slate-900">{c.name || "-"}</td>
                            <td className="p-2">{c.size || "-"}</td>
                            <td className="p-2">{c.site || "-"}</td>
                            <td className="p-2 font-mono">{c.inserted_at || "-"}</td>
                            <td className="p-2">{c.inserted_by || "-"}</td>
                            <td className="p-2 font-mono">{c.removed_at || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Card 7: Medications Table */}
              {Array.isArray(submission.medications) && submission.medications.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Pill className="w-3.5 h-3.5 text-indigo-600" /> الأدوية المعطاة للمريض (Medications)</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">{submission.medications.length} أدوية</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 text-[11px]">
                        <tr>
                          <th className="p-2">الوقت</th>
                          <th className="p-2">اسم الدواء</th>
                          <th className="p-2">الجرعة</th>
                          <th className="p-2">طريقة الإعطاء</th>
                          <th className="p-2">معدل الإعطاء</th>
                          <th className="p-2">الطبيب مصدر الأمر</th>
                          <th className="p-2">القائم بالإعطاء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {submission.medications.map((m: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="p-2 font-mono">{m.time || "-"}</td>
                            <td className="p-2 font-bold text-slate-900">{m.name || "-"}</td>
                            <td className="p-2">{m.dose || "-"}</td>
                            <td className="p-2">{m.route || "-"}</td>
                            <td className="p-2">{m.frequency || "-"}</td>
                            <td className="p-2">{m.ordering_physician || "-"}</td>
                            <td className="p-2">{m.administered_by || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Card 8: Care Plan Table (3 items) */}
              {submission.plan_of_care && Array.isArray(submission.plan_of_care) && submission.plan_of_care.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-slate-800 text-xs flex items-center justify-between">
                    <span>خطة الرعاية التمريضية والتصوير الطبي (Plan of Care)</span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold">{submission.plan_of_care.length} بنود</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="p-2.5 w-[25%]">المشكلة التمريضية / الطبية</th>
                          <th className="p-2.5 w-[20%]">الأهداف المتوقعة</th>
                          <th className="p-2.5 w-[35%]">التدخلات المقررة</th>
                          <th className="p-2.5 text-center w-[20%]">المسؤول والاعتماد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {submission.plan_of_care.map((plan: any, i: number) => {
                          const interventionsText = plan.intervention || (Array.isArray(plan.interventions) && plan.interventions.length > 0 ? plan.interventions.join("، ") : "-");
                          const respText = Array.isArray(plan.responsible) ? plan.responsible.join("، ") : (plan.responsible || "-");

                          return (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-bold text-slate-900">{plan.problem || "-"}</td>
                              <td className="p-2.5 text-slate-700">{plan.goal || "-"}</td>
                              <td className="p-2.5 text-slate-700 text-[11px] leading-relaxed">
                                {interventionsText}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="text-[10px] text-slate-500 font-medium mb-1">
                                  {respText} {plan.time_frame ? `(${plan.time_frame})` : ""}
                                </div>
                                <span className="bg-teal-50 text-teal-800 px-2 py-0.5 rounded text-[11px] font-medium border border-teal-200 block">
                                  {plan.evaluation || "مستقر"}
                                </span>
                                {plan.confirmed_by && (
                                  <span className="text-[10px] text-teal-700 block mt-0.5 font-bold">
                                    ✓ بواسطة: {plan.confirmed_by}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Card 9: Multi-role Signatures Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border">
                <div>
                  <span className="text-slate-400 block text-[11px]">الطبيب المعالج:</span>
                  <strong className="text-slate-900">{submission.attending_physician || "-"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">توقيع التمريض:</span>
                  {submission.nurse_signature ? (
                    <strong className="text-slate-800">{submission.nurse_signature}</strong>
                  ) : (
                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-medium inline-block">بانتظار التمريض</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">توقيع فني الأشعة:</span>
                  {(() => {
                    const techPlan = Array.isArray(submission.plan_of_care)
                      ? submission.plan_of_care.find((p: any) =>
                          !p?.responsible?.some((r: string) => r?.includes("طبيب") || r?.includes("أخصائي")) &&
                          (
                            p?.responsible?.includes("فني الأشعة") ||
                            p?.problem?.includes("السلامة والجرعة") ||
                            p?.interventions?.some((i: string) => i?.includes("جرعة الإشعاع") || i?.includes("دليل الاجراءات"))
                          )
                        )
                      : null;
                    const rawTechSig = submission.tech_signature;
                    const isDuplicateOfDoc = rawTechSig && submission.physician_signature && rawTechSig === submission.physician_signature;
                    const techSig = techPlan?.confirmed_by || (!isDuplicateOfDoc ? rawTechSig : null);
                    return techSig ? (
                      <strong className="text-teal-700">{techSig}</strong>
                    ) : (
                      <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-medium inline-block">بانتظار فني الأشعة</span>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">توقيع طبيب الأشعة:</span>
                  {(() => {
                    const docPlan = Array.isArray(submission.plan_of_care)
                      ? submission.plan_of_care.find((p: any) =>
                          p?.responsible?.includes("أخصائي الأشعة") ||
                          p?.responsible?.includes("طبيب الأشعة") ||
                          p?.interventions?.some((i: string) => i?.includes("فوائد ومخاطر")) ||
                          (p?.problem?.includes("التصوير") && !p?.problem?.includes("السلامة والجرعة"))
                        )
                      : null;
                    const docSig = submission.physician_signature || docPlan?.confirmed_by;
                    return docSig ? (
                      <strong className="text-emerald-700">{docSig}</strong>
                    ) : (
                      <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-medium inline-block">بانتظار طبيب الأشعة</span>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* ================= 7. PATIENT TRANSFER (RSTP) ================= */}
          {submission.formType === "transfer" && (
            <div className="space-y-4">
              {/* RSTP Result Banner */}
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md space-y-3">
                <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                  <div>
                    <span className="text-blue-300 text-[11px]">معدل الخطر عند نقل المريض (RSTP Score)</span>
                    <h4 className="text-xl font-extrabold">{submission.total_rstp_score || 0} نقطة</h4>
                  </div>
                  <span className="px-3 py-1 bg-blue-500/30 border border-blue-400/40 rounded-xl font-bold text-xs">
                    المجموعة {submission.group_code} (Group {submission.group_code})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-white/10 p-2.5 rounded-xl">
                    <span className="text-blue-200 block text-[10px]">مسار النقل:</span>
                    <strong className="block text-xs">من: {submission.from_location || "-"} ➔ إلى: {submission.to_location || "-"}</strong>
                  </div>
                  <div className="bg-white/10 p-2.5 rounded-xl">
                    <span className="text-blue-200 block text-[10px]">وسيلة النقل:</span>
                    <strong className="block text-sm">{submission.recommended_vehicle || "-"}</strong>
                  </div>
                  <div className="bg-white/10 p-2.5 rounded-xl">
                    <span className="text-blue-200 block text-[10px]">طاقم النقل المرافق:</span>
                    <strong className="block text-sm">{submission.recommended_staff || "-"}</strong>
                  </div>
                  <div className="bg-white/10 p-2.5 rounded-xl">
                    <span className="text-blue-200 block text-[10px]">المتابعة المستمرة:</span>
                    <strong className="block text-sm">{submission.continuous_monitoring_applicable ? "مطبق ✓" : "غير مطبق (NA)"}</strong>
                  </div>
                </div>
              </div>

              {/* 11 Physiological Parameters Breakdown */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900 text-xs">تفصيل تقييم الـ 11 مؤشراً فسيولوجياً وسريرياً (RSTP Parameters):</span>
                  <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 font-bold">
                    11 محددات فسيولوجية
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { id: "hemodynamic_score", title_ar: "الديناميكا الدموية (ضغط الدم)", title_en: "Hemodynamic" },
                    { id: "arrhythmias_score", title_ar: "اضطراب ضربات القلب", title_en: "Arrhythmias" },
                    { id: "ecg_monitoring_score", title_ar: "رسم القلب المستمر", title_en: "ECG Monitoring" },
                    { id: "iv_line_score", title_ar: "الخطوط والمحاليل الوريدية", title_en: "I.V Line" },
                    { id: "pacemaker_score", title_ar: "منظم ضربات القلب", title_en: "Pacemaker" },
                    { id: "respiration_score", title_ar: "التنفس ونسبة الأكسجين", title_en: "Respiration" },
                    { id: "airway_score", title_ar: "المجرى الهوائي", title_en: "Airway" },
                    { id: "respiratory_support_score", title_ar: "الدعم التنفسي وأجهزة التنفس", title_en: "Respiratory Support" },
                    { id: "neurological_score", title_ar: "الحالة العصبية والوعي", title_en: "Neurological" },
                    { id: "prematurely_score", title_ar: "الأطفال المبتسرين وحديثي الولادة", title_en: "Prematurely" },
                    { id: "techno_pharmacological_score", title_ar: "المضخات والأدوية التقنية", title_en: "Techno-Pharmacological" },
                  ].map((p) => (
                    <div key={p.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-[11px] block">{p.title_ar}</span>
                        <span className="text-slate-400 text-[10px] font-sans block" dir="ltr">{p.title_en}</span>
                      </div>
                      <span className="font-mono font-bold text-xs px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-blue-800">
                        +{submission[p.id] || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safety Checklist */}
              {submission.safety_checklist && Object.keys(submission.safety_checklist).filter(k => submission.safety_checklist[k]).length > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-2xl space-y-2">
                  <span className="font-bold text-amber-900 block text-xs flex items-center gap-1.5">✅ متطلبات الأمان والتأكيد (Safety Checklist)</span>
                  <div className="space-y-1.5">
                    {Object.entries(submission.safety_checklist).map(([item, val]) => (
                      val ? (
                        <div key={item} className="flex items-start justify-between gap-3 bg-white p-2.5 rounded-xl border border-amber-100">
                          <span className="text-xs text-slate-700 flex-1">{item}</span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border shrink-0 ${
                            val === "تم" || val === true || val === "جاهز" || val === "مكتمل"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-slate-100 text-slate-700 border-slate-300"
                          }`}>{String(val) === "true" ? "تم ✓" : String(val)}</span>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
              )}

              {/* Transfer Instructions if any */}
              {submission.transfer_instructions && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800 block text-xs">تعليمات واحتياطات النقل المحددة:</span>
                  <p className="text-slate-700 text-xs leading-relaxed">{submission.transfer_instructions}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-2xl border">
                {/* Physician Signature */}
                <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 block text-[11px] font-bold">توقيع واعتماد طبيب الأشعة:</span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                      طبيب الأشعة
                    </span>
                  </div>
                  {submission.receiving_physician_signature || submission.physician_signature ? (
                    <strong className="text-emerald-700 text-sm font-bold flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{submission.receiving_physician_signature || submission.physician_signature}</span>
                    </strong>
                  ) : (
                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-medium inline-block mt-1">
                      لم يتم التوثيق بعد (بانتظار طبيب الأشعة)
                    </span>
                  )}
                </div>

                {/* Nurse Signature */}
                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 block text-[11px] font-bold">توقيع واستلام التمريض:</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                      التمريض
                    </span>
                  </div>
                  {submission.receiving_nurse_signature || submission.nurse_signature ? (
                    <strong className="text-emerald-700 text-sm font-bold flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{submission.receiving_nurse_signature || submission.nurse_signature}</span>
                    </strong>
                  ) : (
                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-medium inline-block mt-1">
                      لم يتم التوثيق بعد (بانتظار التمريض)
                    </span>
                  )}
                </div>
              </div>

              {(submission.transfer_date || submission.transfer_time) && (
                <div className="flex justify-between items-center text-xs text-slate-500 px-1 font-medium">
                  <div>تاريخ النقل: <span className="font-bold text-slate-700">{submission.transfer_date}</span></div>
                  <div>وقت النقل: <span className="font-bold text-slate-700 font-mono">{formatTime12(submission.transfer_time)}</span></div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Bottom Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#621c6f] to-[#7f2490] hover:from-[#4f1659] hover:to-[#6a1e78] text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة النموذج الرسمية</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
