import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side search / filtering / keyset pagination for the 7 clinical models
 * and the patients registry. Backed by the RPCs in supabase_clinical_records.sql.
 */

export const RECORDS_PAGE_SIZE = 200;

export type ClinicalFormType =
  | "radiation"
  | "education"
  | "fall_screen"
  | "fall_adult"
  | "fall_ped"
  | "assessment"
  | "transfer";

export const CLINICAL_FORM_TYPES: ClinicalFormType[] = [
  "fall_screen",
  "assessment",
  "fall_adult",
  "fall_ped",
  "transfer",
  "radiation",
  "education",
];

export type RecordStatusFilter = "all" | "pending_my_role" | "incomplete" | "complete";

export interface RecordsQuery {
  formType?: ClinicalFormType | "all";
  status?: RecordStatusFilter;
  role?: string | null;
  isAdmin?: boolean;
  search?: string;
  from?: string | null;
  patientId?: string | null;
}

export interface KeysetCursor {
  sortAt: string;
  id: string;
}

export interface ClinicalRecordRow {
  formType: ClinicalFormType;
  id: string;
  createdAt: string;
  missingRoles: string[];
  record: any;
  patient: { id: string; full_name: string; mrn: string; age: number | null; gender: string | null } | null;
}

export interface StatusCounts {
  total: number;
  complete: number;
  incomplete: number;
  pending_my_role: number;
}

export type RecordsSummary = Record<ClinicalFormType, StatusCounts>;

/** Thrown when the SQL migration (supabase_clinical_records.sql) has not been applied yet. */
export class MissingMigrationError extends Error {
  constructor() {
    super("Database functions missing: run supabase_clinical_records.sql in the Supabase SQL editor.");
  }
}

function rpcError(error: any): Error {
  // PGRST202 = function not found in schema cache
  if (error?.code === "PGRST202" || error?.code === "42883") return new MissingMigrationError();
  return new Error(error?.message || "Unknown database error");
}

function roleParam(q: RecordsQuery): string | null {
  return q.isAdmin ? "admin" : q.role || null;
}

function searchParam(q: RecordsQuery): string | null {
  const s = q.search?.trim();
  return s ? s : null;
}

// Supabase's API caps every response (RPCs included) at 1000 rows by default.
const MAX_ROWS_PER_REQUEST = 1000;

/**
 * Fetches `limit` rows after `cursor`, splitting into several keyset requests when the
 * limit exceeds the API row cap. `nextCursor` is null once the end has been reached.
 */
async function fetchKeyset<T>(
  limit: number,
  cursor: KeysetCursor | null,
  fetchChunk: (cursor: KeysetCursor | null, chunk: number) => Promise<T[]>,
  cursorOf: (row: T) => KeysetCursor
): Promise<{ rows: T[]; nextCursor: KeysetCursor | null }> {
  const rows: T[] = [];
  let cur = cursor;
  while (rows.length < limit) {
    const chunk = Math.min(limit - rows.length, MAX_ROWS_PER_REQUEST);
    const got = await fetchChunk(cur, chunk);
    rows.push(...got);
    if (got.length < chunk) return { rows, nextCursor: null };
    cur = cursorOf(got[got.length - 1]);
  }
  return { rows, nextCursor: cur };
}

export async function fetchClinicalRecordsPage(
  supabase: SupabaseClient,
  q: RecordsQuery,
  opts: { cursor?: KeysetCursor | null; limit?: number } = {}
): Promise<{ rows: ClinicalRecordRow[]; nextCursor: KeysetCursor | null }> {
  return fetchKeyset<ClinicalRecordRow>(
    opts.limit ?? RECORDS_PAGE_SIZE,
    opts.cursor ?? null,
    async (cursor, chunk) => {
      const { data, error } = await supabase.rpc("list_clinical_records", {
        p_form_type: q.formType && q.formType !== "all" ? q.formType : null,
        p_status: q.status || "all",
        p_role: roleParam(q),
        p_search: searchParam(q),
        p_from: q.from || null,
        p_patient_id: q.patientId || null,
        p_cursor_created_at: cursor?.sortAt ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: chunk,
      });
      if (error) throw rpcError(error);
      return (data || []).map((r: any) => ({
        formType: r.form_type,
        id: r.id,
        createdAt: r.created_at,
        missingRoles: r.missing_roles || [],
        record: r.record || {},
        patient: r.patient,
      }));
    },
    (r) => ({ sortAt: r.createdAt, id: r.id })
  );
}

export function emptySummary(): RecordsSummary {
  const s = {} as RecordsSummary;
  for (const t of CLINICAL_FORM_TYPES) s[t] = { total: 0, complete: 0, incomplete: 0, pending_my_role: 0 };
  return s;
}

export async function fetchClinicalRecordsSummary(
  supabase: SupabaseClient,
  q: RecordsQuery
): Promise<RecordsSummary> {
  const { data, error } = await supabase.rpc("clinical_records_summary", {
    p_role: roleParam(q),
    p_search: searchParam(q),
    p_from: q.from || null,
    p_patient_id: q.patientId || null,
  });
  if (error) throw rpcError(error);

  const summary = emptySummary();
  for (const r of data || []) {
    if (!summary[r.form_type as ClinicalFormType]) continue;
    summary[r.form_type as ClinicalFormType] = {
      total: Number(r.total) || 0,
      complete: Number(r.complete) || 0,
      incomplete: Number(r.incomplete) || 0,
      pending_my_role: Number(r.pending_my_role) || 0,
    };
  }
  return summary;
}

/** Sums one status bucket across the given form types ("all" = every type). */
export function sumSummary(
  summary: RecordsSummary,
  formType: ClinicalFormType | "all",
  status: RecordStatusFilter
): number {
  const key: keyof StatusCounts = status === "all" ? "total" : status;
  const types = formType === "all" ? CLINICAL_FORM_TYPES : [formType];
  return types.reduce((acc, t) => acc + (summary[t]?.[key] || 0), 0);
}

export interface PatientWithActivity {
  id: string;
  mrn: string;
  full_name: string;
  gender: string | null;
  age: number | null;
  phone: string | null;
  created_at: string;
  submissionsCount: number;
  latestActivity: string | null;
  sortAt: string;
}

export async function fetchPatientsPage(
  supabase: SupabaseClient,
  search: string,
  opts: { cursor?: KeysetCursor | null; limit?: number } = {}
): Promise<{ rows: PatientWithActivity[]; nextCursor: KeysetCursor | null; total: number | null }> {
  let total: number | null = null;
  const page = await fetchKeyset<PatientWithActivity>(
    opts.limit ?? RECORDS_PAGE_SIZE,
    opts.cursor ?? null,
    async (cursor, chunk) => {
      const { data, error } = await supabase.rpc("list_patients_with_activity", {
        p_search: search.trim() || null,
        p_cursor_sort_at: cursor?.sortAt ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: chunk,
      });
      if (error) throw rpcError(error);
      // total_count is computed before the cursor is applied, so it is the full match count
      if (total === null && data && data.length > 0) total = Number(data[0].total_count);
      return (data || []).map((p: any) => ({
        id: p.id,
        mrn: p.mrn,
        full_name: p.full_name,
        gender: p.gender,
        age: p.age,
        phone: p.phone,
        created_at: p.created_at,
        submissionsCount: Number(p.submissions_count) || 0,
        latestActivity: p.latest_activity,
        sortAt: p.sort_at,
      }));
    },
    (p) => ({ sortAt: p.sortAt, id: p.id })
  );
  return { ...page, total };
}

/**
 * Applies the per-model display normalisation (education fallbacks, fall-risk levels,
 * assessment plan-of-care signatures) that both the submissions and patients pages need.
 */
export function normalizeRecordData(formType: ClinicalFormType, raw: any): any {
  if (formType === "education") {
    const subData = raw.form_submissions?.data || {};
    const createdDate = raw.created_at ? raw.created_at.split("T")[0] : "";
    const createdTime = raw.created_at && raw.created_at.includes("T") ? raw.created_at.split("T")[1].slice(0, 5) : "";
    return {
      ...raw,
      education_date: raw.education_date || subData.education_date || createdDate,
      education_time: raw.education_time || subData.education_time || createdTime,
      educator_signature: raw.educator_signature || raw.nurse_signature || subData.educator_name || raw.health_education_topic_entries?.[0]?.educator_name || "-",
      procedure_location: raw.procedure_location || subData.procedure_location || "-",
    };
  }

  if (formType === "fall_adult") {
    const isHighRisk = Boolean(
      raw.is_high_risk ||
      raw.bed_ridden ||
      raw.physical_disability ||
      raw.mental_disability ||
      raw.anesthesia_first_24h ||
      raw.direct_factors?.bed_ridden ||
      raw.direct_factors?.physical_disability ||
      raw.direct_factors?.mental_disability ||
      raw.direct_factors?.anesthesia_first_24h ||
      (raw.total_score >= 5)
    );
    return { ...raw, risk_level: raw.risk_level || (isHighRisk ? "عالية المخاطر" : "منخفض المخاطر") };
  }

  if (formType === "fall_ped") {
    const isHighRisk = Boolean(
      raw.is_high_risk ||
      raw.bed_ridden ||
      raw.critical_unit ||
      raw.anesthesia_48h ||
      raw.mental_disability ||
      raw.neonate ||
      raw.physical_disability ||
      (raw.total_score >= 12)
    );
    return {
      ...raw,
      risk_level: raw.risk_level || (isHighRisk ? "عالية المخاطر" : ((raw.total_score || 0) >= 7 ? "متوسط المخاطر" : "منخفض المخاطر")),
    };
  }

  if (formType === "assessment") {
    const rawPlans = Array.isArray(raw.plan_of_care) ? raw.plan_of_care : [];
    const plans = rawPlans.map((p: any) => ({
      ...p,
      time_frame: (!p?.time_frame || p?.time_frame === "15 دقيقة" || p?.time_frame === "30 دقيقة") ? "5 دقائق" : p.time_frame,
    }));
    const techPlan = plans.find((p: any) =>
      !p?.responsible?.some((r: string) => r?.includes("طبيب") || r?.includes("أخصائي")) &&
      (
        p?.responsible?.includes("فني الأشعة") ||
        p?.problem?.includes("السلامة والجرعة") ||
        p?.interventions?.some((i: string) => i?.includes("جرعة الإشعاع") || i?.includes("دليل الاجراءات"))
      )
    );
    const docPlan = plans.find((p: any) =>
      p?.responsible?.includes("أخصائي الأشعة") ||
      p?.responsible?.includes("طبيب الأشعة") ||
      p?.interventions?.some((i: string) => i?.includes("فوائد ومخاطر")) ||
      (p?.problem?.includes("التصوير") && !p?.problem?.includes("السلامة والجرعة"))
    );
    const resolvedDocSig = raw.physician_signature || docPlan?.confirmed_by || null;
    const resolvedTechSig = techPlan?.confirmed_by || (raw.tech_signature && raw.tech_signature !== resolvedDocSig ? raw.tech_signature : null) || null;
    return { ...raw, plan_of_care: plans, physician_signature: resolvedDocSig, tech_signature: resolvedTechSig };
  }

  return raw;
}

/** Appends rows that are not already in the list (by key). */
export function appendUnique<T>(existing: T[], incoming: T[], key: (item: T) => string): T[] {
  const seen = new Set(existing.map(key));
  return [...existing, ...incoming.filter((x) => !seen.has(key(x)))];
}
