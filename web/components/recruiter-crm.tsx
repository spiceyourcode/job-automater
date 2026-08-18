"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createRecruiterAction,
  type RecruiterContact,
} from "@/lib/actions/recruiters";

function ContactList({
  title,
  empty,
  contacts,
}: {
  title: string;
  empty: string;
  contacts: RecruiterContact[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="space-y-2 text-sm">
        {contacts.length === 0 ? (
          <li className="text-muted-foreground">{empty}</li>
        ) : (
          contacts.map((c) => (
            <li key={c.id} className="rounded-md border px-3 py-2">
              <span className="font-medium">{c.name}</span>
              {c.company ? (
                <span className="text-muted-foreground"> · {c.company}</span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export function RecruiterCrm({
  initial,
}: {
  initial: RecruiterContact[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [referral, setReferral] = useState(false);
  const recruiters = initial.filter((c) => c.kind !== "referral");
  const referrals = initial.filter((c) => c.kind === "referral");

  return (
    <div className="space-y-8">
      <form
        className="grid max-w-md gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await createRecruiterAction({
              name,
              company: company || undefined,
              kind: referral ? "referral" : "recruiter",
            });
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            setName("");
            setCompany("");
            setReferral(false);
            toast.success("Contact saved");
            router.refresh();
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="rec-name">Name</Label>
          <Input
            id="rec-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rec-company">Company</Label>
          <Input
            id="rec-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="rec-referral"
            checked={referral}
            onCheckedChange={(v) => setReferral(v === true)}
          />
          <Label htmlFor="rec-referral">Referral contact</Label>
        </div>
        <Button type="submit" className="cursor-pointer" disabled={pending}>
          Add contact
        </Button>
      </form>
      <ContactList
        title="Recruiters"
        empty="No recruiter contacts yet."
        contacts={recruiters}
      />
      <ContactList
        title="Referral network"
        empty="No referral contacts yet."
        contacts={referrals}
      />
    </div>
  );
}
