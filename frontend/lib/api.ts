const API_BASE = process.env.API_INTERNAL_URL || "http://backend:8000";

export async function fetchSetups() {
  const res = await fetch(`${API_BASE}/setups`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch setups");
  return res.json();
}

export async function fetchSetup(id: number) {
  const res = await fetch(`${API_BASE}/setups/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch setup");
  return res.json();
}

export async function fetchPrompt(id: number) {
  const res = await fetch(`${API_BASE}/setups/${id}/prompt`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch prompt");
  return res.json();
}

export async function createSetup(payload: any) {
  const res = await fetch(`${API_BASE}/setups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create setup");
  return res.json();
}

export async function updateSetup(id: number, payload: any) {
  const res = await fetch(`${API_BASE}/setups/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update setup");
  return res.json();
}

export async function deleteSetup(id: number) {
  const res = await fetch(`${API_BASE}/setups/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete setup");
  return res.json();
}
