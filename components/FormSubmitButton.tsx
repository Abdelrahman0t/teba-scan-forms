"use client";

import React, { useEffect, useState, useRef } from "react";
import { CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";
import { triggerErrorHaptics } from "@/lib/haptics";

interface FormSubmitButtonProps {
  loading: boolean;
  isLocked?: boolean;
  fieldErrors?: Record<string, string | null | undefined>;
  defaultText?: string;
  editText?: string;
  isEdit?: boolean;
  shakeTrigger?: number;
  className?: string;
}

export default function FormSubmitButton({
  loading,
  isLocked = false,
  fieldErrors = {},
  defaultText = "حفظ وتوثيق النموذج",
  editText = "حفظ وتوثيق التعديلات",
  isEdit = false,
  shakeTrigger = 0,
  className = "",
}: FormSubmitButtonProps) {
  const [isShaking, setIsShaking] = useState(false);
  const prevTriggerRef = useRef(shakeTrigger);

  // Count active errors
  const missingCount = Object.values(fieldErrors).filter(Boolean).length;
  const hasErrors = missingCount > 0;

  // React to shakeTrigger (failed submit attempts)
  useEffect(() => {
    if (shakeTrigger > 0 && shakeTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = shakeTrigger;
      setIsShaking(true);
      triggerErrorHaptics();

      const timer = setTimeout(() => {
        setIsShaking(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [shakeTrigger]);

  if (isLocked) return null;

  const buttonText = isEdit ? editText : defaultText;

  return (
    <div className="flex items-center justify-end pt-1">
      {/* Submit Button with soft red state and dynamic content */}
      <button
        type="submit"
        disabled={loading}
        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 font-bold text-xs sm:text-sm px-7 py-3 rounded-xl transition-all active:scale-[0.99] text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
          isShaking ? "animate-button-vibrate" : ""
        } ${
          hasErrors
            ? "bg-[#c04358] hover:bg-[#ab3448] shadow-[#c04358]/20"
            : "bg-[#1d8a98] hover:bg-[#167480] shadow-[#1d8a98]/20"
        } ${className}`}
      >
        {loading ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>جاري الحفظ...</span>
          </>
        ) : hasErrors ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>استكمال الحقول المطلوبة ({missingCount})</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            <span>{buttonText}</span>
          </>
        )}
      </button>
    </div>
  );
}
