"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, UserPlus, AlertTriangle, CheckCircle, Phone, AtSign, User } from "lucide-react";
import { cleanPhoneNumber, hashPassword, setLocalSession } from "@/lib/supabase/auth";

const ROLES = [
  { value: "admission", label: "مكتب الدخول والاستقبال", emoji: "🟪", desc: "تسجيل المرضى، رقم الملف الطبي، وبدء الزيارة" },
  { value: "nurse", label: "ممرضة / أخصائي تمريض", emoji: "🟦", desc: "نماذج السقوط، تقييم المريض، التثقيف الصحي" },
  { value: "technician", label: "فني الأشعة", emoji: "🟨", desc: "جرعات الأشعة، التثقيف الصحي (قسم الفني)" },
  { value: "radiologist", label: "طبيب / أخصائي الأشعة", emoji: "🟩", desc: "تقييم المريض (قسم الطبيب)" },
];

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setError("اسم المستخدم يجب أن يكون 3 أحرف أو أرقام على الأقل.");
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setError("اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام وبدون مسافات.");
      return;
    }

    const cleanedPhone = cleanPhoneNumber(phone);
    if (cleanedPhone.length < 8) {
      setError("يرجى إدخال رقم هاتف صحيح (8 أرقام على الأقل).");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل.");
      return;
    }
    if (!role) {
      setError("يرجى اختيار دورك الوظيفي.");
      return;
    }

    setLoading(true);
    try {
      // 1. Check if username is already taken
      const { data: existingUsername, error: userCheckError } = await supabase
        .from("user_profiles")
        .select("id")
        .ilike("username", cleanUsername)
        .maybeSingle();

      if (existingUsername) {
        setError("اسم المستخدم مسجل مسبقاً بالفعل. يرجى اختيار اسم مستخدم آخر.");
        setLoading(false);
        return;
      }

      // 2. Check if phone is already registered in user_profiles
      const { data: existing, error: checkError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("phone", cleanedPhone)
        .maybeSingle();

      if (existing) {
        setError("رقم الهاتف مسجل مسبقاً بالفعل. يرجى تسجيل الدخول بهذا الرقم.");
        setLoading(false);
        return;
      }

      // 3. Hash password securely with SHA-256
      const hashedPassword = await hashPassword(password);

      // 4. Insert profile directly into user_profiles with status = pending
      const { data: newProfile, error: insertError } = await supabase
        .from("user_profiles")
        .insert({
          full_name: fullName.trim(),
          username: cleanUsername,
          phone: cleanedPhone,
          password: hashedPassword,
          role,
          status: "pending",
          is_admin: false,
        })
        .select()
        .single();

      if (insertError) {
        setError(`خطأ أثناء حفظ البيانات: ${insertError.message}`);
        return;
      }

      if (newProfile) {
        setLocalSession(newProfile as any);
      }

      setDone(true);
    } catch {
      setError("حدث خطأ غير متوقع. يرجى التأكد من اتصال الإنترنت والمحاولة ثانية.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0521] via-[#2c0b36] to-[#1a0521] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-extrabold text-white">تم إرسال طلب الانضمام بنجاح!</h2>
          <p className="text-purple-200 text-sm leading-relaxed">
            مرحباً <span className="font-bold text-white">{fullName}</span>،
            <br />
            تم تسجيل حسابك برقم الهاتف{" "}
            <span className="font-mono font-bold text-amber-300" dir="ltr">
              {phone}
            </span>
            .
            <br />
            طلبك قيد مراجعة المسؤول لاعتماده وتفعيل صلاحياتك.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <Link
              href="/pending"
              className="w-full sm:w-auto px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold rounded-xl text-xs transition-all"
            >
              متابعة حالة الطلب
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-5 py-2.5 bg-[#7a2088] text-white font-bold rounded-xl text-xs hover:bg-[#8f28a0] transition-all"
            >
              العودة لتسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0521] via-[#2c0b36] to-[#1a0521] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-700/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-indigo-700/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

          {/* Header */}
          <div className="flex flex-col items-center gap-3 mb-7">
            <div className="w-14 h-14 rounded-2xl bg-white p-1 shadow-xl border border-purple-200/30">
              <img src="/tiba-scan.jpg" alt="Tiba Scan" className="w-full h-full object-contain" />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-extrabold text-white">إنشاء حساب جديد</h1>
              <p className="text-purple-300/80 text-xs mt-0.5">مركز طيبة سكان للأشعة</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 bg-rose-500/15 border border-rose-500/30 rounded-2xl p-3.5 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-rose-300 text-xs font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-purple-200 mb-1.5">الاسم الرباعي</label>
              <input
                id="register-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: نورهان أحمد محمد علي"
                className="w-full px-4 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-purple-300/50 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-purple-200 mb-1.5 flex items-center justify-between">
                <span>اسم المستخدم (Username)</span>
                <span className="text-[10px] text-purple-400 font-normal">لتسجيل الدخول السريع</span>
              </label>
              <div className="relative">
                <input
                  id="register-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                  placeholder="username (مثال: dr_ahmed)"
                  className="w-full px-4 py-3 pl-10 bg-white/8 border border-white/15 rounded-xl text-white placeholder-purple-300/50 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                  dir="ltr"
                />
                <AtSign className="w-4 h-4 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-purple-200 mb-1.5 flex items-center justify-between">
                <span>رقم الهاتف</span>
                <span className="text-[10px] text-purple-400 font-normal">مثال: 01012345678</span>
              </label>
              <div className="relative">
                <input
                  id="register-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full px-4 py-3 pl-10 bg-white/8 border border-white/15 rounded-xl text-white placeholder-purple-300/50 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-bold text-purple-200 mb-2">دورك الوظيفي</label>
              <div className="space-y-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-right transition-all ${
                      role === r.value
                        ? "border-purple-400 bg-purple-500/20"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-xl mt-0.5">{r.emoji}</span>
                    <div>
                      <p className="text-white text-xs font-bold">{r.label}</p>
                      <p className="text-purple-300/70 text-[10px] mt-0.5">{r.desc}</p>
                    </div>
                    {role === r.value && (
                      <span className="mr-auto text-purple-400 shrink-0">
                        <CheckCircle className="w-4 h-4" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-purple-200 mb-1.5">كلمة المرور</label>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6 أحرف أو أرقام+"
                    className="w-full px-3.5 py-3 pr-10 bg-white/8 border border-white/15 rounded-xl text-white placeholder-purple-300/50 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-200 transition-colors p-0.5"
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-200 mb-1.5">تأكيد المرور</label>
                <input
                  id="register-confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد كلمة المرور"
                  className="w-full px-3 py-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-purple-300/50 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading || !fullName || !phone || !password || !confirmPassword || !role}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#7a2088] to-[#5a1568] hover:from-[#8f28a0] hover:to-[#6a1c7a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-purple-900/40 mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري إرسال الطلب...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>إنشاء الحساب وإرسال الطلب</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-purple-400/70 text-[11px] mt-5">
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="text-purple-300 font-bold hover:text-white transition-colors">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
