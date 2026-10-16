import { fetchSetup, fetchPrompt, fetchDiagram, fetchMe } from "@/lib/server-api";
import SetupDetailsClient from "@/components/SetupDetailsClient";

export default async function SetupDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await fetchMe();
  const setup = await fetchSetup(Number(id));
  const diagram = await fetchDiagram(Number(id));
  // The prompt is admin-only on the backend, so guests never request it.
  const prompt = me.role === "admin" ? (await fetchPrompt(Number(id))).prompt : null;

  return <SetupDetailsClient setup={setup} prompt={prompt} diagram={diagram} />;
}
