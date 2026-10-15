// Browser requests use the frontend origin. Only server-side calls use Docker DNS.
async function request(path: string, init?: RequestInit) {
  const base = typeof window === "undefined"
    ? (process.env.API_INTERNAL_URL || "http://backend:8000").replace(/\/$/, "")
    : "/api";
  const res = await fetch(`${base}${path}`, { ...init, cache: "no-store" });
  if (!res.ok) {
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

export async function deleteSetup(id: number) {
  return request(`/setups/${id}`, { method: "DELETE" });
}
