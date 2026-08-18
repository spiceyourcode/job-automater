import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { VideoCoverPanel } from "@/components/video-cover-panel";
import { getVideoCoverAction } from "@/lib/actions/applications";

type Props = { params: Promise<{ id: string }> };

export default async function VideoCoverPage({ params }: Props) {
  const { id } = await params;
  const result = await getVideoCoverAction(id);
  if (!result.ok) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex gap-2">
        <Button asChild variant="ghost" size="sm" className="cursor-pointer">
          <a href={`/applications/${id}/review`}>Documents</a>
        </Button>
        <Button asChild variant="ghost" size="sm" className="cursor-pointer">
          <a href={`/applications/${id}/prep`}>Interview prep</a>
        </Button>
      </div>
      <VideoCoverPanel
        applicationId={id}
        initial={result.data?.script ?? null}
        status={result.data?.status ?? "idle"}
      />
    </main>
  );
}
