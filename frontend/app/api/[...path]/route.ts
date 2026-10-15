import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: { path: string[] } };

async function proxy(request: Request, { params }: Context) {
  const path = params.path;
  const collection = path.length === 1 && path[0] === "setups";
  const item = path.length === 2 && path[0] === "setups" && /^[1-9]\d*$/.test(path[1]);
  const prompt = path.length === 3 && path[0] === "setups" && /^[1-9]\d*$/.test(path[1]) && path[2] === "prompt";

  if (!collection && !item && !prompt) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }
  const allowed = collection ? ["GET", "POST"] : item ? ["GET", "PUT", "DELETE"] : ["GET"];
  if (!allowed.includes(request.method)) {
    return NextResponse.json({ detail: "Method not allowed" }, {
      status: 405,
      headers: { Allow: allowed.join(", ") },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const base = (process.env.API_INTERNAL_URL || "http://backend:8000").replace(/\/$/, "");
    const upstream = await fetch(`${base}/${path.join("/")}`, {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      body: request.method === "POST" || request.method === "PUT" ? await request.text() : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    const body = await upstream.text();
    return new Response(upstream.status === 204 || upstream.status === 304 ? null : body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const timedOut = controller.signal.aborted;
    console.error("Setup API upstream request failed", error);
    return NextResponse.json({
      detail: timedOut
        ? "Backend request timed out. Check backend logs before retrying creation."
        : "Frontend could not reach backend. Check API_INTERNAL_URL and backend container logs.",
    }, { status: timedOut ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
