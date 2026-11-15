import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MockInterviewPanel } from "@/components/mock-interview-panel";
import { getInterviewPrepAction, getMockInterviewAction, } from "@/lib/actions/applications";
type Props = {
    params: Promise<{
        id: string;
    }>;
};
export default async function MockInterviewPage({ params }: Props) {
    const { id } = await params;
    const [prep, mock] = await Promise.all([
        getInterviewPrepAction(id),
        getMockInterviewAction(id),
    ]);
    if (!prep.ok || !mock.ok) {
        redirect("/dashboard");
    }
    return (<main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex gap-2">
        <Button asChild variant="ghost" size="sm" className="cursor-pointer">
          <a href={`/applications/${id}/review`}>Documents</a>
        </Button>
        <Button asChild variant="ghost" size="sm" className="cursor-pointer">
          <a href={`/applications/${id}/prep`}>Interview prep</a>
        </Button>
      </div>
      <MockInterviewPanel applicationId={id} initialSession={mock.data?.session ?? null} prepStatus={prep.data?.status ?? "idle"}/>
    </main>);
}
