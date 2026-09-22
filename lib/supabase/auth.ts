"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { normalizeArabicNumbers } from "@/lib/numberUtils";

export type UserRole = "nurse" | "technician" | "radiologist" | "admission";

export interface UserProfile {
  id: string;
  full_name: string;
  username?: string;
  phone: string;
  role: UserRole;
  status: "pending" | "approved" | "rejected";
  is_admin: boolean;
  created_at?: string;
}

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  status: "pending" | "approved" | "rejected" | null;
  isAdmin: boolean;
  loading: boolean;
}

export const SESSION_KEY = "ts_user_session";

/** Cleans a phone number (converts Arabic digits and removes spaces/symbols) */
export function cleanPhoneNumber(input: string): string {
  return normalizeArabicNumbers(input).replace(/[^0-9+]/g, "").trim();
}

/** Standard SHA-256 password hasher using standard Web Crypto API */
export async function hashPassword(password: string): Promise<string> {
  const trimmed = password.trim();
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return trimmed;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(trimmed);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function setLocalSession(profile: UserProfile) {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(profile);
  localStorage.setItem(SESSION_KEY, json);
  // Set cookie for 30 days so Next.js middleware detects session
  document.cookie = `${SESSION_KEY}=${encodeURIComponent(json)}; path=/; max-age=2592000; SameSite=Lax`;
}

export function getLocalSession(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLocalSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  document.cookie = `${SESSION_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

export function useUser(): AuthState {
  const supabase = createClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    status: null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function syncSession() {
      const cached = getLocalSession();
      if (!cached) {
        if (mounted) {
          setState({
            user: null,
            profile: null,
            role: null,
            status: null,
            isAdmin: false,
            loading: false,
          });
        }
        return;
      }

      // Immediately kick out cached rejected non-admin
      if (!cached.is_admin && cached.status === "rejected") {
        clearLocalSession();
        if (mounted) {
          setState({
            user: null,
            profile: null,
            role: null,
            status: null,
            isAdmin: false,
            loading: false,
          });
        }
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login?rejected=1";
        }
        return;
      }

      // Immediately render cached profile
      if (mounted) {
        setState({
          user: { id: cached.id, email: cached.phone } as any,
          profile: cached,
          role: cached.role,
          status: cached.status,
          isAdmin: cached.is_admin,
          loading: false,
        });
      }

      // Re-verify in background from Supabase
      try {
        const { data: latest, error } = await supabase
          .from("user_profiles")
          .select("id, full_name, username, phone, role, status, is_admin, created_at")
          .eq("id", cached.id)
          .maybeSingle();

        // 1. User was deleted from the system
        if (!latest || error) {
          clearLocalSession();
          if (mounted) {
            setState({
              user: null,
              profile: null,
              role: null,
              status: null,
              isAdmin: false,
              loading: false,
            });
          }
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login";
          }
          return;
        }

        // 2. User was rejected by the admin
        if (!latest.is_admin && latest.status === "rejected") {
          clearLocalSession();
          if (mounted) {
            setState({
              user: null,
              profile: null,
              role: null,
              status: null,
              isAdmin: false,
              loading: false,
            });
          }
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login?rejected=1";
          }
          return;
        }

        // 3. User was changed to pending
        if (!latest.is_admin && latest.status === "pending") {
          setLocalSession(latest as UserProfile);
          if (mounted) {
            setState({
              user: { id: latest.id, email: latest.phone } as any,
              profile: latest as UserProfile,
              role: latest.role as UserRole,
              status: "pending",
              isAdmin: false,
              loading: false,
            });
          }
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/pending") && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/pending";
          }
          return;
        }

        // 4. Approved active user
        if (mounted) {
          setLocalSession(latest as UserProfile);
          setState({
            user: { id: latest.id, email: latest.phone } as any,
            profile: latest as UserProfile,
            role: latest.role as UserRole,
            status: latest.status as AuthState["status"],
            isAdmin: latest.is_admin,
            loading: false,
          });
        }
      } catch {
        // network error: retain current memory state
      }
    }

    syncSession();

    function handleStorage(e: StorageEvent) {
      if (e.key === SESSION_KEY) {
        syncSession();
      }
    }

    // Immediate check when user switches back to tab
    window.addEventListener("focus", syncSession);
    window.addEventListener("storage", handleStorage);

    // Fast interval check (every 3 seconds) to immediately evict staff if admin rejected/deleted them
    const interval = setInterval(syncSession, 3000);

    return () => {
      mounted = false;
      window.removeEventListener("focus", syncSession);
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  return state;
}

/** Helper: get display label for a role */
export function getRoleLabel(role: UserRole | null): string {
  switch (role) {
    case "nurse":       return "ممرضة / أخصائي تمريض";
    case "technician":  return "فني الأشعة";
    case "radiologist": return "طبيب / أخصائي الأشعة";
    case "admission":   return "مكتب الدخول والاستقبال";
    default:            return "غير محدد";
  }
}

/** Helper: get badge color class for a role */
export function getRoleBadgeClass(role: UserRole | null): string {
  switch (role) {
    case "nurse":       return "bg-blue-100 text-blue-800 border-blue-300";
    case "technician":  return "bg-amber-100 text-amber-800 border-amber-300";
    case "radiologist": return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "admission":   return "bg-purple-100 text-purple-900 border-purple-300";
    default:            return "bg-slate-100 text-slate-600 border-slate-300";
  }
}
