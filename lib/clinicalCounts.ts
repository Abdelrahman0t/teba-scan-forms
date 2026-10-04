import { SupabaseClient } from "@supabase/supabase-js";

export interface ClinicalCounts {
  patients: number;
  totalSubmissions: number;
  todaySubmissions: number;
  byRoute: Record<string, number>;
  byFormId: Record<string, number>;
  byTable: {
    fall_risk_screenings: number;
    patient_assessments: number;
    fall_risk_adult_assessments: number;
    fall_risk_pediatric_assessments: number;
    patient_transfers: number;
    health_education_assessments: number;
    radiation_exposure_logs: number;
  };
}

export const CLINICAL_FORM_TABLE_MAPPINGS = [
  { formId: "fall_screen", route: "/forms/fall-risk-screening", table: "fall_risk_screenings", label: "مسح مخاطر السقوط" },
  { formId: "assessment", route: "/forms/patient-assessment", table: "patient_assessments", label: "التقييم الشامل للمريض" },
  { formId: "fall_adult", route: "/forms/fall-risk-adult", table: "fall_risk_adult_assessments", label: "سقوط الكبار (Hendrich II)" },
  { formId: "fall_ped", route: "/forms/fall-risk-pediatric", table: "fall_risk_pediatric_assessments", label: "سقوط الأطفال (Humpty Dumpty)" },
  { formId: "transfer", route: "/forms/patient-transfer", table: "patient_transfers", label: "نقل المريض (RSTP)" },
  { formId: "edu", route: "/forms/patient-education", table: "health_education_assessments", label: "التثقيف الصحي للأسرة" },
  { formId: "rad", route: "/forms/radiation-exposure", table: "radiation_exposure_logs", label: "جرعات الأشعة" },
] as const;

/**
 * Fetches the EXACT total counts of patients and all 7 submitted clinical models
 * using fast HEAD requests (no payload, instant response).
 */
export async function fetchExactClinicalCounts(supabase: SupabaseClient): Promise<ClinicalCounts> {
  const todayStr = new Date().toISOString().split("T")[0];

  const [
    pRes,
    fsRes,
    paRes,
    faRes,
    fpRes,
    ptRes,
    heRes,
    reRes,
    // Today counts
    fsToday,
    paToday,
    faToday,
    fpToday,
    ptToday,
    heToday,
    reToday,
  ] = await Promise.all([
    supabase.from("patients").select("*", { count: "exact", head: true }),
    supabase.from("fall_risk_screenings").select("*", { count: "exact", head: true }),
    supabase.from("patient_assessments").select("*", { count: "exact", head: true }),
    supabase.from("fall_risk_adult_assessments").select("*", { count: "exact", head: true }),
    supabase.from("fall_risk_pediatric_assessments").select("*", { count: "exact", head: true }),
    supabase.from("patient_transfers").select("*", { count: "exact", head: true }),
    supabase.from("health_education_assessments").select("*", { count: "exact", head: true }),
    supabase.from("radiation_exposure_logs").select("*", { count: "exact", head: true }),
    // Today
    supabase.from("fall_risk_screenings").select("*", { count: "exact", head: true }).gte("created_at", `${todayStr}T00:00:00.000Z`),
    supabase.from("patient_assessments").select("*", { count: "exact", head: true }).gte("created_at", `${todayStr}T00:00:00.000Z`),
    supabase.from("fall_risk_adult_assessments").select("*", { count: "exact", head: true }).gte("created_at", `${todayStr}T00:00:00.000Z`),
    supabase.from("fall_risk_pediatric_assessments").select("*", { count: "exact", head: true }).gte("created_at", `${todayStr}T00:00:00.000Z`),
    supabase.from("patient_transfers").select("*", { count: "exact", head: true }).gte("created_at", `${todayStr}T00:00:00.000Z`),
    supabase.from("health_education_assessments").select("*", { count: "exact", head: true }).gte("created_at", `${todayStr}T00:00:00.000Z`),
    supabase.from("radiation_exposure_logs").select("*", { count: "exact", head: true }).gte("created_at", `${todayStr}T00:00:00.000Z`),
  ]);

  const byTable = {
    fall_risk_screenings: fsRes.count || 0,
    patient_assessments: paRes.count || 0,
    fall_risk_adult_assessments: faRes.count || 0,
    fall_risk_pediatric_assessments: fpRes.count || 0,
    patient_transfers: ptRes.count || 0,
    health_education_assessments: heRes.count || 0,
    radiation_exposure_logs: reRes.count || 0,
  };

  const byRoute: Record<string, number> = {
    "/forms/fall-risk-screening": byTable.fall_risk_screenings,
    "/forms/patient-assessment": byTable.patient_assessments,
    "/forms/fall-risk-adult": byTable.fall_risk_adult_assessments,
    "/forms/fall-risk-pediatric": byTable.fall_risk_pediatric_assessments,
    "/forms/patient-transfer": byTable.patient_transfers,
    "/forms/patient-education": byTable.health_education_assessments,
    "/forms/radiation-exposure": byTable.radiation_exposure_logs,
  };

  const byFormId: Record<string, number> = {
    fall_screen: byTable.fall_risk_screenings,
    assessment: byTable.patient_assessments,
    fall_adult: byTable.fall_risk_adult_assessments,
    fall_ped: byTable.fall_risk_pediatric_assessments,
    transfer: byTable.patient_transfers,
    edu: byTable.health_education_assessments,
    rad: byTable.radiation_exposure_logs,
  };

  const totalSubmissions = Object.values(byTable).reduce((acc, c) => acc + c, 0);

  const todaySubmissions =
    (fsToday.count || 0) +
    (paToday.count || 0) +
    (faToday.count || 0) +
    (fpToday.count || 0) +
    (ptToday.count || 0) +
    (heToday.count || 0) +
    (reToday.count || 0);

  return {
    patients: pRes.count || 0,
    totalSubmissions,
    todaySubmissions,
    byRoute,
    byFormId,
    byTable,
  };
}
