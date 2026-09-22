export type FormStatusInfo = {
  isShared: boolean;
  isComplete: boolean;
  missingRoles: Array<"nurse" | "radiologist" | "technician">;
  missingLabels: string[];
  badgeLabel: string;
  badgeDesc: string;
};

export function getFormStatusInfo(item: any): FormStatusInfo {
  if (!item) {
    return {
      isShared: false,
      isComplete: true,
      missingRoles: [],
      missingLabels: [],
      badgeLabel: "مكتمل",
      badgeDesc: "نموذج مكتمل",
    };
  }

  // Shared Model 1: Comprehensive Patient Assessment
  if (item.formType === "assessment") {
    const plans = Array.isArray(item.plan_of_care) ? item.plan_of_care : [];
    const fallPlan = plans.find((p: any) =>
      p?.responsible?.includes("التمريض") ||
      p?.problem?.includes("السقوط")
    );
    const hasNurse = Boolean(
      (item.nurse_signature && item.nurse_signature.trim() && item.nurse_signature !== "-") ||
      (fallPlan?.confirmed_by && fallPlan.confirmed_by.trim() && fallPlan.confirmed_by !== "-")
    );

    const docPlan = plans.find((p: any) =>
      p?.responsible?.includes("أخصائي الأشعة") ||
      p?.responsible?.includes("طبيب الأشعة") ||
      p?.interventions?.some((i: string) => i?.includes("فوائد ومخاطر")) ||
      (p?.problem?.includes("التصوير") && !p?.problem?.includes("السلامة والجرعة"))
    );
    const resolvedPhysicianSig =
      (item.physician_signature && item.physician_signature.trim() && item.physician_signature !== "-" ? item.physician_signature : null) ||
      (docPlan?.confirmed_by && docPlan.confirmed_by.trim() && docPlan.confirmed_by !== "-" ? docPlan.confirmed_by : null);
    const hasPhysician = Boolean(resolvedPhysicianSig);

    const techPlan = plans.find((p: any) =>
      !p?.responsible?.some((r: string) => r?.includes("طبيب") || r?.includes("أخصائي")) &&
      (
        p?.responsible?.includes("فني الأشعة") ||
        p?.problem?.includes("السلامة والجرعة") ||
        p?.interventions?.some((i: string) => i?.includes("جرعة الإشعاع") || i?.includes("دليل الاجراءات"))
      )
    );
    const rawTech = item.tech_signature && item.tech_signature.trim() && item.tech_signature !== "-" ? item.tech_signature : null;
    const isTechDuplicateOfDoc = rawTech && resolvedPhysicianSig && rawTech === resolvedPhysicianSig;
    const resolvedTechSig =
      (techPlan?.confirmed_by && techPlan.confirmed_by.trim() && techPlan.confirmed_by !== "-" ? techPlan.confirmed_by : null) ||
      (!isTechDuplicateOfDoc ? rawTech : null);
    const hasTech = Boolean(resolvedTechSig);

    const missingRoles: Array<"nurse" | "radiologist" | "technician"> = [];
    const missingLabels: string[] = [];

    if (!hasNurse) {
      missingRoles.push("nurse");
      missingLabels.push("التمريض");
    }
    if (!hasPhysician) {
      missingRoles.push("radiologist");
      missingLabels.push("طبيب الأشعة");
    }
    if (!hasTech) {
      missingRoles.push("technician");
      missingLabels.push("فني الأشعة");
    }

    const isComplete = missingRoles.length === 0;

    return {
      isShared: true,
      isComplete,
      missingRoles,
      missingLabels,
      badgeLabel: isComplete ? "مكتمل" : "غير مكتمل",
      badgeDesc: isComplete
        ? "مكتمل (التمريض + طبيب الأشعة + فني الأشعة)"
        : `بانتظار: ${missingLabels.join(" + ")}`,
    };
  }

  // Shared Model 2: Patient Transfer (RSTP) - طبيب الأشعة + التمريض
  if (item.formType === "transfer") {
    const hasPhysician = Boolean(
      (item.receiving_physician_signature && item.receiving_physician_signature.trim() && item.receiving_physician_signature !== "-") ||
      (item.doctor_signature && item.doctor_signature.trim() && item.doctor_signature !== "-")
    );
    const hasNurse = Boolean(
      item.receiving_nurse_signature && item.receiving_nurse_signature.trim() && item.receiving_nurse_signature !== "-"
    );

    const missingRoles: Array<"nurse" | "radiologist" | "technician"> = [];
    const missingLabels: string[] = [];

    if (!hasPhysician) {
      missingRoles.push("radiologist");
      missingLabels.push("طبيب الأشعة");
    }
    if (!hasNurse) {
      missingRoles.push("nurse");
      missingLabels.push("التمريض (متطلبات الأمان)");
    }

    const isComplete = missingRoles.length === 0;

    return {
      isShared: true,
      isComplete,
      missingRoles,
      missingLabels,
      badgeLabel: isComplete ? "مكتمل" : "غير مكتمل",
      badgeDesc: isComplete
        ? "مكتمل (طبيب الأشعة + التمريض)"
        : `بانتظار: ${missingLabels.join(" + ")}`,
    };
  }

  // Shared Model 3: Patient Education
  if (item.formType === "education") {
    const entries = Array.isArray(item.health_education_topic_entries) ? item.health_education_topic_entries : [];
    const nurseTopicPrefixes = [
      "تحضير",
      "التنبيه علي السيدة",
      "السقوط",
    ];
    const techTopicPrefixes = [
      "المخاطر المحتملة",
      "بالصبغة",
      "تعليمات ما بعد الإجراء",
    ];

    const hasNurse = nurseTopicPrefixes.every(prefix =>
      entries.some((e: any) => e.topic_name?.includes(prefix) && e.is_comprehended !== null && Boolean(e.educator_name?.trim()))
    );
    const hasTech = techTopicPrefixes.every(prefix =>
      entries.some((e: any) => e.topic_name?.includes(prefix) && e.is_comprehended !== null && Boolean(e.educator_name?.trim()))
    );

    const missingRoles: Array<"nurse" | "technician"> = [];
    const missingLabels: string[] = [];

    if (!hasNurse) {
      missingRoles.push("nurse");
      missingLabels.push("التمريض (بنود 1-3)");
    }
    if (!hasTech) {
      missingRoles.push("technician");
      missingLabels.push("فني الأشعة (بنود 4-6)");
    }

    const isComplete = missingRoles.length === 0;

    return {
      isShared: true,
      isComplete,
      missingRoles,
      missingLabels,
      badgeLabel: isComplete ? "مكتمل" : "غير مكتمل",
      badgeDesc: isComplete
        ? "مكتمل (التمريض + فني الأشعة)"
        : `بانتظار: ${missingLabels.join(" + ")}`,
    };
  }

  // Single-Staff Models:
  // fall_screen, fall_adult, fall_ped, radiation
  return {
    isShared: false,
    isComplete: true,
    missingRoles: [],
    missingLabels: [],
    badgeLabel: "مكتمل",
    badgeDesc: "نموذج مكتمل",
  };
}
