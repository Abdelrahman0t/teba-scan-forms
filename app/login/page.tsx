"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, LogIn, AlertTriangle, UserPlus, Phone, User } from "lucide-react";
import { cleanPhoneNumber, hashPassword, setLocalSession, clearLocalSession } from "@/lib/supabase/auth";

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (searchParams?.get("rejected") === "1") {
      clearLocalSession();
      setError("تم رفض أو إلغاء تفعيل حسابك من قِبل إدارة المركز. لا يمكنك الوصول إلى النظام.");
    }
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const trimmed = identifier.trim();
      if (!trimmed) {
        setError("يرجى إدخال اسم المستخدم أو رقم الهاتف.");
        setLoading(false);
        return;
      }

      // Hash input password
      const hashedPassword = await hashPassword(password);

      // Clean phone representation if digits
      const cleanedPhone = cleanPhoneNumber(trimmed);

      // Fetch user profile by username (case-insensitive) OR phone
      const { data: profile, error: fetchError } = await supabase
        .from("user_profiles")
        .select("id, full_name, username, phone, password, role, status, is_admin")
        .or(`username.ilike.${trimmed},phone.eq.${cleanedPhone || trimmed}`)
        .maybeSingle();

      if (fetchError || !profile) {
        setError("اسم المستخدم أو رقم الهاتف أو كلمة المرور غير صحيحة.");
        setLoading(false);
        return;
      }

      // Verify password (matches hashed password or plain text for initial admin)
      if (profile.password !== hashedPassword && profile.password !== password.trim()) {
        setError("رقم الهاتف أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.");
        setLoading(false);
        return;
      }

      // Check approval status BEFORE setting local session
      if (!profile.is_admin) {
        if (profile.status === "rejected") {
          clearLocalSession();
          setError("تم رفض هذا الحساب من قِبل المسؤول. لا يمكنك تسجيل الدخول إلى النظام.");
          setLoading(false);
          return;
        }
        if (profile.status === "pending") {
          setLocalSession(profile);
          router.push("/pending");
          router.refresh();
          return;
        }
      }

      // Save user session for approved accounts
      setLocalSession(profile);
      router.push("/");
      router.refresh();
    } catch {
      setError("حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0521] via-[#2c0b36] to-[#1a0521] flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-700/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-indigo-700/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

          {/* Logo & Title */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-xl border border-purple-200/30">
              <img src="/tiba-scan.jpg" alt="Tiba Scan" className="w-full h-full object-contain" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-extrabold text-white">مركز طيبة سكان للأشعة</h1>
              <p className="text-purple-300 text-xs mt-1 font-mono">Tiba Scan Radiology Center</p>
              <div className="mt-3 w-16 h-0.5 bg-purple-500/50 mx-auto rounded-full" />
              <p className="text-purple-200/80 text-sm mt-3 font-medium">تسجيل الدخول</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 bg-rose-500/15 border border-rose-500/30 rounded-2xl p-3.5 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-rose-300 text-xs font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username or Phone */}
            <div>
              <label className="block text-xs font-bold text-purple-200 mb-1.5 flex items-center justify-between">
                <span>اسم المستخدم أو رقم الهاتف</span>
                <span className="text-[10px] text-purple-400 font-normal">username أو 010...</span>
              </label>
              <div className="relative">
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username أو رقم الهاتف"
                  className="w-full px-4 py-3 pl-10 bg-white/8 border border-white/15 rounded-xl text-white placeholder-purple-300/50 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                  dir="ltr"
                />
                <User className="w-4 h-4 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-purple-200 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 bg-white/8 border border-white/15 rounded-xl text-white placeholder-purple-300/50 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-200 transition-colors p-1"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading || !identifier || !password}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#7a2088] to-[#5a1568] hover:from-[#8f28a0] hover:to-[#6a1c7a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-purple-900/40 mt-6 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>
          </form>

          {/* Register Link / Button */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center space-y-3">
            <p className="text-purple-300/80 text-xs font-medium">ليس لديك حساب بعد؟</p>
            <Link
              id="goto-register-btn"
              href="/register"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/20 hover:border-purple-400/50 transition-all shadow-sm group"
            >
              <UserPlus className="w-4 h-4 text-purple-300 group-hover:text-purple-200 transition-colors" />
              <span>إنشاء حساب جديد (طلب انضمام)</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a0521] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
