// Browser requests use the frontend origin. Only server-side calls use Docker DNS.
export async function request(path: string, init?: RequestInit) {
  const isBrowser = typeof window !== "undefined";
  const base = isBrowser
    ? "/api"
    : (process.env.API_INTERNAL_URL || "http://backend:8000").replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, { ...init, cache: "no-store" });
  if (!res.ok) {
    if (
      isBrowser &&
      res.status === 401 &&
      !["/login", "/setup-admin"].includes(window.location.pathname)
    ) {
      window.location.href = "/login";
    }
    const text = await res.text();
    let detail = text;
    try {
      const data = JSON.parse(text);
      detail = typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail ?? data);
    } catch {
      // Keep a plain-text upstream error when the response is not JSON.
    }
    throw new Error(`API ${res.status}: ${detail || res.statusText}`);
  }
  return res.json();
}

export async function fetchSetups() {
  return request("/setups");
}

export async function fetchSetup(id: number) {
  return request(`/setups/${id}`);
}

export async function fetchPrompt(id: number) {
  return request(`/setups/${id}/prompt`);
}

export async function createSetup(payload: unknown) {
  return request("/setups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateSetup(id: number, payload: unknown) {
  return request(`/setups/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function cloneSetup(id: number) {
  return request(`/setups/${id}/clone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export type Diagram = { svg: string; generated_at: string; drawio_xml?: string };

export async function generateDiagram(id: number): Promise<Diagram> {
  return request(`/setups/${id}/diagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function deleteSetup(id: number) {
  return request(`/setups/${id}`, { method: "DELETE" });
}

export type CurrentUser = { username: string; role: "admin" | "guest" };

export async function fetchAuthStatus(): Promise<{ admin_configured: boolean }> {
  return request("/auth/status");
}

export async function fetchMe(): Promise<CurrentUser> {
  return request("/auth/me");
}

export async function login(username: string, password: string): Promise<CurrentUser> {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function setupAdmin(password: string): Promise<CurrentUser> {
  return request("/auth/setup-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export async function logout() {
  return request("/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function downloadExport(setupId: number | null, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const path = setupId ? `/export/setups/${setupId}` : "/export/setups";
  const res = await fetch(`/api${path}?${query}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) window.location.href = "/login";
    throw new Error(`Export failed (${res.status})`);
  }
  const match = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] || "export";
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchDeviceTypes() {
  return request("/device-types");
}

async function deleteOption(base: string, id: number) {
  const res = await fetch(`/api/${base}/${id}`, { method: "DELETE", cache: "no-store" });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch {}
    throw new Error(typeof detail === "string" ? detail : "Failed to delete type");
  }
}

export const fetchDeviceIcons = () => request("/device-icons");
export const setDeviceTypeIcon = (id: number, icon: string) =>
  request(`/device-types/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ icon }),
  });
export const deleteDeviceType = (id: number) => deleteOption("device-types", id);
export const deleteInterface = (id: number) => deleteOption("interfaces", id);
export const fetchInterfaces = () => request("/interfaces");
export const createInterface = (name: string) =>
  request("/interfaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export async function createDeviceType(name: string) {
  return request("/device-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function fetchPhotoUrl(setupId: number): Promise<string | null> {
  const res = await fetch(`/api/setups/${setupId}/photo`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load photo (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

async function photoRequest(setupId: number, init: RequestInit) {
  const res = await fetch(`/api/setups/${setupId}/photo`, { ...init, cache: "no-store" });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch {}
    throw new Error(typeof detail === "string" ? detail : "Photo request failed");
  }
}

export const uploadPhoto = (setupId: number, file: File) =>
  photoRequest(setupId, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
export const deletePhoto = (setupId: number) => photoRequest(setupId, { method: "DELETE" });
