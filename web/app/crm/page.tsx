import { RecruiterCrm } from "@/components/recruiter-crm";
import { listRecruitersAction } from "@/lib/actions/recruiters";

export default async function CrmPage() {
  const listed = await listRecruitersAction();
  const contacts = listed.ok ? (listed.data?.contacts ?? []) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Recruiter CRM</h1>
        <p className="text-sm text-muted-foreground">
          Track recruiters, referrals, and follow-ups. Contacts stay private to you.
        </p>
      </div>
      {!listed.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {listed.error}
        </p>
      ) : (
        <RecruiterCrm initial={contacts} />
      )}
    </div>
  );
}
