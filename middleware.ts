import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://grqdctpkeitnloobuged.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdycWRjdHBrZWl0bmxvb2J1Z2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNTU1ODEsImV4cCI6MjEwMjgzMTU4MX0.Zak1r5j4A6scelu_PK9NhQDeF2gmPFW-CkSVbSvRdkY";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public auth routes and Next.js internals
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/pending") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options } as any);
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options } as any);
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options } as any);
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: "", ...options } as any);
      },
    },
  });

  // Check staff session cookie first
  const staffSession = request.cookies.get("ts_user_session")?.value;
  if (staffSession) {
    try {
      const parsed = JSON.parse(decodeURIComponent(staffSession));
      if (parsed?.id) {
        // If rejected, block and clear cookie immediately
        if (!parsed.is_admin && parsed.status === "rejected") {
          const loginUrl = request.nextUrl.clone();
          loginUrl.pathname = "/login";
          loginUrl.searchParams.set("rejected", "1");
          const redirectRes = NextResponse.redirect(loginUrl);
          redirectRes.cookies.set("ts_user_session", "", { path: "/", maxAge: 0 });
          return redirectRes;
        }

        // If pending and not already heading to /pending
        if (!parsed.is_admin && parsed.status === "pending" && !pathname.startsWith("/pending")) {
          const pendingUrl = request.nextUrl.clone();
          pendingUrl.pathname = "/pending";
          return NextResponse.redirect(pendingUrl);
        }

        return response;
      }
    } catch {
      // invalid cookie, continue to fallback check
    }
  }

  const { data: { session } } = await supabase.auth.getSession();

  // No session found → redirect to /login
  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, public files
     * - login page itself
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
