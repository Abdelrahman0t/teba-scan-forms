"use client";

import { useUser, UserRole, getRoleLabel, getRoleBadgeClass } from "@/lib/supabase/auth";
import Link from "next/link";
import { ShieldAlert, ArrowRight, Home, Database } from "lucide-react";

interface FormRoleGuardProps {
  allowedRoles: UserRole[];
  formTitle?: string;
  children: React.ReactNode;
}

export default function FormRoleGuard({
  allowedRoles,
  formTitle,
  children,
}: FormRoleGuardProps) {
  const { user, role, isAdmin, status, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-purple-900">جاري التحقق من صلاحيات الوصول...</p>
      </div>
    );
  }

  // Superior/Admin has access to everything
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check if role is authorized
  const hasAccess = role && allowedRoles.includes(role);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Access Denied Screen
  return (
    <div className="max-w-xl mx-auto my-12 px-4" dir="rtl">
      <div className="bg-white border border-rose-200 rounded-3xl p-8 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900">
            عفواً، لا تملك صلاحية الوصول لهذا النموذج
          </h2>
          {formTitle && (
            <p className="text-xs font-bold text-purple-700 bg-purple-50 inline-block px-3 py-1 rounded-lg border border-purple-200">
              {formTitle}
            </p>
          )}
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            تم تخصيص هذا النموذج الوظيفي حصرياً للأدوار التالية لمنع تسجيل بيانات غير مطابقة للاختصاص الطبي.
          </p>
        </div>

        {/* Roles Details */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-right space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">الأدوار المسموح لها:</span>
            <div className="flex flex-wrap gap-1">
              {allowedRoles.map((r) => (
                <span
                  key={r}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRoleBadgeClass(r)}`}
                >
                  {getRoleLabel(r)}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs border-t border-slate-200/80 pt-2">
            <span className="text-slate-500 font-bold">دورك الوظيفي الحالي:</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRoleBadgeClass(role)}`}>
              {getRoleLabel(role)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#7a2088] hover:bg-[#8f28a0] text-white font-bold rounded-xl text-xs transition-all shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>العودة للنماذج المتاحة لدورك</span>
          </Link>
          <Link
            href="/submissions"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all border border-slate-200"
          >
            <Database className="w-4 h-4" />
            <span>سجل النماذج المسجلة</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
