"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/auth";
import {
  UserPlus,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Phone,
  Calendar,
  Clock,
  Sparkles,
  RefreshCw,
  Hash,
  ShieldCheck,
} from "lucide-react";
import { normalizeArabicNumbers } from "@/lib/numberUtils";
import { useFormSync, notifyFormSubmission } from "@/lib/syncEvents";

interface PatientRecord {
  id: string;
  mrn: string;
  full_name: string;
  gender: string | null;
  age: number | null;
  phone: string | null;
  created_at: string;
}

export default function AdmissionDeskPage() {
  const supabase = createClient();
  const router = useRouter();
  const { user, profile, role, isAdmin, loading: authLoading } = useUser();

  // Form inputs
  const [mrn, setMrn] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"ذكر" | "أنثى">("ذكر");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Role protection: Only 'admission' role or 'isAdmin'
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (!isAdmin && role !== "admission") {
        router.push("/");
      }
    }
  }, [user, role, isAdmin, authLoading, router]);

  // Load patients list
  useEffect(() => {
    fetchPatients();
  }, []);

  // Real-time synchronization
  useFormSync(() => {
    fetchPatients(true);
  });

  async function fetchPatients(silent = false) {
    if (!silent) setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, mrn, full_name, gender, age, phone, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setPatients(data);
      }
    } catch {
      // ignore network errors
    } finally {
      if (!silent) setLoadingList(false);
    }
  }

  // Quick auto-generate MRN
  function generateQuickMrn() {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    setMrn(String(randomNum));
  }

  async function handleRegisterPatient(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const cleanMrn = normalizeArabicNumbers(mrn.trim());
    const cleanName = fullName.trim();
    const parsedAge = age.trim() ? parseInt(normalizeArabicNumbers(age), 10) : null;
    const cleanPh = phone.trim() ? normalizeArabicNumbers(phone.trim()) : null;

    if (!cleanMrn) {
      setMessage({ text: "يرجى إدخال رقم الملف الطبي (MRN).", type: "error" });
      return;
    }

    if (!cleanName || cleanName.split(" ").filter(Boolean).length < 2) {
      setMessage({ text: "يرجى كتابة اسم المريض ثنائياً على الأقل.", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Check if patient with same MRN already exists
      const { data: existing } = await supabase
        .from("patients")
        .select("id, mrn, full_name")
        .eq("mrn", cleanMrn)
        .maybeSingle();

      if (existing) {
        setMessage({
          text: `رقم الملف (${cleanMrn}) مسجل مسبقاً باسم: ${existing.full_name}. يرجى استخدام رقم ملف مختلف أو التأكد من بيانات المريض.`,
          type: "error",
        });
        setSubmitting(false);
        return;
      }

      // 2. Insert new patient record
      const { data: newPatient, error: insertError } = await supabase
        .from("patients")
        .insert({
          mrn: cleanMrn,
          full_name: cleanName,
          gender: gender || null,
          age: parsedAge,
          phone: cleanPh,
        })
        .select()
        .single();

      if (insertError) {
        setMessage({ text: `فشل تسجيل المريض: ${insertError.message}`, type: "error" });
        return;
      }

      // 3. Success feedback & reset form
      setMessage({
        text: `تم تسجيل المريض (${cleanName}) بنجاح برقم ملف #${cleanMrn}! أصبح متاحاً لكافة الطاقم الطبي.`,
        type: "success",
      });

      setMrn("");
      setFullName("");
      setAge("");
      setPhone("");
      setGender("ذكر");

      notifyFormSubmission();
      fetchPatients(true);
    } catch (err: any) {
      setMessage({ text: `حدث خطأ غير متوقع: ${err?.message || "يرجى التحقق من الاتصال"}`, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  // Filtered patients for search
  const filteredPatients = patients.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.mrn?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#2c0b36] via-[#481454] to-[#2c0b36] text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-purple-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white shadow-inner shrink-0">
            <UserPlus className="w-7 h-7 text-purple-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-200 border border-purple-400/30">
                منظومة الاستقبال
              </span>
              <span className="text-xs text-purple-300 font-mono">Admission Desk</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              مكتب الدخول وتسجيل المرضى
            </h1>
            <p className="text-xs text-purple-200/80 mt-0.5">
              تسجيل البيانات الأساسية للمريض وإدراجه فوراً في قاعدة البيانات ليتمكن باقي الطاقم الطبي من استكمال نماذجه
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs bg-white/10 px-4 py-2 rounded-2xl border border-white/10 shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>الموظف: <strong>{profile?.full_name || "مكتب الاستقبال"}</strong></span>
        </div>
      </div>

      {/* Main Grid: Entry Form (Right) + Live Queue (Left) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Registration Form Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <UserPlus className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-extrabold text-slate-900">تسجيل مريض جديد</h2>
            </div>
            <span className="text-[11px] text-slate-400">بيانات أساسية</span>
          </div>

          {/* Feedback message */}
          {message && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 transition-all ${
                message.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold"
                  : "bg-rose-50 border border-rose-200 text-rose-900 font-semibold"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="leading-relaxed">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleRegisterPatient} className="space-y-4">
            {/* MRN */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  رقم الملف الطبي (MRN) <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={generateQuickMrn}
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>توليد رقم تلقائي</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={mrn}
                  onChange={(e) => setMrn(e.target.value)}
                  placeholder="مثال: 104250"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 text-sm font-mono outline-none transition-all"
                  dir="ltr"
                />
                <Hash className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم المريض رباعي <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="الاسم الكامل كما في البطاقة / شهادة الميلاد"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 text-sm outline-none transition-all"
              />
            </div>

            {/* Gender and Age */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الجنس <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender("ذكر")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      gender === "ذكر"
                        ? "bg-purple-900 text-white border-purple-900 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    ذكر
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("أنثى")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      gender === "أنثى"
                        ? "bg-purple-900 text-white border-purple-900 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    أنثى
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  السن (بالسنوات)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="مثال: 35"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 text-sm font-mono outline-none transition-all"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم هاتف المريض / المرافق
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 text-sm font-mono outline-none transition-all"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#621c6f] to-[#7f2490] hover:from-[#4f1659] hover:to-[#6a1e78] text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4" />
              <span>{submitting ? "جاري تسجيل المريض..." : "تسجيل المريض وإتاحته للطاقم"}</span>
            </button>
          </form>
        </div>

        {/* Admitted Patients List Card */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">سجل المرضى المسجلين</h2>
                <p className="text-[11px] text-slate-400">المرضى المتاحين حالياً في المنظومة لتعبئة النماذج</p>
              </div>
            </div>

            <button
              onClick={() => fetchPatients(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer self-start sm:self-center"
              title="تحديث القائمة"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? "animate-spin" : ""}`} />
              <span>تحديث</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث بالاسم، رقم الملف الطبي MRN، أو الهاتف..."
              className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none focus:border-purple-500 focus:bg-white transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Table / List */}
          {loadingList ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">جاري تحميل قائمة المرضى...</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 rounded-2xl">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">لا يوجد مرضى مطابقين للبحث</p>
              <p className="text-[11px] text-slate-400">قم بتسجيل مريض جديد من النموذج على اليمين</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
              {filteredPatients.map((p) => (
                <div
                  key={p.id}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-100/70 text-purple-900 flex items-center justify-center font-bold text-xs shrink-0">
                      {p.gender === "أنثى" ? "أنثى" : "ذكر"}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                        {p.full_name}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span>السن: {p.age !== null ? `${p.age} سنة` : "غير محدد"}</span>
                        {p.phone && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{p.phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-purple-900 border border-slate-200">
                      #{p.mrn}
                    </span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline-block">
                      {new Date(p.created_at).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
