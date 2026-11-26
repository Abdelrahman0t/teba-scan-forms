import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = "http://135.181.168.228:8080";

async function handleProxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = Array.isArray(path) ? path.join("/") : path || "";
  const targetUrl = `${BACKEND_URL}/rest/v1/${pathStr}${request.nextUrl.search}`;

  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    // Do not forward hop-by-hop headers or host
    if (k !== "host" && k !== "connection" && k !== "transfer-encoding") {
      forwardHeaders.set(key, value);
    }
  });

  try {
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const bodyBuffer = hasBody ? await request.arrayBuffer() : undefined;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: bodyBuffer,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    const responseHeaders = new Headers();
    res.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (k !== "content-encoding" && k !== "transfer-encoding" && k !== "connection") {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error(`[API Proxy Error] ${request.method} ${targetUrl}:`, error);
    return NextResponse.json(
      {
        error: "Failed to connect to Supabase backend on VPS",
        message: error?.message || "Connection timeout or refused",
        target: targetUrl,
      },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const HEAD = handleProxy;
export const OPTIONS = handleProxy;
