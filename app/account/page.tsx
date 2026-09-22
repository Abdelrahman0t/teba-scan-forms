"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  useUser,
  getRoleLabel,
  getRoleBadgeClass,
  hashPassword,
  setLocalSession,
  clearLocalSession,
} from "@/lib/supabase/auth";
import {
  UserCircle,
  Phone,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Eye,
  EyeOff,
  LogOut,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile, role, isAdmin, status, loading } = useUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-purple-900">جاري تحميل بيانات الحساب...</p>
      </div>
    );
  }

  if (!profile) {
    router.push("/login");
    return null;
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ text: "كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أرقام على الأقل.", type: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ text: "كلمة المرور الجديدة وتأكيدها غير متطابقتين.", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Fetch latest profile to get current password
      const { data: latestProfile, error: fetchErr } = await supabase
        .from("user_profiles")
        .select("id, password")
        .eq("id", profile.id)
        .single();

      if (fetchErr || !latestProfile) {
        setMessage({ text: "تعذر التحقق من الحساب الحالي.", type: "error" });
        return;
      }

      // 2. Verify current password
      const currentHashed = await hashPassword(currentPassword);
      const matches =
        latestProfile.password === currentHashed ||
        latestProfile.password === currentPassword.trim();

      if (!matches) {
        setMessage({ text: "كلمة المرور الحالية غير صحيحة.", type: "error" });
        return;
      }

      // 3. Hash and save new password
      const newHashed = await hashPassword(newPassword);
      const { error: updateErr } = await supabase
        .from("user_profiles")
        .update({ password: newHashed })
        .eq("id", profile.id);

      if (updateErr) {
        setMessage({ text: `فشل تحديث كلمة المرور: ${updateErr.message}`, type: "error" });
        return;
      }

      // 4. Update local session
      setLocalSession({ ...profile, password: newHashed } as any);

      setMessage({ text: "تم تغيير كلمة المرور بنجاح!", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setMessage({ text: "حدث خطأ غير متوقع أثناء تحديث كلمة المرور.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    clearLocalSession();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      {/* Header Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </Link>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all border border-rose-200"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>

      {/* Main Profile Card */}
      <div className="bg-gradient-to-r from-[#2c0b36] via-[#431454] to-[#2c0b36] text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-purple-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
            <UserCircle className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black">{profile.full_name}</h1>
              {isAdmin && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black shadow-xs">
                  مدير النظام 👑
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-purple-200 text-xs">
              {profile.username && (
                <>
                  <span className="inline-flex items-center gap-1 font-mono text-amber-200 font-bold" dir="ltr">
                    <span>@{profile.username}</span>
                  </span>
                  <span>•</span>
                </>
              )}
              <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                <Phone className="w-3.5 h-3.5 text-purple-300" />
                <span>{profile.phone}</span>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>حساب معتمد ونشط</span>
              </span>
            </div>
          </div>
        </div>

        <div className="self-stretch sm:self-auto flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0">
          <span className="text-[11px] text-purple-300">الدور الوظيفي:</span>
          <span className={`text-xs font-extrabold px-3 py-1 rounded-xl border ${getRoleBadgeClass(role)}`}>
            {getRoleLabel(role)}
          </span>
        </div>
      </div>

      {/* Grid: Permissions Info & Change Password */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Permissions & Assigned Forms */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-3">
              <ShieldCheck className="w-5 h-5 text-purple-700" />
              <span>الصلاحيات والنماذج المخصصة لدورك</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              بناءً على تفعيل حسابك كـ <span className="font-bold text-purple-900">{getRoleLabel(role)}</span>، يمكنك تحرير وتوثيق النماذج الطبية التالية:
            </p>

            <div className="space-y-2 pt-1">
              {role === "nurse" && (
                <>
                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs font-bold text-blue-900 flex items-center justify-between">
                    <span>مسح وتقييم مخاطر السقوط (مبدئي / كبار / أطفال)</span>
                    <span className="text-[10px] font-mono text-blue-700">3 نماذج</span>
                  </div>
                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs font-bold text-blue-900 flex items-center justify-between">
                    <span>تقييم المريض الشامل (قسم التمريض)</span>
                    <span className="text-[10px] font-mono text-blue-700">TRC-ICD</span>
                  </div>
                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs font-bold text-blue-900 flex items-center justify-between">
                    <span>نقل المريض والتثقيف الصحي</span>
                    <span className="text-[10px] font-mono text-blue-700">نموذجان</span>
                  </div>
                </>
              )}

              {role === "technician" && (
                <>
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs font-bold text-amber-900 flex items-center justify-between">
                    <span>حساب جرعات الأشعة والتسجيل الإشعاعي</span>
                    <span className="text-[10px] font-mono text-amber-700">TRC.MRS</span>
                  </div>
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs font-bold text-amber-900 flex items-center justify-between">
                    <span>تقييم المريض (خطة رعاية قسم الأشعة)</span>
                    <span className="text-[10px] font-mono text-amber-700">TRC-ICD</span>
                  </div>
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs font-bold text-amber-900 flex items-center justify-between">
                    <span>التثقيف الصحي ونقل المريض (قسم الفني)</span>
                    <span className="text-[10px] font-mono text-amber-700">نموذجان</span>
                  </div>
                </>
              )}

              {role === "radiologist" && (
                <>
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs font-bold text-emerald-900 flex items-center justify-between">
                    <span>تقييم المريض الشامل (قسم الطبيب ونتائج التحاليل)</span>
                    <span className="text-[10px] font-mono text-emerald-700">TRC-ICD</span>
                  </div>
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs font-bold text-emerald-900 flex items-center justify-between">
                    <span>اعتماد خطط الرعاية والقرارات الإشعاعية</span>
                    <span className="text-[10px] font-mono text-emerald-700">معتمد</span>
                  </div>
                </>
              )}

              {isAdmin && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold text-purple-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>بصفتك مدير النظام، تملك صلاحية الوصول والتوثيق في كافة النماذج السبعة وإدارة المستخدمين.</span>
                </div>
              )}
            </div>
          </div>

          <Link
            href="/"
            className="block text-center py-2.5 bg-slate-100 hover:bg-purple-50 hover:text-purple-900 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-200"
          >
            فتح النماذج المتاحة لدورك الآن
          </Link>
        </div>

        {/* Card 2: Change Password Form */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
              <KeyRound className="w-5 h-5 text-purple-700" />
              <span>تغيير كلمة المرور</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswords((p) => !p)}
              className="text-slate-400 hover:text-purple-700 text-xs font-bold flex items-center gap-1 transition-colors"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPasswords ? "إخفاء" : "إظهار"}</span>
            </button>
          </div>

          {message && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الحالية</label>
              <input
                type={showPasswords ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الحالية"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono outline-none focus:border-purple-600 focus:bg-white transition-all"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الجديدة</label>
              <input
                type={showPasswords ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6 أحرف أو أرقام على الأقل"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono outline-none focus:border-purple-600 focus:bg-white transition-all"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد كلمة المرور الجديدة</label>
              <input
                type={showPasswords ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور الجديدة"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono outline-none focus:border-purple-600 focus:bg-white transition-all"
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-2.5 bg-[#7a2088] hover:bg-[#8f28a0] disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <KeyRound className="w-3.5 h-3.5" />
              )}
              <span>تحديث كلمة المرور</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
