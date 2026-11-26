import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { request, type CurrentUser, type Diagram } from "./api";

// Server components must forward the browser's session cookie to the backend.
async function serverRequest(path: string) {
  const cookie = (await cookies()).toString();
  try {
    return await request(path, { headers: { cookie } });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("API 401")) redirect("/login");
    throw err;
  }
}

export const fetchSetup = (id: number) => serverRequest(`/setups/${id}`);
export const fetchPrompt = (id: number) => serverRequest(`/setups/${id}/prompt`);
export async function fetchDiagram(id: number): Promise<Diagram | null> {
  try {
    return await serverRequest(`/setups/${id}/diagram`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("API 404")) return null;
    throw err;
  }
}
export const fetchMe = (): Promise<CurrentUser> => serverRequest("/auth/me");

export async function requireAdmin() {
  const me = await fetchMe();
  if (me.role !== "admin") redirect("/");
  return me;
}
