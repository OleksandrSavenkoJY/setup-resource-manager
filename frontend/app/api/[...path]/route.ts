import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: { path: string[] } };

const AUTH_ROUTES: Record<string, string> = {
  "auth/status": "GET",
  "auth/me": "GET",
  "auth/login": "POST",
  "auth/logout": "POST",
  "auth/change-password": "POST",
  "auth/setup-admin": "POST",
};

async function proxy(request: Request, { params }: Context) {
  const path = params.path;
  const authMethod = AUTH_ROUTES[path.join("/")];
  const collection = path.length === 1 && path[0] === "setups";
  const item = path.length === 2 && path[0] === "setups" && /^[1-9]\d*$/.test(path[1]);
  const prompt = path.length === 3 && path[0] === "setups" && /^[1-9]\d*$/.test(path[1]) && path[2] === "prompt";

  const clone = path.length === 3 && path[0] === "setups" && /^[1-9]\d*$/.test(path[1]) && path[2] === "clone";

  const netDiagram = path.length === 3 && path[0] === "setups" && /^[1-9]\d*$/.test(path[1]) && path[2] === "network-diagram";
  const diagram = path.length === 3 && path[0] === "setups" && /^[1-9]\d*$/.test(path[1]) && path[2] === "diagram";

  const deviceTypes = (path[0] === "device-types" || path[0] === "interfaces") && (path.length === 1 || (path.length === 2 && /^[1-9]\d*$/.test(path[1])));
  const photo = path.length === 3 && path[0] === "setups" && /^[1-9]\d*$/.test(path[1]) && path[2] === "photo";
  const officeMap = path.length === 1 && path[0] === "office-map";
  const location = path.length === 3 && path[0] === "setups" && /^[1-9]\d*$/.test(path[1]) && path[2] === "location";
  const deviceIcons = path.length === 1 && path[0] === "device-icons";
  const num = (v?: string) => !!v && /^[1-9]\d*$/.test(v);
  const apCollection = path.length === 1 && path[0] === "access-points";
  const apItem = path.length === 2 && path[0] === "access-points" && num(path[1]);
  const apPhoto = path.length === 3 && path[0] === "access-points" && num(path[1]) && path[2] === "photo";
  const apExport = path.length === 1 && path[0] === "access-points-export";
  const apImport = path.length === 1 && path[0] === "access-points-import";
  const setupAps = path.length === 3 && path[0] === "setups" && num(path[1]) && path[2] === "access-points";
  const exportBundle = path.length === 1 && path[0] === "export";

  if (!authMethod && !apCollection && !apItem && !apPhoto && !apImport && !apExport && !setupAps && !collection && !item && !prompt && !clone && !diagram && !exportBundle && !deviceTypes && !deviceIcons && !photo && !officeMap && !location && !netDiagram) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }
  const allowed = authMethod
    ? [authMethod]
    : collection ? ["GET", "POST"]
    : item ? ["GET", "PUT", "DELETE"]
    : deviceTypes ? (path.length === 1 ? ["GET", "POST"] : path[0] === "device-types" ? ["DELETE", "PATCH"] : ["DELETE"])
    : apCollection ? ["GET", "POST"]
    : apItem ? ["GET", "PUT", "DELETE"]
    : apPhoto ? ["GET", "PUT", "DELETE"]
    : apImport ? ["POST"]
    : apExport ? ["GET"]
    : setupAps ? ["PUT"]
    : photo || officeMap ? ["GET", "PUT", "DELETE"]
    : location ? ["PUT"]
    : clone ? ["POST"]
    : diagram ? ["GET", "POST"]
    : ["GET"];
  if (!allowed.includes(request.method)) {
    return NextResponse.json({ detail: "Method not allowed" }, {
      status: 405,
      headers: { Allow: allowed.join(", ") },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), diagram || exportBundle ? 180000 : 15000);
  try {
    const base = (process.env.API_INTERNAL_URL || "http://backend:8000").replace(/\/$/, "");
    const upstreamHeaders: Record<string, string> = { "Content-Type": photo || officeMap || apPhoto || apImport ? request.headers.get("content-type") || "application/octet-stream" : "application/json" };
    const cookie = request.headers.get("cookie");
    if (cookie) upstreamHeaders.Cookie = cookie;

    const upstream = await fetch(`${base}/${path.join("/")}${new URL(request.url).search}`, {
      method: request.method,
      headers: upstreamHeaders,
      body: ((photo || officeMap || apPhoto) && request.method === "PUT") || apImport
        ? await request.arrayBuffer()
        : request.method === "POST" || request.method === "PUT" || request.method === "PATCH" ? await request.text() : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    const body = await upstream.arrayBuffer();
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    });
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);
    for (const setCookie of upstream.headers.getSetCookie()) {
      headers.append("Set-Cookie", setCookie);
    }
    return new Response(upstream.status === 204 || upstream.status === 304 ? null : body, {
      status: upstream.status,
      headers,
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
export const PATCH = proxy;
export const DELETE = proxy;
