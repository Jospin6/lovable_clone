import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const pathname = path.join("/");
  const allowed = request.method === "POST"
    ? pathname === "generate"
    : pathname === "health" || /^projects\/[a-f0-9-]{36}(\/download)?$/.test(pathname);
  if (!allowed) return Response.json({ detail: "Route introuvable." }, { status: 404 });

  const backend = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  try {
    const upstream = await fetch(`${backend}/api/${pathname}`, {
      method: request.method,
      headers: { "Content-Type": "application/json", Accept: "text/event-stream, application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      signal: request.signal,
    });
    const headers = new Headers({ "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
    for (const name of ["content-type", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json(
      { detail: "Le backend est injoignable. Démarrez FastAPI sur le port 8000, puis réessayez." },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
