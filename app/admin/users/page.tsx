"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser, getRoleLabel, getRoleBadgeClass, UserRole } from "@/lib/supabase/auth";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  UserCheck,
  Phone,
  Trash2,
} from "lucide-react";

interface ProfileItem {
  id: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  status: "pending" | "approved" | "rejected";
  is_admin: boolean;
  created_at?: string;
}

export default function AdminUsersPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useUser();

  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (!isAdmin) {
        // If not admin, redirect home
        router.push("/");
      } else {
        loadProfiles();
      }
    }
  }, [user?.id, isAdmin, authLoading]);

  async function loadProfiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, username, phone, role, status, is_admin, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage({ text: `تعذر جلب المستخدمين: ${error.message}`, type: "error" });
      } else {
        setProfiles(data || []);
      }
    } catch {
      setMessage({ text: "حدث خطأ غير متوقع أثناء تحميل البيانات.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(profileId: string, newStatus: "approved" | "rejected") {
    setActionLoading(profileId);
    setMessage(null);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ status: newStatus })
        .eq("id", profileId);

      if (error) {
        setMessage({ text: `فشل تحديث الحالة: ${error.message}`, type: "error" });
      } else {
        setMessage({
          text: newStatus === "approved" ? "تم قبول وتفعيل الحساب بنجاح!" : "تم رفض الطلب.",
          type: "success",
        });
        setProfiles((prev) =>
          prev.map((p) => (p.id === profileId ? { ...p, status: newStatus } : p))
        );
      }
    } catch {
      setMessage({ text: "حدث خطأ غير متوقع.", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteUser(profileId: string, fullName: string) {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف الموظف "${fullName}" نهائياً من النظام؟\n\n(ملاحظة هامة: النماذج والتقارير الطبية التي سجلها سابقاً ستبقى محفوظة بالكامل ولن تتأثر)`)) {
      return;
    }

    setActionLoading(profileId);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessage({ text: `فشل حذف الموظف: ${data.error || "حدث خطأ غير معروف"}`, type: "error" });
        return;
      }

      setMessage({ text: `تم حذف الموظف "${fullName}" نهائياً بنجاح وإلغاء حسابه. (النماذج المسجلة محفوظة بالكامل).`, type: "success" });
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    } catch {
      setMessage({ text: "حدث خطأ في الاتصال أثناء محاولة حذف الموظف.", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  const pendingCount = profiles.filter((p) => p.status === "pending").length;
  const approvedCount = profiles.filter((p) => p.status === "approved").length;
  const rejectedCount = profiles.filter((p) => p.status === "rejected").length;

  const filteredProfiles = profiles
    .filter((p) => p.status === activeTab)
    .filter((p: any) =>
      p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.includes(searchTerm)
    );

  if (authLoading || (loading && profiles.length === 0)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-purple-900">جاري تحميل بيانات المستخدمين...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2c0b36] via-[#431454] to-[#2c0b36] text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-purple-800/60">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-amber-300" />
            <h1 className="text-xl font-extrabold">لوحة إدارة المستخدمين والموافقات</h1>
          </div>
          <p className="text-purple-200 text-xs mt-1 leading-relaxed">
            التحكم في حسابات الكادر الطبي، قبول وتفعيل طلبات التسجيل الجديدة أو رفضها وإدارتها.
          </p>
        </div>
        <button
          onClick={loadProfiles}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          تحديث القائمة
        </button>
      </div>

      {/* Alert message */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between transition-all ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats and Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setActiveTab("pending")}
          className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
            activeTab === "pending"
              ? "bg-amber-500/10 border-amber-500/50 shadow-md ring-2 ring-amber-500/20"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div>
            <span className="text-xs font-bold text-slate-600 block">طلبات بانتظار الموافقة</span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">{pendingCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </button>

        <button
          onClick={() => setActiveTab("approved")}
          className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
            activeTab === "approved"
              ? "bg-emerald-500/10 border-emerald-500/50 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div>
            <span className="text-xs font-bold text-slate-600 block">المستخدمون المفعلون</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">{approvedCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-5 h-5" />
          </div>
        </button>

        <button
          onClick={() => setActiveTab("rejected")}
          className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
            activeTab === "rejected"
              ? "bg-rose-500/10 border-rose-500/50 shadow-md ring-2 ring-rose-500/20"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div>
            <span className="text-xs font-bold text-slate-600 block">الطلبات المرفوضة</span>
            <span className="text-2xl font-black text-rose-600 mt-1 block">{rejectedCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
            <XCircle className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث بالاسم..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
      </div>

      {/* Users List */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        {filteredProfiles.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">لا توجد سجلات في هذا القسم</p>
            <p className="text-xs text-slate-400">
              {searchTerm ? "جرب كلمة بحث مختلفة." : "لا توجد طلبات مسجلة حالياً."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredProfiles.map((p) => {
              const isUpdating = actionLoading === p.id;
              return (
                <div
                  key={p.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  {/* User details */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-extrabold text-slate-900 text-sm">{p.full_name}</span>
                      {(p as any).username && (
                        <span className="text-[11px] font-mono text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-100" dir="ltr">
                          @{(p as any).username}
                        </span>
                      )}
                      {p.is_admin && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-black border border-purple-200">
                          مدير النظام 👑
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRoleBadgeClass(
                          p.role
                        )}`}
                      >
                        {getRoleLabel(p.role)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-slate-500 text-xs">
                      {p.phone && (
                        <a
                          href={`tel:${p.phone}`}
                          className="flex items-center gap-1.5 text-purple-700 hover:text-purple-900 font-mono font-bold bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100 transition-colors"
                          dir="ltr"
                        >
                          <Phone className="w-3 h-3 text-purple-600" />
                          <span>{p.phone}</span>
                        </a>
                      )}
                      {p.created_at && (
                        <span className="text-slate-400">
                          تاريخ التسجيل:{" "}
                          {new Date(p.created_at).toLocaleDateString("ar-EG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Approve button */}
                    {p.status !== "approved" && (
                      <button
                        onClick={() => updateStatus(p.id, "approved")}
                        disabled={isUpdating}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-700/20"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>قبول وتفعيل</span>
                      </button>
                    )}

                    {/* Reject button */}
                    {p.status !== "rejected" && !p.is_admin && (
                      <button
                        onClick={() => updateStatus(p.id, "rejected")}
                        disabled={isUpdating}
                        className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-50 rounded-xl text-xs font-bold transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رفض</span>
                      </button>
                    )}

                    {/* Delete button */}
                    {!p.is_admin && (
                      <button
                        onClick={() => deleteUser(p.id, p.full_name)}
                        disabled={isUpdating}
                        title="حذف الموظف نهائياً"
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 rounded-xl text-xs font-bold transition-all shadow-sm shadow-red-700/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
