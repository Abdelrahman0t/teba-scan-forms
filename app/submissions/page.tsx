"use client";

import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/auth";
import {
  Activity,
  HeartPulse,
  Eye,
  ShieldAlert,
  Baby,
  ClipboardCheck,
  Ambulance,
  CheckCircle2,
  AlertCircle,
  PenTool,
  Search,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useFormSync } from "@/lib/syncEvents";
import { getFormStatusInfo, FormStatusInfo } from "@/lib/formStatus";
import {
  RECORDS_PAGE_SIZE,
  ClinicalFormType,
  ClinicalRecordRow,
  KeysetCursor,
  RecordStatusFilter,
  RecordsQuery,
  RecordsSummary,
  MissingMigrationError,
  appendUnique,
  emptySummary,
  fetchClinicalRecordsPage,
  fetchClinicalRecordsSummary,
  normalizeRecordData,
  sumSummary,
} from "@/lib/clinicalRecords";
import SubmissionDetailModal from "@/components/submissions/SubmissionDetailModal";
import SubmissionPrintLayout from "@/components/submissions/SubmissionPrintLayout";

export { getFormStatusInfo };
export type { FormStatusInfo };

const FORM_META: Record<ClinicalFormType, { name: string; headerCode: string; editUrl: string; icon: any; color: string }> = {
  radiation: { name: "تسجيل جرعات الأشعة", headerCode: "TRC.MRS", editUrl: "/forms/radiation-exposure", icon: Activity, color: "text-purple-600 bg-purple-50" },
  education: { name: "التثقيف الصحي للأسرة", headerCode: "TRC.MRS", editUrl: "/forms/patient-education", icon: HeartPulse, color: "text-rose-600 bg-rose-50" },
  fall_screen: { name: "المسح المبدئي لخطر السقوط", headerCode: "TRC.MRS", editUrl: "/forms/fall-risk-screening", icon: ShieldAlert, color: "text-amber-600 bg-amber-50" },
  fall_adult: { name: "مخاطر السقوط للكبار (Hendrich II)", headerCode: "TRC-ICD", editUrl: "/forms/fall-risk-adult", icon: ShieldAlert, color: "text-orange-600 bg-orange-50" },
  fall_ped: { name: "مقياس مخاطر سقوط الأطفال (Humpty Dumpty)", headerCode: "TRC.ICD", editUrl: "/forms/fall-risk-pediatric", icon: Baby, color: "text-cyan-600 bg-cyan-50" },
  assessment: { name: "نموذج تقييم المريض الشامل", headerCode: "TRC-ICD", editUrl: "/forms/patient-assessment", icon: ClipboardCheck, color: "text-teal-600 bg-teal-50" },
  transfer: { name: "نموذج نقل المريض (RSTP)", headerCode: "TRC.ACT", editUrl: "/forms/patient-transfer", icon: Ambulance, color: "text-sky-600 bg-sky-50" },
};

/** Converts an RPC row into the item shape used by the table, modal and print layout. */
function toSubmissionItem(row: ClinicalRecordRow) {
  const meta = FORM_META[row.formType];
  const item = normalizeRecordData(row.formType, row.record);
  const p = row.patient;
  return {
    ...item,
    formType: row.formType,
    formTypeName: meta.name,
    headerCode: meta.headerCode,
    editUrl: `${meta.editUrl}?editId=${row.id}`,
    icon: meta.icon,
    color: meta.color,
    resolvedPatientName: item.patient_name || item.full_name || p?.full_name || "مريض غير مسجل بالاسم",
    resolvedMrn: item.mrn || p?.mrn || "بدون ملف",
    resolvedGender: item.gender || p?.gender || "-",
    resolvedAge: item.age !== undefined && item.age !== null ? item.age : p?.age || "-",
  };
}

const itemKey = (item: any) => `${item.formType}-${item.id}`;

/** Returns the ISO start timestamp for the current date range, or null for "all time". */
function getStartDate(range: "today" | "week" | "month" | "all"): string | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  const d = new Date(now);
  d.setDate(d.getDate() - (range === "week" ? 7 : 30));
  return d.toISOString();
}

export default function SubmissionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { role, isAdmin, loading: authLoading } = useUser();

  const [activeTab, setActiveTab] = useState<ClinicalFormType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("month");
  const [statusFilter, setStatusFilter] = useState<RecordStatusFilter>("all");

  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<KeysetCursor | null>(null);
  const [summary, setSummary] = useState<RecordsSummary>(emptySummary);
  // Key of the filters whose results are on screen (null = nothing loaded yet)
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  // Protect page: admission role has no access to clinical records
  useEffect(() => {
    if (!authLoading && role === "admission" && !isAdmin) {
      router.push("/admission");
    }
  }, [role, isAdmin, authLoading, router]);

  const submitSearch = () => setAppliedSearch(searchQuery.trim());

  const query = useMemo<RecordsQuery>(() => ({
    formType: activeTab,
    status: statusFilter,
    role,
    isAdmin,
    search: appliedSearch,
    from: getStartDate(dateRange),
  }), [activeTab, statusFilter, role, isAdmin, appliedSearch, dateRange]);

  const queryKey = useMemo(() => JSON.stringify(query), [query]);
  const loading = loadedKey === null;
  const fetching = !loading && loadedKey !== queryKey;

  // Every reload bumps the sequence; responses for older filters are dropped.
  const requestSeq = useRef(0);
  const itemsCountRef = useRef(0);
  const queryRef = useRef({ query, queryKey });
  useEffect(() => {
    itemsCountRef.current = items.length;
    queryRef.current = { query, queryKey };
  }, [items, query, queryKey]);

  // Counts don't depend on the selected tab / status, so they're only re-fetched when
  // search, date range or role change (or on a live refresh).
  const summaryKeyRef = useRef<string | null>(null);

  /** Loads the first page; `limit` is raised by live refreshes so loaded pages don't collapse. */
  const reload = useCallback(async (q: RecordsQuery, key: string, limit = RECORDS_PAGE_SIZE, forceSummary = false) => {
    const seq = ++requestSeq.current;
    const summaryKey = JSON.stringify([q.role, q.isAdmin, q.search, q.from]);
    const needSummary = forceSummary || summaryKeyRef.current !== summaryKey;
    try {
      const [page, sum] = await Promise.all([
        fetchClinicalRecordsPage(supabase, q, { limit }),
        needSummary
          ? fetchClinicalRecordsSummary(supabase, q).catch((err) => {
              console.warn("Failed fetching summary, skipping:", err);
              return null;
            })
          : Promise.resolve(null),
      ]);
      if (seq !== requestSeq.current) return;
      setItems(page.rows.map(toSubmissionItem));
      setCursor(page.nextCursor);
      if (sum) {
        setSummary(sum);
        summaryKeyRef.current = summaryKey;
      }
      setError(null);
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      console.error("Error fetching submissions:", err);
      const msg = err?.message || "";
      const timeout = /statement timeout|canceling statement/i.test(msg);
      setError(
        err instanceof MissingMigrationError
          ? err.message
          : timeout
            ? "انتهت مهلة قاعدة البيانات — شغّل ملف supabase_clinical_records.sql في محرر SQL بـ Supabase (قسم stored missing_roles) ثم أعد المحاولة."
            : "تعذر تحميل السجلات، حاول مرة أخرى."
      );
    } finally {
      if (seq === requestSeq.current) {
        setLoadedKey(key);
        setLoadingMore(false);
      }
    }
  }, [supabase]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const page = await fetchClinicalRecordsPage(supabase, query, { cursor });
      if (seq !== requestSeq.current) return;
      setItems((prev) => appendUnique(prev, page.rows.map(toSubmissionItem), itemKey));
      setCursor(page.nextCursor);
    } catch (err) {
      console.error("Error loading more submissions:", err);
    } finally {
      if (seq === requestSeq.current) setLoadingMore(false);
    }
  }

  // Filters changed -> fetch the first page from the database
  useEffect(() => {
    if (authLoading) return;
    reload(query, queryKey);
  }, [query, queryKey, authLoading, reload]);

  // Real-time live synchronization (No Refresh Needed)
  useFormSync(() => {
    if (authLoading) return;
    const { query: q, queryKey: key } = queryRef.current;
    reload(q, key, Math.max(RECORDS_PAGE_SIZE, itemsCountRef.current), true);
  });

  const handleView = useCallback((item: any) => setSelectedSubmission(item), []);

  const totalAllStatuses = sumSummary(summary, activeTab, "all");
  const incompleteCount = sumSummary(summary, activeTab, "incomplete");
  const completeCount = sumSummary(summary, activeTab, "complete");
  const myPendingCount = sumSummary(summary, activeTab, "pending_my_role");
  const myPendingAllTypes = sumSummary(summary, "all", "pending_my_role");
  const matchingTotal = sumSummary(summary, activeTab, statusFilter);
  const tabCount = (id: ClinicalFormType | "all") => sumSummary(summary, id, statusFilter);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-purple-100 no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-sm border border-purple-200/70 flex items-center justify-center shrink-0">
            <img src="/tiba-scan.jpg" alt="Tiba Scan" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#481454]">استعراض وإدارة كافة النماذج والمستندات المحفوظة</h2>
            <p className="text-xs text-slate-500">مركز طيبة سكان للأشعة • استعراض وطباعة تفاصيل كافة النماذج السبعة كاملة</p>
          </div>
        </div>

        {role && (
          <div className="bg-purple-50 border border-purple-200/70 px-4 py-2 rounded-2xl flex items-center gap-2.5 text-xs text-purple-950 font-bold">
            <span>{isAdmin ? "👑" : role === "nurse" ? "🟦" : role === "technician" ? "🟨" : "🟩"}</span>
            <span>
              {isAdmin ? "مسؤول النظام (Admin)" : role === "nurse" ? "تمريض (Nurse)" : role === "technician" ? "فني أشعة (Technician)" : "طبيب أشعة (Radiologist)"}
            </span>
            {myPendingAllTypes > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-bounce">
                {myPendingAllTypes} بحاجة لتوثيقك
              </span>
            )}
          </div>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="bg-white px-5 py-3.5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-wrap items-center gap-2.5 no-print">
        <span className="text-xs font-bold text-slate-500">الفترة الزمنية:</span>
        {([
          { id: "today", label: "اليوم فقط" },
          { id: "week", label: "آخر 7 أيام" },
          { id: "month", label: "آخر 30 يوم" },
          { id: "all", label: "كل السجلات" },
        ] as const).map((r) => (
          <button
            key={r.id}
            onClick={() => setDateRange(r.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${dateRange === r.id
                ? "bg-[#621c6f] text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
          >
            {r.label}
          </button>
        ))}
        <span className="text-[11px] text-slate-400 mr-auto">
          • عرض كافة السجلات الموثقة {dateRange === "all" ? "من كل الوقت" : "ضمن الفترة المحددة"}
        </span>
      </div>

      {/* Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-purple-100 space-y-3.5 no-print">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-purple-50/70 p-1.5 rounded-2xl border border-purple-100/80 no-scrollbar">
            {([
              { id: "all", label: "الكل" },
              { id: "fall_screen", label: "مسح السقوط" },
              { id: "assessment", label: "تقييم المريض" },
              { id: "fall_adult", label: "سقوط كبار" },
              { id: "fall_ped", label: "سقوط أطفال" },
              { id: "transfer", label: "نقل المريض" },
              { id: "radiation", label: "جرعات الأشعة" },
              { id: "education", label: "التثقيف الصحي" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                    ? "bg-[#621c6f] text-white shadow-sm"
                    : "text-purple-950/70 hover:text-[#481454] hover:bg-white/60"
                  }`}
              >
                {tab.label} ({tabCount(tab.id)})
              </button>
            ))}
          </div>

          {/* Search — only runs after بحث / Enter, not while typing */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            className="flex items-center gap-2 min-w-[240px] sm:w-[22rem]"
          >
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="بحث بالاسم أو رقم الملف (MRN)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#621c6f] focus:bg-white outline-hidden transition-all"
              />
              {fetching && !loading ? (
                <Loader2 className="w-4 h-4 text-[#621c6f] absolute right-3 top-2.5 animate-spin" />
              ) : (
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              )}
            </div>
            <button
              type="submit"
              className="shrink-0 px-4 py-2 rounded-xl bg-[#621c6f] text-white text-xs font-bold hover:bg-[#481454] transition-all"
            >
              بحث
            </button>
          </form>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-bold ml-1">حالة التوثيق:</span>

          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${statusFilter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            جميع الحالات ({totalAllStatuses})
          </button>

          {(isAdmin || role) && (myPendingCount > 0 || statusFilter === "pending_my_role") && (
            <button
              onClick={() => setStatusFilter("pending_my_role")}
              className={`px-3 py-1.5 rounded-xl font-extrabold transition-all flex items-center gap-1.5 ${statusFilter === "pending_my_role"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-amber-100/80 text-amber-900 border border-amber-300 hover:bg-amber-200/80"
                }`}
            >
              <span>⚡ بانتظار دورك</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "pending_my_role" ? "bg-white/25 text-white" : "bg-amber-500 text-white font-mono"}`}>
                {myPendingCount}
              </span>
            </button>
          )}

          <button
            onClick={() => setStatusFilter("incomplete")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${statusFilter === "incomplete"
                ? "bg-amber-700 text-white shadow-xs"
                : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
              }`}
          >
            <span>غير مكتملة</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "incomplete" ? "bg-white/25 text-white" : "bg-amber-200 text-amber-950 font-mono"}`}>
              {incompleteCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter("complete")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${statusFilter === "complete"
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
              }`}
          >
            <span>مكتملة</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "complete" ? "bg-white/25 text-white" : "bg-emerald-200 text-emerald-950 font-mono"}`}>
              {completeCount}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Table */}
      {error ? (
        <div className="bg-rose-50 p-6 text-center rounded-2xl border border-rose-200 text-rose-800 text-sm font-bold no-print">
          {error}
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">جاري تحميل سجلات النماذج...</div>
      ) : items.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
          لا توجد نماذج مسجلة تطابق التصفية الحالية.
        </div>
      ) : (
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden no-print transition-opacity ${fetching ? "opacity-60" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">نوع النموذج</th>
                  <th className="p-3">اسم المريض رباعي</th>
                  <th className="p-3">رقم الملف (MRN)</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3">التفاصيل / النتيجة</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <SubmissionRow key={itemKey(item)} item={item} role={role} isAdmin={isAdmin} onView={handleView} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 border-t border-slate-200 bg-slate-50/70">
            <span className="text-xs text-slate-500 font-bold">
              عرض <span className="font-mono text-slate-900">{items.length}</span> من أصل{" "}
              <span className="font-mono text-slate-900">{Math.max(matchingTotal, items.length)}</span> نموذج
            </span>
            {cursor && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-[#621c6f] hover:bg-[#481454] disabled:opacity-70 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5"
              >
                {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>
                  {loadingMore
                    ? "جاري التحميل..."
                    : `عرض ${Math.min(RECORDS_PAGE_SIZE, Math.max(matchingTotal - items.length, 0)) || RECORDS_PAGE_SIZE} نموذج إضافي`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reusable Submission Detail Modal */}
      <SubmissionDetailModal
        submission={selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        isAdmin={isAdmin}
        role={role}
      />

      {/* Standardized Print Layout */}
      <SubmissionPrintLayout submission={selectedSubmission} />
    </div>
  );
}

/** One table row. Memoized so typing in the search box doesn't re-render hundreds of rows. */
const SubmissionRow = memo(function SubmissionRow({
  item,
  role,
  isAdmin,
  onView,
}: {
  item: any;
  role: string | null | undefined;
  isAdmin: boolean;
  onView: (item: any) => void;
}) {
  const Icon = item.icon || Activity;
  const statusInfo = getFormStatusInfo(item);
  const isMyPartPending = !statusInfo.isComplete && (
    isAdmin || (role && (statusInfo.missingRoles as string[]).includes(role))
  );

  return (
    <tr className={`hover:bg-slate-50 transition-colors ${isMyPartPending ? "bg-amber-50/20" : ""}`}>
      <td className="p-3">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${item.color}`}>
          <Icon className="w-3.5 h-3.5" />
          <span>{item.formTypeName}</span>
        </span>
      </td>
      <td className="p-3 font-bold text-slate-900">{item.resolvedPatientName}</td>
      <td className="p-3 font-mono font-semibold text-slate-600">{item.resolvedMrn}</td>
      <td className="p-3 text-slate-500 font-mono">
        {item.exposure_date || item.screening_date || item.assessment_date || item.transfer_date || item.visit_date || new Date(item.created_at).toISOString().split("T")[0]}
      </td>

      {/* Status Badge */}
      <td className="p-3 text-center">
        {statusInfo.isComplete ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold whitespace-nowrap shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>مكتمل</span>
          </span>
        ) : (
          <div className="inline-flex flex-col items-center gap-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-bold whitespace-nowrap shadow-2xs">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{statusInfo.badgeLabel}</span>
            </span>
            {statusInfo.missingLabels.length > 0 && (
              <span className="text-[10px] text-amber-900/80 font-medium">
                بانتظار: {statusInfo.missingLabels.join(" + ")}
              </span>
            )}
          </div>
        )}
      </td>

      {/* Details Column */}
      <td className="p-3 text-slate-600 max-w-xs truncate">
        {item.formType === "radiation" && `${item.procedure_name || item.exam_type || "فحص إشعاعي"} | جرعة: ${item.radiation_dose || "-"} mGy`}
        {item.formType === "education" && (item.procedure_name ? `${item.procedure_name} • ${item.topics_discussed || "تثقيف صحي"}` : (item.topics_discussed || "تثقيف وتوعية المريض والأسرة"))}
        {item.formType === "fall_screen" && (
          <span>
            النتيجة: <strong>{item.total_score} نقطة</strong> —{" "}
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.risk_level === "High" ? "bg-rose-100 text-rose-700 border border-rose-200" : "bg-emerald-100 text-emerald-700"}`}>
              {item.risk_level === "High" ? "خطر مرتفع" : "خطر منخفض"}
            </span>
          </span>
        )}
        {(item.formType === "fall_adult" || item.formType === "fall_ped") && (() => {
          const directReasons: string[] = [];
          const effectiveRisk = item.risk_level || (item.is_high_risk ? "عالية المخاطر" : "منخفض المخاطر");
          if (item.formType === "fall_adult" && effectiveRisk === "عالية المخاطر") {
            if (item.bed_ridden || item.direct_factors?.bed_ridden) directReasons.push("ملازم للفراش");
            if (item.physical_disability || item.direct_factors?.physical_disability) directReasons.push("إعاقة جسدية");
            if (item.mental_disability || item.direct_factors?.mental_disability) directReasons.push("إعاقة ذهنية");
            if (item.anesthesia_first_24h || item.direct_factors?.anesthesia_first_24h) directReasons.push("تخدير حديث");
          }
          return (
            <span>
              الدرجة: <strong>{item.total_score ?? 0}</strong> —{" "}
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${effectiveRisk === "عالية المخاطر"
                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                  : effectiveRisk === "متوسط المخاطر"
                    ? "bg-amber-100 text-amber-700 border border-amber-200"
                    : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                }`}>
                {effectiveRisk}
              </span>
              {directReasons.length > 0 && (
                <span className="text-[10px] text-rose-600 block mt-0.5 font-medium">
                  ({directReasons.join(" • ")})
                </span>
              )}
            </span>
          );
        })()}
        {item.formType === "assessment" && `${item.procedure_name || "-"} | التشخيص: ${item.diagnosis || "-"}`}
        {item.formType === "transfer" && `من: ${item.from_location} إلى: ${item.to_location} (${item.recommended_vehicle})`}
      </td>

      {/* Actions Column */}
      <td className="p-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          {isMyPartPending ? (
            <a
              href={item.editUrl}
              className="px-3 py-1.5 bg-[#621c6f] hover:bg-[#481454] text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md transition-all inline-flex items-center gap-1.5 whitespace-nowrap animate-pulse hover:animate-none"
              title="اضغط هنا لاستكمال دورك في هذا النموذج"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>استكمال دورك</span>
            </a>
          ) : !statusInfo.isComplete ? (
            <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg font-medium whitespace-nowrap hidden sm:inline-block">
              دورك مكتمل
            </span>
          ) : null}

          <button
            onClick={() => onView(item)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors inline-flex items-center gap-1 text-xs"
            title="عرض كامل تفاصيل النموذج"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>تفاصيل</span>
          </button>
        </div>
      </td>
    </tr>
  );
});
