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

export async function changePassword(current_password: string, new_password: string) {
  return request("/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password, new_password }),
  });
}

export async function logout() {
  return request("/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export async function downloadExport(ids: number[], items: string[], scope: string) {
  const query = new URLSearchParams({ items: items.join(","), scope });
  if (ids.length) query.set("ids", ids.join(","));
  const res = await fetch(`/api/export?${query}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) window.location.href = "/login";
    let detail = "";
    try { detail = (await res.json()).detail; } catch {}
    throw new Error(typeof detail === "string" && detail ? detail : `Export failed (${res.status})`);
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
export const renameDeviceType = (id: number, name: string) =>
  request(`/device-types/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
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

export type AccessPoint = {
  id: number;
  name: string;
  model: string;
  wifi_standard: string;
  ip: string;
  username: string | null;
  password: string | null;
  automation: string;
  setup_id: number | null;
  setup_name: string | null;
  location: string;
  notes: string | null;
  has_photo: boolean;
  updated_at: string | null;
};
export type AccessPointInput = Omit<AccessPoint, "id" | "setup_name" | "has_photo" | "updated_at" | "username" | "password"> & { username: string; password: string };

export const fetchAccessPoints = (): Promise<AccessPoint[]> => request("/access-points");
export const createAccessPoint = (b: AccessPointInput): Promise<AccessPoint> =>
  request("/access-points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
export const updateAccessPoint = (id: number, b: AccessPointInput): Promise<AccessPoint> =>
  request(`/access-points/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
export async function deleteAccessPoint(id: number) {
  const res = await fetch(`/api/access-points/${id}`, { method: "DELETE", cache: "no-store" });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}
export const setSetupAccessPoints = (setupId: number, ids: number[]) =>
  request(`/setups/${setupId}/access-points`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
export async function exportAccessPoints(passwords: boolean) {
  const res = await fetch(`/api/access-points-export?passwords=${passwords}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const match = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] || "access-points.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
export const importAccessPoints = (file: File): Promise<{ created: number; updated: number }> =>
  request("/access-points-import", { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });

async function apPhotoRequest(id: number, init: RequestInit) {
  const res = await fetch(`/api/access-points/${id}/photo`, { ...init, cache: "no-store" });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch {}
    throw new Error(typeof detail === "string" ? detail : "Photo request failed");
  }
}
export const uploadAccessPointPhoto = (id: number, file: File) =>
  apPhotoRequest(id, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
export const deleteAccessPointPhoto = (id: number) => apPhotoRequest(id, { method: "DELETE" });

export async function fetchMapUrl(): Promise<string | null> {
  const res = await fetch("/api/office-map", { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load map (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

async function mapRequest(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch {}
    throw new Error(typeof detail === "string" ? detail : "Map request failed");
  }
}

export const uploadMap = (file: File) =>
  mapRequest("/api/office-map", { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
export const deleteMap = () => mapRequest("/api/office-map", { method: "DELETE" });
export const setSetupLocation = (setupId: number, pos: { x: number; y: number } | null) =>
  mapRequest(`/api/setups/${setupId}/location`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pos ?? { x: null, y: null }),
  });

export async function fetchNetworkSvg(setupId: number): Promise<string> {
  const res = await fetch(`/api/setups/${setupId}/network-diagram`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load network diagram (${res.status})`);
  return (await res.json()).svg as string;
}

export type TrashEntry = {
  id: number; original_id: number | null; name: string; devices: number; connections: number;
  has_photo: boolean; deleted_by: string; deleted_at: string | null; expires_at: string | null;
};

export const fetchTrash = (): Promise<TrashEntry[]> => request("/trash");
export const restoreFromTrash = (id: number): Promise<{ id: number }> =>
  request(`/trash/${id}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

async function requestNoContent(path: string) {
  const res = await fetch(`/api${path}`, { method: "DELETE", cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()) || res.statusText}`);
}
export const purgeFromTrash = (id: number) => requestNoContent(`/trash/${id}`);
export const emptyTrash = () => requestNoContent("/trash");

export const updateUsage = (id: number, usage: { used_by: string; used_until: string; usage_note: string }) =>
  request(`/setups/${id}/usage`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(usage),
  });

export type BulkRequest = {
  ids: number[];
  action: "add_tag" | "remove_tag" | "reserve" | "release" | "delete";
  tag?: string;
  used_by?: string;
  used_until?: string;
  usage_note?: string;
};
export const bulkAction = (body: BulkRequest): Promise<{ done: number; missing: number[]; trash_ids: number[] }> =>
  request("/setups/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
