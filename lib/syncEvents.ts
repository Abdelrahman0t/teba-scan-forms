"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export const FORM_SYNC_CHANNEL_NAME = "medical_form_sync";

export interface SyncPayload {
  type: string;
  formType?: string;
  patientId?: string | null;
  timestamp: number;
}

/**
 * Call this function immediately after any form is successfully inserted or updated.
 * It broadcasts the event across all open tabs, windows, and within the current window.
 */
export function notifyFormSubmission(details?: { formType?: string; patientId?: string | null }) {
  if (typeof window === "undefined") return;

  const payload: SyncPayload = {
    type: "FORM_SUBMITTED",
    formType: details?.formType,
    patientId: details?.patientId ?? null,
    timestamp: Date.now(),
  };

  // 1. BroadcastChannel for instant cross-tab communication (same browser profile)
  try {
    if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel(FORM_SYNC_CHANNEL_NAME);
      bc.postMessage(payload);
      bc.close();
    }
  } catch (e) {
    console.warn("BroadcastChannel error:", e);
  }

  // 2. Storage event fallback for older browsers or restricted tab environments
  try {
    localStorage.setItem(FORM_SYNC_CHANNEL_NAME, JSON.stringify(payload));
  } catch (e) {}

  // 3. CustomEvent for the current window/tab (e.g. modals, drawer forms)
  try {
    window.dispatchEvent(new CustomEvent(FORM_SYNC_CHANNEL_NAME, { detail: payload }));
  } catch (e) {}
}

/** Alias for notifyFormSubmission */
export const broadcastFormSync = notifyFormSubmission;

const REALTIME_TABLES = [
  "patients",
  "form_submissions",
  "radiation_exposure_logs",
  "health_education_assessments",
  "fall_risk_screenings",
  "fall_risk_adult_assessments",
  "fall_risk_pediatric_assessments",
  "patient_assessments",
  "patient_transfers",
];

/**
 * Hook to automatically keep components in sync in real-time without manual page refresh.
 * Reacts to:
 *  - Form submissions from any tab (BroadcastChannel / LocalStorage / CustomEvent)
 *  - Supabase Realtime database changes across different Chrome profiles / devices
 *  - Window focus / tab switching / visibility changes
 *  - Smart background polling (every 3.5s when visible) as a guaranteed fallback
 */
export function useFormSync(onSync: (payload?: SyncPayload) => void, enabled: boolean = true) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let debounceTimer: NodeJS.Timeout | null = null;
    const triggerSync = (payload?: SyncPayload) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onSyncRef.current(payload);
      }, 100);
    };

    // 1. BroadcastChannel listener (Instant inside same Chrome profile)
    let bc: BroadcastChannel | null = null;
    try {
      if ("BroadcastChannel" in window) {
        bc = new BroadcastChannel(FORM_SYNC_CHANNEL_NAME);
        bc.onmessage = (event) => {
          if (event.data?.type === "FORM_SUBMITTED") {
            triggerSync(event.data);
          }
        };
      }
    } catch (e) {
      console.warn("BroadcastChannel init error:", e);
    }

    // 2. LocalStorage storage event listener
    const handleStorage = (e: StorageEvent) => {
      if (e.key === FORM_SYNC_CHANNEL_NAME && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          triggerSync(data);
        } catch (err) {}
      }
    };
    window.addEventListener("storage", handleStorage);

    // 3. CustomEvent in same window listener
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SyncPayload>;
      triggerSync(customEvent.detail);
    };
    window.addEventListener(FORM_SYNC_CHANNEL_NAME, handleCustomEvent);

    // 4. Window focus & Visibility change listeners (instant check upon focusing tab/window)
    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        onSyncRef.current();
      }
    };
    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);

    // 5. Smart live background polling (Every 2.5s when visible)
    // Guarantees cross-profile & cross-device updates even if Supabase Realtime publication is not configured
    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        triggerSync();
      }
    }, 2500);

    // 6. Supabase Realtime Subscription (Multi-user / multi-account live push via WebSockets)
    const supabase = createClient();
    const channelName = "db-sync-" + Math.random().toString(36).substring(7);
    let channel = supabase.channel(channelName);

    REALTIME_TABLES.forEach((tbl) => {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tbl,
        },
        () => {
          triggerSync();
        }
      );
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // channel active
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(pollInterval);
      if (bc) {
        try {
          bc.close();
        } catch (e) {}
      }
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(FORM_SYNC_CHANNEL_NAME, handleCustomEvent);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
