import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  recruiterContacts,
  recruiterInteractions,
} from "../../db/schema/index.js";
import type {
  CreateContactBody,
  CreateInteractionBody,
  PatchContactBody,
} from "./recruiters.schema.js";

export class RecruiterError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "RecruiterError";
  }
}

function toPublicContact(row: typeof recruiterContacts.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    role: row.role,
    linkedinUrl: row.linkedinUrl,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listContacts(userId: string) {
  const rows = await db
    .select()
    .from(recruiterContacts)
    .where(eq(recruiterContacts.userId, userId))
    .orderBy(desc(recruiterContacts.updatedAt));
  return { contacts: rows.map(toPublicContact) };
}

export async function createContact(userId: string, body: CreateContactBody) {
  const [row] = await db
    .insert(recruiterContacts)
    .values({
      userId,
      name: body.name,
      company: body.company,
      email: body.email,
      role: body.role,
      linkedinUrl: body.linkedinUrl,
      notes: body.notes,
    })
    .returning();
  return { contact: toPublicContact(row!) };
}

async function getOwnedContact(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(recruiterContacts)
    .where(and(eq(recruiterContacts.id, id), eq(recruiterContacts.userId, userId)))
    .limit(1);
  if (!row) throw new RecruiterError("Contact not found", 404);
  return row;
}

export async function getContact(userId: string, id: string) {
  const contact = await getOwnedContact(userId, id);
  const interactions = await db
    .select()
    .from(recruiterInteractions)
    .where(
      and(
        eq(recruiterInteractions.contactId, id),
        eq(recruiterInteractions.userId, userId),
      ),
    )
    .orderBy(desc(recruiterInteractions.happenedAt));
  return {
    contact: toPublicContact(contact),
    interactions: interactions.map((i) => ({
      id: i.id,
      kind: i.kind,
      summary: i.summary,
      applicationId: i.applicationId,
      happenedAt: i.happenedAt,
    })),
  };
}

export async function patchContact(
  userId: string,
  id: string,
  body: PatchContactBody,
) {
  await getOwnedContact(userId, id);
  const [row] = await db
    .update(recruiterContacts)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(recruiterContacts.id, id), eq(recruiterContacts.userId, userId)))
    .returning();
  return { contact: toPublicContact(row!) };
}

export async function deleteContact(userId: string, id: string) {
  await getOwnedContact(userId, id);
  await db
    .delete(recruiterContacts)
    .where(and(eq(recruiterContacts.id, id), eq(recruiterContacts.userId, userId)));
  return { ok: true as const };
}

export async function addInteraction(
  userId: string,
  contactId: string,
  body: CreateInteractionBody,
) {
  await getOwnedContact(userId, contactId);
  const [row] = await db
    .insert(recruiterInteractions)
    .values({
      userId,
      contactId,
      applicationId: body.applicationId,
      kind: body.kind,
      summary: body.summary,
      happenedAt: body.happenedAt ? new Date(body.happenedAt) : new Date(),
    })
    .returning();
  return {
    interaction: {
      id: row!.id,
      kind: row!.kind,
      summary: row!.summary,
      applicationId: row!.applicationId,
      happenedAt: row!.happenedAt,
    },
  };
}
