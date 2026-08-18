import { redirect } from "next/navigation";
import { getApplicationAction } from "@/lib/actions/applications";
import { DocumentReviewPanel } from "@/components/document-review-panel";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ id: string }> };

export default async function ApplicationReviewPage({ params }: Props) {
  const { id } = await params;
  const result = await getApplicationAction(id);
  if (!result.ok || !result.data) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">
            JobAutomater
          </span>
          <Button asChild variant="ghost" size="sm" className="cursor-pointer">
            <a href={`/applications/${id}/prep`}>Interview prep</a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="cursor-pointer">
            <a href="/dashboard">Back to dashboard</a>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <DocumentReviewPanel
          applicationId={id}
          initial={result.data}
        />
      </main>
    </div>
  );
}
