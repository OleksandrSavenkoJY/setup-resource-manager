import SetupForm from "@/components/SetupForm";
import { fetchSetup } from "@/lib/server-api";

export default async function EditSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const setup = await fetchSetup(Number(id));

  return (
    <main>
      <h1>Edit setup</h1>
      <SetupForm mode="edit" initialData={setup} setupId={Number(id)} />
    </main>
  );
}
