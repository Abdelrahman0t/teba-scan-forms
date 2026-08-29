/**
 * Safe Time & Date Helpers for PostgreSQL & Supabase (12-Hour System)
 */

export function getCurrentTime(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Returns current time in 12-Hour system with Arabic period (e.g., "01:31 م" or "09:15 ص")
 */
export function getCurrentTimeShort(): string {
  const d = new Date();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "م" : "ص";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const hStr = String(hours).padStart(2, "0");
  return `${hStr}:${minutes} ${period}`;
}

/**
 * Formats any time string (e.g., "13:31", "13:31:00", "01:31") into 12-hour format with period ("01:31 م")
 */
export function formatTime12(timeInput?: string | null): string {
  if (!timeInput || !timeInput.trim()) return "";

  let cleaned = timeInput.trim();
  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  arabicNumerals.forEach((d, idx) => {
    cleaned = cleaned.replaceAll(d, String(idx));
  });

  // If already formatted with period, normalize spacing
  if (/pm|م|مساء/i.test(cleaned) || /am|ص|صباح/i.test(cleaned)) {
    return cleaned;
  }

  const parts = cleaned.replace(/[^\d:]/g, "").split(":");
  if (parts.length < 2) return cleaned;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] ? parts[1].padStart(2, "0").slice(0, 2) : "00";
  if (isNaN(hours)) return cleaned;

  const period = hours >= 12 ? "م" : "ص";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hStr = String(hours).padStart(2, "0");
  return `${hStr}:${minutes} ${period}`;
}

export function getCurrentDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Sanitizes any time string (including 12-hour AM/PM or ص/م format) into standard SQL TIME "HH:MM:SS"
 */
export function sanitizeSqlTime(timeInput?: string | null): string {
  if (!timeInput || !timeInput.trim()) {
    return getCurrentTime();
  }

  // Convert Arabic-Indic digits to Latin digits
  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  let cleaned = timeInput.trim();
  arabicNumerals.forEach((d, idx) => {
    cleaned = cleaned.replaceAll(d, String(idx));
  });

  // Check if it has AM / PM or ص / م
  const isPM = /pm|م|مساء/i.test(cleaned);
  const isAM = /am|ص|صباح/i.test(cleaned);

  // Extract digits
  const parts = cleaned.replace(/[^\d:]/g, "").split(":");
  let hours = parseInt(parts[0] || "0", 10);
  const minutes = parseInt(parts[1] || "0", 10);
  const seconds = parseInt(parts[2] || "0", 10);

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  const hStr = String(Math.min(23, Math.max(0, hours))).padStart(2, "0");
  const mStr = String(Math.min(59, Math.max(0, minutes))).padStart(2, "0");
  const sStr = String(Math.min(59, Math.max(0, seconds))).padStart(2, "0");

  return `${hStr}:${mStr}:${sStr}`;
}

