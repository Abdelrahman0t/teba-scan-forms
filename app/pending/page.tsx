"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { useUser, getRoleLabel, clearLocalSession } from "@/lib/supabase/auth";

export default function PendingPage() {
  const supabase = createClient();
  const router = useRouter();
  const { profile, role, status, isAdmin } = useUser();
  const [checking, setChecking] = useState(false);

  // If status becomes approved or user is admin, redirect to home
  useEffect(() => {
    if (status === "approved" || isAdmin) {
      router.push("/");
      router.refresh();
    }
  }, [status, isAdmin, router]);

  async function checkStatusNow() {
    setChecking(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from("user_profiles")
        .select("status, is_admin")
        .eq("id", session.user.id)
        .single();
      if (data?.status === "approved" || data?.is_admin) {
        router.push("/");
        router.refresh();
        return;
      }
    }
    setChecking(false);
  }

  async function handleLogout() {
    clearLocalSession();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0521] via-[#2c0b36] to-[#1a0521] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center space-y-5">

        {/* Icon */}
        <div className="w-20 h-20 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
          <Clock className="w-10 h-10 text-amber-400" />
        </div>

        <div>
          <h1 className="text-xl font-extrabold text-white">حسابك قيد المراجعة</h1>
          <p className="text-purple-200 text-sm mt-2 leading-relaxed">
            مرحباً <span className="font-bold text-white">{profile?.full_name ?? "..."}</span>،
            <br />
            طلبك كـ <span className="font-bold text-amber-300">{getRoleLabel(role)}</span> قيد المراجعة من قِبل المسؤول.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-right space-y-2">
          <p className="text-purple-200/80 text-xs leading-relaxed">
            ⏳ عادةً ما يتم قبول الطلبات خلال فترة قصيرة.
          </p>
          <p className="text-purple-200/80 text-xs leading-relaxed">
            📞 يمكنك التواصل مع مدير النظام لتسريع الموافقة.
          </p>
          <p className="text-purple-200/80 text-xs leading-relaxed">
            🔄 بعد الموافقة، سجّل الدخول مرة أخرى للوصول للنظام.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={checkStatusNow}
            disabled={checking}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold rounded-xl text-xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
            <span>التحقق من التفعيل</span>
          </button>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/8 border border-white/15 text-purple-200 hover:bg-white/15 font-bold rounded-xl text-xs transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </div>
  );
}
