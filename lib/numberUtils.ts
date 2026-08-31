import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Utility functions to convert between Eastern Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩),
 * Persian numerals (۰۱۲۳۴۵۶۷۸۹), and Western numerals (0123456789).
 */

export function normalizeArabicNumbers(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  const str = String(input);
  return str
    .replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString())
    .replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());
}

export function toEasternArabicNumbers(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  const str = String(input);
  return str.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 1632 - 48));
}

/**
 * Generates all number variants (Western, Eastern Arabic, and original) for flexible searching.
 */
export function getMrnSearchVariants(mrn: string | null | undefined): string[] {
  if (!mrn) return [];
  const raw = String(mrn).trim();
  if (!raw) return [];
  const western = normalizeArabicNumbers(raw).trim();
  const eastern = toEasternArabicNumbers(western).trim();

  const set = new Set<string>();
  if (raw) set.add(raw);
  if (western) set.add(western);
  if (eastern) set.add(eastern);
  return Array.from(set);
}

/**
 * Builds a Supabase .or() filter string matching any MRN variant or patient name.
 */
export function buildPatientSearchFilter(query: string): string {
  const clean = query.trim();
  if (!clean) return "";
  const variants = getMrnSearchVariants(clean);

  const parts: string[] = [];
  for (const v of variants) {
    parts.push(`mrn.ilike.%${v}%`);
  }
  parts.push(`full_name.ilike.%${clean}%`);

  return parts.join(",");
}

/**
 * Searches for a patient in Supabase by MRN matching any Arabic or Western digits variant.
 */
export async function findPatientByMrn(supabase: SupabaseClient, searchMrn: string): Promise<any | null> {
  const variants = getMrnSearchVariants(searchMrn);
  if (variants.length === 0) return null;

  try {
    // 1. Try exact match on any variant
    const eqCondition = variants.map((v) => `mrn.eq.${v}`).join(",");
    const { data: exactMatch } = await supabase
      .from("patients")
      .select("*")
      .or(eqCondition)
      .limit(1)
      .maybeSingle();

    if (exactMatch) return exactMatch;

    // 2. Try prefix/contains match on any variant
    const ilikeCondition = variants.map((v) => `mrn.ilike.%${v}%`).join(",");
    const { data: fuzzyMatch } = await supabase
      .from("patients")
      .select("*")
      .or(ilikeCondition)
      .limit(1)
      .maybeSingle();

    return fuzzyMatch || null;
  } catch (err) {
    console.error("findPatientByMrn error:", err);
    return null;
  }
}
