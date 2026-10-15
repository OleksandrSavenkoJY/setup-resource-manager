import { fetchSetup, fetchPrompt } from "@/lib/api";
import SetupDetailsClient from "@/components/SetupDetailsClient";

export default async function SetupDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const setup = await fetchSetup(Number(id));
  const promptData = await fetchPrompt(Number(id));

  return <SetupDetailsClient setup={setup} prompt={promptData.prompt} />;
}
