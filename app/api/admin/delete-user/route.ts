import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { profileId } = await request.json();
    if (!profileId) {
      return NextResponse.json({ error: "معرف الموظف مطلوب" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://135.181.168.228:8080";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q";

    // Use admin client with service_role to bypass RLS and guarantee deletion
    const supabase = createSupabaseClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify user profile exists and is not admin
    const { data: target, error: fetchErr } = await supabase
      .from("user_profiles")
      .select("id, full_name, is_admin")
      .eq("id", profileId)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!target) {
      return NextResponse.json({ error: "الموظف غير موجود أو تم حذفه بالفعل" }, { status: 404 });
    }

    if (target.is_admin) {
      return NextResponse.json({ error: "لا يمكن حذف حساب المسؤول" }, { status: 403 });
    }

    const { error: deleteErr } = await supabase
      .from("user_profiles")
      .delete()
      .eq("id", profileId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "حدث خطأ غير متوقع" }, { status: 500 });
  }
}
