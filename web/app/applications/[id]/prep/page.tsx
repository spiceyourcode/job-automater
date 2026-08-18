import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InterviewPrepPanel } from "@/components/interview-prep-panel";
import { getInterviewPrepAction } from "@/lib/actions/applications";

type Props = { params: Promise<{ id: string }> };

export default async function InterviewPrepPage({ params }: Props) {
  const { id } = await params;
  const result = await getInterviewPrepAction(id);
  if (!result.ok) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex gap-2">
        <Button asChild variant="ghost" size="sm" className="cursor-pointer">
          <a href={`/applications/${id}/review`}>Documents</a>
        </Button>
      </div>
      <InterviewPrepPanel
        applicationId={id}
        initial={result.data?.prep ?? null}
        status={result.data?.status ?? "idle"}
      />
    </main>
  );
}
