"use client";

import React from "react";
import { formatTime12 } from "@/lib/timeUtils";
import { PEDIATRIC_FALL_PREVENTION_PROCEDURES } from "@/app/forms/fall-risk-pediatric/page";

interface SubmissionPrintLayoutProps {
  submission: any | null;
}

// Unified, highly organized hospital header & patient info block
function PrintHeader({
  code,
  titleAr,
  titleEn,
  submission,
  extraPatientRow,
}: {
  code: string;
  titleAr: string;
  titleEn: string;
  submission: any;
  extraPatientRow?: React.ReactNode;
}) {
  const patientName = submission.resolvedPatientName || submission.patient_name || submission.full_name || "مريض غير مسجل بالاسم";
  const mrn = submission.resolvedMrn || submission.mrn || "-";
  const age = submission.age !== undefined && submission.age !== null ? submission.age : (submission.resolvedAge || "-");
  const gender = submission.gender || submission.resolvedGender || "-";
  const dateStr = submission.visit_date || submission.exposure_date || submission.screening_date || submission.assessment_date || submission.transfer_date || (submission.created_at ? new Date(submission.created_at).toLocaleDateString("ar-EG") : "-");
  const timeStr = formatTime12(submission.visit_time || submission.exposure_time || submission.screening_time || submission.assessment_time || submission.transfer_time) || (submission.created_at ? new Date(submission.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "-");

  return (
    <div className="mb-3 print-avoid-break">
      {/* 1. Official Center Letterhead */}
      <div className="flex justify-between items-center pb-2 mb-2 border-b-2 border-black">
        <div className="border-2 border-black px-3 py-1 text-center font-mono rounded">
          <div className="font-extrabold text-xs tracking-wider">TIBA SCAN</div>
          <div className="text-[9px] font-sans font-bold">مركز أشعة تشخيصية</div>
        </div>
        <div className="text-center">
          <h2 className="text-sm font-extrabold tracking-wide uppercase">Tiba Scan Radiology Center</h2>
          <h3 className="text-xs font-bold text-slate-900 mt-0.5">مركز طيبة سكان للأشعة التشخيصية والتداخلية</h3>
        </div>
        <div className="border-2 border-black px-2.5 py-1 text-center font-mono font-bold text-xs bg-slate-100 rounded">
          {code}
        </div>
      </div>

      {/* 2. Official Form Title Banner */}
      <div className="text-center py-1.5 px-2 bg-slate-100 border border-black font-bold text-xs mb-2 rounded-xs">
        <div>{titleAr}</div>
        <div className="text-[10px] font-normal text-slate-700 tracking-wide">{titleEn}</div>
      </div>

      {/* 3. Structured Patient Information Table */}
      <table className="w-full border-collapse border border-black text-right text-[10px] mb-1">
        <tbody>
          <tr>
            <td className="border border-black p-1.5 font-bold bg-slate-50 w-[18%]">اسم المريض رباعي:</td>
            <td className="border border-black p-1.5 font-bold text-slate-900 w-[42%]">{patientName}</td>
            <td className="border border-black p-1.5 font-bold bg-slate-50 w-[16%]">رقم الملف (MRN):</td>
            <td className="border border-black p-1.5 font-mono font-bold w-[24%]">{mrn}</td>
          </tr>
          <tr>
            <td className="border border-black p-1.5 font-bold bg-slate-50">السن / النوع:</td>
            <td className="border border-black p-1.5">{age} سنة / {gender}</td>
            <td className="border border-black p-1.5 font-bold bg-slate-50">تاريخ ووقت الفحص:</td>
            <td className="border border-black p-1.5 font-mono">{dateStr} ({timeStr})</td>
          </tr>
          {extraPatientRow}
        </tbody>
      </table>
    </div>
  );
}

// Standard Official Signature Box
function PrintSignatureBlock({
  signatures,
  footerCode,
}: {
  signatures: Array<{ roleTitle: string; name?: string; placeholder?: string }>;
  footerCode: string;
}) {
  const colCount = signatures.length === 3 ? "grid-cols-3" : signatures.length === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className="mt-4 pt-2 border-t-2 border-black print-avoid-break">
      <div className={`grid ${colCount} gap-3 text-center text-[10px]`}>
        {signatures.map((sig, idx) => (
          <div key={idx} className="border border-black p-2 rounded-xs bg-slate-50/50">
            <div className="font-bold mb-1 text-slate-800">{sig.roleTitle}</div>
            <div className="pt-2">
              {sig.name && sig.name.trim() && sig.name !== "-" ? (
                <div className="font-bold underline text-xs font-mono text-slate-900">
                  {sig.name}
                </div>
              ) : (
                <div className="text-slate-400 font-normal">
                  {sig.placeholder || "......................................."}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Document Control Footer */}
      <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 mt-3 pt-1 border-t border-slate-300">
        <span>مركز طيبة سكان للأشعة — نظام إدارة الجودة الطبية</span>
        <span>كود الوثيقة: {footerCode}</span>
        <span>صفحة 1 من 1</span>
      </div>
    </div>
  );
}

export default function SubmissionPrintLayout({ submission }: SubmissionPrintLayoutProps) {
  if (!submission) return null;

  return (
    <div className="hidden print:block bg-white text-black font-sans text-[10px] leading-normal select-text p-1">
      
      {/* ============================================================== */}
      {/* 1. RADIATION EXPOSURE (TRC.MRS)                                */}
      {/* ============================================================== */}
      {submission.formType === "radiation" && (
        <div className="space-y-3">
          <PrintHeader
            code="TRC.MRS"
            titleAr="نموذج تسجيل التعرض لجرعات الأشعة"
            titleEn="Radiation Exposure Log Form"
            submission={submission}
            extraPatientRow={
              <tr>
                <td className="border border-black p-1.5 font-bold bg-slate-50">الإجراء الطبي المطلوب:</td>
                <td className="border border-black p-1.5" colSpan={3}>
                  {submission.procedure_name || "-"} {submission.procedure_location ? `(${submission.procedure_location})` : ""}
                </td>
              </tr>
            }
          />

          <table className="w-full border-collapse border border-black text-center text-[10px]">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-black">
                <th className="border border-black p-2">التاريخ</th>
                <th className="border border-black p-2">الوقت</th>
                <th className="border border-black p-2">الطول (cm)</th>
                <th className="border border-black p-2">الوزن (kg)</th>
                <th className="border border-black p-2">السن</th>
                <th className="border border-black p-2">الفحص ومكان الإجراء</th>
                <th className="border border-black p-2">جرعة الإشعاع (DLP)</th>
                <th className="border border-black p-2">الجرعة التراكمية</th>
                <th className="border border-black p-2">القائم بالإجراء</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-medium">
                <td className="border border-black p-2 font-mono">
                  {submission.exposure_date || new Date(submission.created_at).toLocaleDateString("ar-EG")}
                </td>
                <td className="border border-black p-2 font-mono">
                  {formatTime12(submission.exposure_time) || new Date(submission.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="border border-black p-2 font-mono">{submission.height_cm ? `${submission.height_cm} cm` : "-"}</td>
                <td className="border border-black p-2 font-mono">{submission.weight_kg ? `${submission.weight_kg} kg` : "-"}</td>
                <td className="border border-black p-2">{submission.age || submission.resolvedAge || "-"}</td>
                <td className="border border-black p-2 font-bold">
                  {submission.procedure_name || "-"} {submission.procedure_location ? `(${submission.procedure_location})` : ""}
                </td>
                <td className="border border-black p-2 font-bold font-mono text-xs">{submission.radiation_dose || 0}</td>
                <td className="border border-black p-2 font-bold font-mono text-xs">{submission.cumulative_dose || 0}</td>
                <td className="border border-black p-2 font-bold">{submission.tech_signature || "فني الأشعة"}</td>
              </tr>
            </tbody>
          </table>

          <div className="border border-black p-2 bg-slate-50 text-[10px] space-y-1">
            <div className="font-bold text-slate-800">إقرار السلامة الإشعاعية ومبدأ ALARA:</div>
            <div className="text-slate-700">
              تم التحقق من هوية المريض ومطابقة الإجراء، واستخدام وسائل الحماية الإشعاعية المناسبة وتطبيق مبدأ ALARA لتقليل الجرعة الإشعاعية للحد الأدنى اللازم تشخيصياً.
            </div>
          </div>

          <PrintSignatureBlock
            footerCode="TRC.MRS"
            signatures={[
              {
                roleTitle: "توقيع فني الأشعة المسؤول",
                name: submission.tech_signature,
              },
            ]}
          />
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. HEALTH EDUCATION (TRC.MRS)                                  */}
      {/* ============================================================== */}
      {submission.formType === "education" && (
        <div className="space-y-3">
          <PrintHeader
            code="TRC.MRS"
            titleAr="نموذج التثقيف الصحي للمريض والأسرة"
            titleEn="Patient & Family Health Education Assessment"
            submission={submission}
            extraPatientRow={
              <tr>
                <td className="border border-black p-1.5 font-bold bg-slate-50">الإجراء المطلوب:</td>
                <td className="border border-black p-1.5" colSpan={3}>{submission.procedure_name || "-"}</td>
              </tr>
            }
          />

          <div className="border border-black p-2.5 space-y-2">
            <div className="font-bold underline text-[11px] mb-1">تقييم الاحتياجات التعليمية ومحددات التعلم:</div>
            <table className="w-full border-collapse border border-black text-right text-[10px]">
              <tbody>
                <tr>
                  <td className="border border-black p-1.5 font-bold bg-slate-50 w-[20%]">المستوى التعليمي:</td>
                  <td className="border border-black p-1.5 w-[30%]">{submission.education_level || "-"}</td>
                  <td className="border border-black p-1.5 font-bold bg-slate-50 w-[20%]">القابلية والاستعداد للتعلم:</td>
                  <td className="border border-black p-1.5 w-[30%]">{submission.learning_receptivity || "-"}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold bg-slate-50">المتلقي للتثقيف:</td>
                  <td className="border border-black p-1.5">{submission.target_recipient || "-"}</td>
                  <td className="border border-black p-1.5 font-bold bg-slate-50">لغة التثقيف المفضلة:</td>
                  <td className="border border-black p-1.5">{submission.language || "العربية"}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold bg-slate-50">طرق ووسائل التثقيف:</td>
                  <td className="border border-black p-1.5">
                    {(submission.education_method && submission.education_method.length > 0) ? submission.education_method.join("، ") : "شرح شفهي ومباشر"}
                  </td>
                  <td className="border border-black p-1.5 font-bold bg-slate-50">عوائق التعلم والتثقيف:</td>
                  <td className="border border-black p-1.5">
                    {(submission.barriers && submission.barriers.length > 0) ? submission.barriers.join("، ") : "لا توجد عوائق"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border border-black p-2.5">
            <div className="font-bold underline text-[11px] mb-2">مواضيع التثقيف الصحي المنفذة:</div>
            <table className="w-full border-collapse border border-black text-center text-[10px]">
              <thead>
                <tr className="bg-slate-100 font-bold border-b border-black">
                  <th className="border border-black p-2 text-right w-[45%]">الموضوع التعليمي والتثقيفي</th>
                  <th className="border border-black p-2 w-[25%]">مسؤول التثقيف</th>
                  <th className="border border-black p-2 w-[15%]">مدى الاستيعاب</th>
                  <th className="border border-black p-2 w-[15%]">إعادة التثقيف</th>
                </tr>
              </thead>
              <tbody>
                {(submission.health_education_topic_entries || []).length > 0 ? (
                  submission.health_education_topic_entries.map((t: any, idx: number) => (
                    <tr key={t.id || idx}>
                      <td className="border border-black p-2 text-right font-medium">{t.topic_name}</td>
                      <td className="border border-black p-2 font-bold">{t.educator_name || "-"}</td>
                      <td className="border border-black p-2">
                        {t.is_comprehended ? <span className="font-bold">✓ مستوعب</span> : "غير مستوعب"}
                      </td>
                      <td className="border border-black p-2">
                        {t.reeducation_required ? <span className="font-bold text-amber-900">مطلوب</span> : "غير مطلوب"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="border border-black p-2 text-center text-slate-500">
                      تم التثقيف الشفهي للمريض على تعليمات وإجراءات الفحص
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PrintSignatureBlock
            footerCode="TRC.MRS"
            signatures={[
              {
                roleTitle: "توقيع مسؤول التثقيف الصحي / التمريض",
                name: submission.educator_signature || submission.nurse_signature,
              },
            ]}
          />
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. FALL RISK SCREENING (TRC.MRS)                               */}
      {/* ============================================================== */}
      {submission.formType === "fall_screen" && (
        <div className="space-y-3">
          <PrintHeader
            code="TRC.MRS"
            titleAr="المسح المبدئي لخطر السقوط"
            titleEn="Initial Fall Risk Screening Form"
            submission={submission}
          />

          {/* Outcome Banner */}
          <div className="border-2 border-black p-2.5 bg-slate-50 flex justify-between items-center text-[11px] font-bold">
            <div>
              <span>تصنيف الخطورة: </span>
              <span className="text-xs font-extrabold underline mr-1">
                {submission.is_high_risk ? "معرض لخطر السقوط (خطر عالي)" : "غير معرض لخطر السقوط (خطر منخفض)"}
              </span>
            </div>
            <div className="flex gap-4">
              <span>شارة F مطبقة: <strong>{submission.f_badge_applied ? "نعم [✓]" : "لا [ ]"}</strong></span>
              <span>كرسي متحرك: <strong>{submission.wheelchair_used ? "نعم [✓]" : "لا [ ]"}</strong></span>
            </div>
          </div>

          {/* 6 Criteria Table */}
          <table className="w-full border-collapse border border-black text-right text-[10px]">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-black">
                <th className="border border-black p-2 w-[75%]">عامل ومحدد الخطورة (Screening Parameter)</th>
                <th className="border border-black p-2 text-center w-[25%]">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "1. اضطراب في المشي / عدم اتزان (Gait disturbance / unsteadiness)", val: submission.gait_disturbance },
                { label: "2. استخدام وسائل مساعدة كالعصا أو العكاز أو المشاية (Mobility aids)", val: submission.use_mobility_aids },
                { label: "3. ملازم للفراش (Bed-ridden patient)", val: submission.bed_ridden },
                { label: "4. إعاقة ذهنية أو تشوش في درجة الوعي (Mental impairment / confusion)", val: submission.mental_disability },
                { label: "5. ضعف شديد في الحواس كالرؤية أو السمع (Severe sensory impairment)", val: submission.sensory_impairment },
                { label: "6. طفل أقل من 15 عاماً (Child under 15 years)", val: submission.child_under_15 },
              ].map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-2 font-medium">{item.label}</td>
                  <td className="border border-black p-2 text-center font-bold">
                    {item.val ? "☒ نعم" : "☐ لا"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border border-black p-2 bg-slate-50 text-[10px]">
            <span className="font-bold">الإجراء التمريضي المتخذ: </span>
            <span>
              {submission.is_high_risk
                ? "المريض معرض لخطر السقوط: تم تفعيل شارة F واتخاذ التدابير الوقائية اللازمة ومرافقة المريض حتى انتهاء الفحص."
                : "المريض غير معرض لخطر السقوط: لا يتطلب شارة F مع استمرار الملاحظة العامة."}
            </span>
          </div>

          <PrintSignatureBlock
            footerCode="TRC.MRS"
            signatures={[
              {
                roleTitle: "توقيع القائم بالمسح المبدئي",
                name: submission.screener_signature,
              },
            ]}
          />
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. ADULT FALL RISK (HENDRICH II) (TRC-ICD)                     */}
      {/* ============================================================== */}
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
          <div className="space-y-3">
            <PrintHeader
              code="TRC-ICD"
              titleAr="مقياس مخاطر السقوط للكبار (نموذج هندريش الثاني)"
              titleEn="Hendrich II Fall Risk Assessment Model"
              submission={submission}
            />

            {isDirect ? (
              <div className="border-2 border-black p-3 space-y-2 bg-slate-50">
                <div className="font-bold text-center underline text-[11px]">
                  عالي الخطورة مباشرة دون تقييم رقمي (Direct High Risk Criteria)
                </div>
                <table className="w-full border-collapse border border-black text-right text-[10px] mt-2">
                  <tbody>
                    <tr>
                      <td className="border border-black p-2 w-[50%]">
                        {(submission.bed_ridden || submission.direct_factors?.bed_ridden) ? "■" : "□"} مريض ملازم للفراش (Bed-ridden)
                      </td>
                      <td className="border border-black p-2 w-[50%]">
                        {(submission.physical_disability || submission.direct_factors?.physical_disability) ? "■" : "□"} وجود إعاقة جسدية (Physical disability)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2">
                        {(submission.anesthesia_first_24h || submission.direct_factors?.anesthesia_first_24h) ? "■" : "□"} مريض في أول 24 ساعة من التخدير
                      </td>
                      <td className="border border-black p-2">
                        {(submission.mental_disability || submission.direct_factors?.mental_disability) ? "■" : "□"} وجود إعاقة ذهنية أو تشوش وعي
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center border-2 border-black p-2 bg-slate-50 text-[11px] font-bold">
                  <span>مجموع النقاط المحسوبة: <strong className="font-mono text-xs">{submission.total_score || 0}</strong> نقطة</span>
                  <span>
                    مستوى الخطورة:{" "}
                    <span className="underline">
                      {submission.is_high_risk || (submission.total_score >= 5) ? "خطر عالي للسقوط (High Risk ≥ 5)" : "خطر منخفض للسقوط (Low Risk < 5)"}
                    </span>
                  </span>
                </div>

                <table className="w-full border-collapse border border-black text-right text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-black">
                      <th className="border border-black p-1.5 w-[75%]">عامل الخطر (Risk Factor)</th>
                      <th className="border border-black p-1.5 text-center w-[25%]">النقاط المستحقة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "الارتباك / التشوش (Confusion / Disorientation)", pts: submission.confusion_disorientation_score, max: "+4" },
                      { name: "الاكتئاب المصحوب بأعراض (Symptomatic Depression)", pts: submission.symptomatic_depression_score, max: "+2" },
                      { name: "تغير في وظائف الإخراج (Altered Elimination)", pts: submission.altered_elimination_score, max: "+1" },
                      { name: "الدوار / الدوخة وفقد التوازن (Dizziness / Vertigo)", pts: submission.dizziness_vertigo_score, max: "+1" },
                      { name: "الجنس: ذكر (Male Gender)", pts: submission.male_gender_score, max: "+1" },
                      { name: "أدوية الصرع والمهدئات (Antiepileptics / Sedatives)", pts: submission.antiepileptics_sedatives_score, max: "+2" },
                      { name: "مضادات الاكتئاب (Antidepressants)", pts: submission.antidepressants_score, max: "+1" },
                      { name: "اختبار النهوض والجلوس (Get Up and Go Test)", pts: submission.get_up_and_go_score, max: "+0 to +4" },
                    ].map((row, idx) => (
                      <tr key={idx}>
                        <td className="border border-black p-1.5">{row.name}</td>
                        <td className="border border-black p-1.5 text-center font-bold font-mono">
                          +{row.pts || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Interventions */}
            {submission.interventions && submission.interventions.length > 0 && (
              <div className="border border-black p-2 bg-slate-50 text-[10px]">
                <div className="font-bold underline mb-1">الاحتياطات التمريضية المطبقة لمنع السقوط:</div>
                <div>{submission.interventions.join(" — ")}</div>
              </div>
            )}

            <PrintSignatureBlock
              footerCode="TRC-ICD"
              signatures={[
                {
                  roleTitle: "توقيع القائم بالتقييم التمريضي",
                  name: submission.assessor_signature || submission.nurse_signature,
                },
              ]}
            />
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* 5. PEDIATRIC FALL RISK (HUMPTY DUMPTY) (TRC.ICD)               */}
      {/* ============================================================== */}
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
          <div className="space-y-3">
            <PrintHeader
              code="TRC.ICD"
              titleAr="مقياس مخاطر سقوط الأطفال (هامبتي دامبتي)"
              titleEn="Humpty Dumpty Pediatric Fall Risk Scale"
              submission={submission}
            />

            {isDirect ? (
              <div className="border-2 border-black p-3 space-y-2 bg-slate-50">
                <div className="font-bold text-center underline text-[11px]">
                  عالي الخطورة مباشرة دون تقييم رقمي (Direct High Risk Criteria)
                </div>
                <table className="w-full border-collapse border border-black text-right text-[10px] mt-2">
                  <tbody>
                    <tr>
                      <td className="border border-black p-2 w-[50%]">
                        {(submission.critical_unit || submission.direct_factors?.critical_unit) ? "■" : "□"} مرضى الرعاية والعمليات (Critical Units)
                      </td>
                      <td className="border border-black p-2 w-[50%]">
                        {(submission.bed_ridden || submission.direct_factors?.bed_ridden) ? "■" : "□"} ملازم الفراش (Bed Ridden)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2">
                        {(submission.mental_disability || submission.direct_factors?.mental_disability) ? "■" : "□"} إعاقة ذهنية (Mental Disability)
                      </td>
                      <td className="border border-black p-2">
                        {(submission.anesthesia_48h || submission.direct_factors?.anesthesia_48h) ? "■" : "□"} تخدير خلال 48 ساعة (Anaesthesia ≤48h)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2">
                        {(submission.physical_disability || submission.direct_factors?.physical_disability) ? "■" : "□"} إعاقة جسدية (Physical Disability)
                      </td>
                      <td className="border border-black p-2">
                        {(submission.neonate || submission.direct_factors?.neonate) ? "■" : "□"} حديث ولادة (Neonate)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center border-2 border-black p-2 bg-slate-50 text-[11px] font-bold">
                  <span>مجموع النقاط: <strong className="font-mono text-xs">{submission.total_score || 0}</strong> نقطة</span>
                  <span>مستوى الخطورة: <span className="underline">{submission.risk_level || (submission.total_score >= 12 ? "عالي الخطورة (≥12)" : "منخفض الخطورة (7-11)")}</span></span>
                </div>

                <table className="w-full border-collapse border border-black text-right text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-black">
                      <th className="border border-black p-1.5 w-[75%]">البند التقييمي (Humpty Dumpty Parameter)</th>
                      <th className="border border-black p-1.5 text-center w-[25%]">النقاط المستحقة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "1. العمر (Age Criteria)", score: submission.age_score },
                      { label: "2. الجنس (Gender)", score: submission.gender_score },
                      { label: "3. التشخيص الطبي (Diagnosis)", score: submission.diagnosis_score },
                      { label: "4. الخلل المعرفي (Cognitive Impairment)", score: submission.cognitive_score },
                      { label: "5. العوامل البيئية (Environmental Factors)", score: submission.environmental_score },
                      { label: "6. الجراحة / التخدير / التهدئة (Surgery / Sedation / Anaesthesia)", score: submission.surgery_anesthesia_score },
                      { label: "7. استخدام الأدوية ذات الخطورة (Medication Usage)", score: submission.medications_score },
                    ].map((row, idx) => (
                      <tr key={idx}>
                        <td className="border border-black p-1.5">{row.label}</td>
                        <td className="border border-black p-1.5 text-center font-bold font-mono">
                          +{row.score || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <PrintSignatureBlock
              footerCode="TRC.ICD"
              signatures={[
                {
                  roleTitle: "توقيع التمريض القائم بالتقييم",
                  name: submission.nurse_signature,
                },
              ]}
            />
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* 6. COMPREHENSIVE PATIENT ASSESSMENT (TRC-ICD)                  */}
      {/* ============================================================== */}
      {submission.formType === "assessment" && (
        <div className="space-y-2.5">
          <PrintHeader
            code="TRC-ICD"
            titleAr="نموذج تقييم المريض الشامل"
            titleEn="Comprehensive Patient Assessment Form"
            submission={submission}
            extraPatientRow={
              <tr>
                <td className="border border-black p-1.5 font-bold bg-slate-50">الطبيب المعالج:</td>
                <td className="border border-black p-1.5">{submission.attending_physician || "-"} {submission.physician_phone ? `(${submission.physician_phone})` : ""}</td>
                <td className="border border-black p-1.5 font-bold bg-slate-50">الإجراء الطبي:</td>
                <td className="border border-black p-1.5 font-bold">{submission.procedure_name || "-"}</td>
              </tr>
            }
          />

          {/* Section 1: Vital Signs Matrix */}
          <div className="border border-black p-2">
            <div className="font-bold underline text-[10px] mb-1.5 text-slate-800">العلامات الحيوية والقياسات الفيزيائية (Vital Signs & Measurements):</div>
            <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
              <div className="border border-black p-1 bg-slate-50/50">
                <span className="text-slate-500 block text-[9px]">ضغط الدم (BP)</span>
                <strong className="font-mono text-xs">{submission.blood_pressure || "-"}</strong>
              </div>
              <div className="border border-black p-1 bg-slate-50/50">
                <span className="text-slate-500 block text-[9px]">النبض (Pulse)</span>
                <strong className="font-mono text-xs">{submission.heart_rate ? `${submission.heart_rate} bpm` : "-"}</strong>
              </div>
              <div className="border border-black p-1 bg-slate-50/50">
                <span className="text-slate-500 block text-[9px]">الحرارة (Temp)</span>
                <strong className="font-mono text-xs">{submission.temperature ? `${submission.temperature} °C` : "-"}</strong>
              </div>
              <div className="border border-black p-1 bg-slate-50/50">
                <span className="text-slate-500 block text-[9px]">الأكسجين (SpO2)</span>
                <strong className="font-mono text-xs">{submission.oxygen_saturation ? `${submission.oxygen_saturation}%` : "-"}</strong>
              </div>
              <div className="border border-black p-1 bg-slate-50/50">
                <span className="text-slate-500 block text-[9px]">معدل التنفس (RR)</span>
                <strong className="font-mono text-xs">{submission.respiratory_rate ? `${submission.respiratory_rate}/min` : "-"}</strong>
              </div>
              <div className="border border-black p-1 bg-slate-50/50">
                <span className="text-slate-500 block text-[9px]">الوزن (Weight)</span>
                <strong className="font-mono text-xs">{submission.weight_kg ? `${submission.weight_kg} kg` : "-"}</strong>
              </div>
              <div className="border border-black p-1 bg-slate-50/50">
                <span className="text-slate-500 block text-[9px]">الطول (Height)</span>
                <strong className="font-mono text-xs">{submission.height_cm ? `${submission.height_cm} cm` : "-"}</strong>
              </div>
              <div className="border border-black p-1 bg-slate-50/50">
                <span className="text-slate-500 block text-[9px]">الحالة الحركية</span>
                <strong className="text-xs">{submission.mobility_status || "-"}</strong>
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Assessment & Risks */}
          <div className="border border-black p-2 space-y-1.5 text-[10px]">
            <div className="font-bold underline mb-1 text-slate-800">التشخيص والتاريخ المرضي والمخاطر السريرية (Clinical Assessment & Risks):</div>
            
            <div className="grid grid-cols-2 gap-2">
              <div><span className="font-bold">التشخيص الطبي:</span> {submission.diagnosis || "-"}</div>
              <div><span className="font-bold">التاريخ المرضي والجراحي:</span> {submission.medical_surgical_history || "لا يوجد"}</div>
            </div>

            <div className="pt-1 border-t border-slate-300">
              <span className="font-bold">الحساسية والمخاطر السريرية: </span>
              <span>
                {(submission.allergy_types && submission.allergy_types.length > 0)
                  ? `${submission.allergy_types.join("، ")} ${submission.allergy_details ? `(${submission.allergy_details})` : ""}`
                  : "لا توجد حساسية مسجلة"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 pt-1 border-t border-slate-300 text-[9px]">
              <div>أمراض الكلى: <strong>{submission.kidney_disease ? `نعم (${submission.kidney_disease_details || ""})` : "لا"}</strong></div>
              <div>أمراض القلب: <strong>{submission.heart_disease ? `نعم (${submission.heart_disease_details || ""})` : "لا"}</strong></div>
              <div>مضادات التجلط: <strong>{submission.anticoagulants ? `نعم (${submission.anticoagulants_details || ""})` : "لا"}</strong></div>
              <div>منظم ضربات قلب: <strong>{submission.pacemaker ? "نعم" : "لا"}</strong></div>
              <div>مشبك تمدد أوعية: <strong>{submission.aneurysm_clip ? "نعم" : "لا"}</strong></div>
              <div>نقص المناعة: <strong>{submission.immunocompromised ? "نعم" : "لا"}</strong></div>
              <div>الحالة النفسية: <strong>{submission.psychological_status || "طبيعية"}</strong></div>
              <div>الحالة الذهنية: <strong>{submission.mental_status || "طبيعي"}</strong></div>
            </div>

            {/* Labs if present */}
            {(submission.lab_gfr || submission.lab_creatinine || submission.lab_urea || submission.lab_bun || submission.lab_sodium || submission.lab_potassium) && (
              <div className="pt-1 border-t border-slate-300 grid grid-cols-6 gap-1 text-center font-mono text-[9px]">
                <div className="border border-black p-0.5">GFR: <strong>{submission.lab_gfr || "-"}</strong></div>
                <div className="border border-black p-0.5">Creatinine: <strong>{submission.lab_creatinine || "-"}</strong></div>
                <div className="border border-black p-0.5">BUN: <strong>{submission.lab_bun || "-"}</strong></div>
                <div className="border border-black p-0.5">Urea: <strong>{submission.lab_urea || "-"}</strong></div>
                <div className="border border-black p-0.5">Sodium: <strong>{submission.lab_sodium || "-"}</strong></div>
                <div className="border border-black p-0.5">Potassium: <strong>{submission.lab_potassium || "-"}</strong></div>
              </div>
            )}
          </div>

          {/* Section 3: Plan of Care (3 Items) */}
          {submission.plan_of_care && Array.isArray(submission.plan_of_care) && submission.plan_of_care.length > 0 && (
            <div className="border border-black p-2">
              <div className="font-bold underline text-[10px] mb-1.5 text-slate-800">خطة الرعاية التمريضية والتصوير الطبي (Plan of Care):</div>
              <table className="w-full border-collapse border border-black text-right text-[10px]">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-black">
                    <th className="border border-black p-1.5 w-[25%]">المشكلة التمريضية / الطبية</th>
                    <th className="border border-black p-1.5 w-[20%]">الأهداف المتوقعة</th>
                    <th className="border border-black p-1.5 w-[37%]">التدخلات والاجراءات المقررة</th>
                    <th className="border border-black p-1.5 text-center w-[18%]">التقييم والاعتماد</th>
                  </tr>
                </thead>
                <tbody>
                  {submission.plan_of_care.map((p: any, i: number) => {
                    const interventionsText = p.intervention || (Array.isArray(p.interventions) && p.interventions.length > 0 ? p.interventions.join(" — ") : "-");
                    return (
                      <tr key={i}>
                        <td className="border border-black p-1.5 font-bold">{p.problem || "-"}</td>
                        <td className="border border-black p-1.5">{p.goal || "-"}</td>
                        <td className="border border-black p-1.5 text-[9px] leading-snug">{interventionsText}</td>
                        <td className="border border-black p-1.5 text-center">
                          <div className="font-bold">{p.evaluation || "مستقر"}</div>
                          {p.confirmed_by && (
                            <div className="text-[9px] text-slate-700 font-mono mt-0.5">
                              ✓ {p.confirmed_by}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 4: Tri-Signatures Matrix */}
          <PrintSignatureBlock
            footerCode="TRC-ICD"
            signatures={[
              {
                roleTitle: "توقيع التمريض (Nurse Signature)",
                name: submission.nurse_signature,
              },
              {
                roleTitle: "توقيع فني الأشعة (Technician Signature)",
                name: submission.tech_signature,
              },
              {
                roleTitle: "توقيع طبيب الأشعة (Radiologist Signature)",
                name: submission.physician_signature,
              },
            ]}
          />
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. PATIENT TRANSFER (RSTP) (TRC.ACT)                           */}
      {/* ============================================================== */}
      {submission.formType === "transfer" && (
        <div className="space-y-3">
          <PrintHeader
            code="TRC.ACT"
            titleAr="نموذج نقل المريض — بروتوكول النقل التخصصي للأشعة"
            titleEn="Radiology Specialized Transport Protocol (RSTP)"
            submission={submission}
            extraPatientRow={
              <tr>
                <td className="border border-black p-1.5 font-bold bg-slate-50">مسار النقل:</td>
                <td className="border border-black p-1.5" colSpan={3}>
                  من: <strong className="ml-2">{submission.from_location || "-"}</strong> ➔ إلى: <strong className="mr-2">{submission.to_location || "-"}</strong>
                </td>
              </tr>
            }
          />

          {/* RSTP Summary Banner */}
          <div className="border-2 border-black p-2.5 bg-slate-50 flex justify-between items-center text-[11px] font-bold">
            <div>
              <span>معدل الخطر الإجمالي (RSTP Score): </span>
              <strong className="font-mono text-sm underline mr-1">{submission.total_rstp_score || 0} نقطة</strong>
            </div>
            <div>المجموعة: <span className="underline">{submission.group_code || "-"}</span></div>
            <div>وسيلة النقل: <span>{submission.recommended_vehicle || "-"}</span></div>
            <div>طاقم النقل: <span>{submission.recommended_staff || "-"}</span></div>
          </div>

          {/* 11 Parameters Table */}
          <div className="border border-black p-2">
            <div className="font-bold underline text-[11px] mb-1.5">معدل الخطر الفسيولوجي عند نقل المريض (RSTP Parameters):</div>
            <div className="grid grid-cols-2 gap-1.5 text-[9px]">
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
                <div key={p.id} className="border border-black p-1 flex justify-between items-center bg-slate-50/50">
                  <span>{p.title_ar} ({p.title_en})</span>
                  <span className="font-bold font-mono text-xs">+{submission[p.id] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Safety Checklist */}
          {submission.safety_checklist && Object.keys(submission.safety_checklist).length > 0 && (
            <div className="border border-black p-2 text-[10px]">
              <div className="font-bold underline mb-1">متطلبات الأمان والتأكيد (Safety Checklist):</div>
              <table className="w-full border-collapse border border-black text-right text-[9px]">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-black">
                    <th className="border border-black p-1 w-[80%]">البند التجهيزي</th>
                    <th className="border border-black p-1 text-center w-[20%]">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(submission.safety_checklist).map(([item, val]) => (
                    <tr key={item}>
                      <td className="border border-black p-1">{item}</td>
                      <td className="border border-black p-1 text-center font-bold">
                        {val === true || val === "نعم" || val === "جاهز" || val === "مكتمل" ? "✓ مكتمل وجاهز" : String(val) || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {submission.transfer_instructions && (
            <div className="border border-black p-2 bg-slate-50 text-[10px]">
              <div className="font-bold underline mb-0.5">تعليمات واحتياطات النقل:</div>
              <p className="leading-relaxed">{submission.transfer_instructions}</p>
            </div>
          )}

          <PrintSignatureBlock
            footerCode="TRC.ACT"
            signatures={[
              {
                roleTitle: "توقيع واعتماد طبيب الأشعة المسؤول",
                name: submission.receiving_physician_signature || submission.physician_signature,
              },
              {
                roleTitle: "توقيع واستلام التمريض المرافق",
                name: submission.receiving_nurse_signature || submission.nurse_signature,
              },
            ]}
          />
        </div>
      )}

    </div>
  );
}
