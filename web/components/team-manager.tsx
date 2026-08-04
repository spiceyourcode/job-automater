"use client";

import { useState, useTransition } from "react";
import {
  inviteTeamMemberAction,
  type TeamMember,
} from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = { initialMembers: TeamMember[]; canManage: boolean };

export function TeamManager({ initialMembers, canManage }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "viewer">("member");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <ul className="divide-y rounded-lg border">
        {members.map((m) => (
          <li
            key={m.userId}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{m.name ?? m.email}</p>
              <p className="text-xs text-muted-foreground">{m.email}</p>
            </div>
            <span className="font-mono text-xs uppercase text-muted-foreground">
              {m.role}
            </span>
          </li>
        ))}
      </ul>

      {canManage && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const res = await inviteTeamMemberAction(email, role);
              if (!res.ok) setError(res.error);
              else {
                setMembers((prev) => [
                  ...prev,
                  {
                    userId: crypto.randomUUID(),
                    email,
                    role,
                    name: null,
                  },
                ]);
                setEmail("");
              }
            });
          }}
        >
          <div className="space-y-1">
            <label htmlFor="invite-email" className="text-xs text-muted-foreground">
              Invite by email
            </label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-56"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="invite-role" className="text-xs text-muted-foreground">
              Role
            </label>
            <select
              id="invite-role"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "viewer")}
            >
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <Button type="submit" disabled={pending} className="cursor-pointer">
            Invite
          </Button>
        </form>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
