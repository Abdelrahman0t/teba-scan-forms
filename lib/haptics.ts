/**
 * Haptic and Audio feedback utilities for medical form submissions
 */

export function triggerErrorHaptics() {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      // Subtle single tap
      navigator.vibrate(40);
    } catch {
      // Ignored if blocked by browser policy
    }
  }
}

export function playErrorTone() {
  // Silent / non-intrusive
}

export function scrollToFirstError() {
  if (typeof document === "undefined") return;
  
  // Look for field error texts or inputs with error styling
  const errorElements = document.querySelectorAll(
    ".border-rose-400, .border-rose-500, .bg-rose-50, [data-has-error='true'], p.text-rose-600, p.text-rose-500"
  );

  if (errorElements.length > 0) {
    const firstEl = errorElements[0] as HTMLElement;
    firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
    
    // If it's an input or within a container with an input, try to focus
    if (firstEl instanceof HTMLInputElement || firstEl instanceof HTMLSelectElement || firstEl instanceof HTMLTextAreaElement) {
      firstEl.focus();
    } else {
      const input = firstEl.parentElement?.querySelector("input, select, textarea") as HTMLElement;
      if (input) input.focus();
    }
  }
}
