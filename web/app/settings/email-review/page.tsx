import { EmailReviewQueue, type ReviewEmail } from "@/components/email-review-queue";
import { listEmailReviewAction } from "@/lib/actions/emails";

export default async function EmailReviewPage() {
  const listed = await listEmailReviewAction();
  const emails = (listed.ok && listed.data ? listed.data.emails : []) as ReviewEmail[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Email review</h1>
        <p className="text-sm text-muted-foreground">
          Confirm the category for low-confidence messages. This never changes
          application status automatically.
        </p>
      </div>
      {!listed.ok ? (
        <p className="mb-4 text-sm text-destructive">{listed.error}</p>
      ) : null}
      <EmailReviewQueue initial={emails} />
    </div>
  );
}
