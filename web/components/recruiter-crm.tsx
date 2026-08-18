"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createRecruiterAction,
  type RecruiterContact,
} from "@/lib/actions/recruiters";

export function RecruiterCrm({
  initial,
}: {
  initial: RecruiterContact[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");

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
            });
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            setName("");
            setCompany("");
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
        <Button type="submit" className="cursor-pointer" disabled={pending}>
          Add contact
        </Button>
      </form>
      <ul className="space-y-2 text-sm">
        {initial.length === 0 ? (
          <li className="text-muted-foreground">No recruiter contacts yet.</li>
        ) : (
          initial.map((c) => (
            <li key={c.id} className="rounded-md border px-3 py-2">
              <span className="font-medium">{c.name}</span>
              {c.company ? (
                <span className="text-muted-foreground"> · {c.company}</span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
