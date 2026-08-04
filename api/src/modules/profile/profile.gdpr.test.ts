import { beforeEach, describe, expect, it, vi } from "vitest";

const { deletedTables } = vi.hoisted(() => {
  const deletedTables: unknown[] = [];
  return { deletedTables };
});

vi.mock("../../db/index.js", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        delete: (table: unknown) => ({
          where: () => {
            deletedTables.push(table);
            const result = Promise.resolve([]) as unknown as Promise<unknown[]> & {
              returning: () => Promise<{ id: string }[]>;
            };
            result.returning = async () => [{ id: "user-a" }];
            return result;
          },
        }),
      };
      return fn(tx);
    },
  },
}));

vi.mock("../../lib/s3.js", () => ({
  getPresignedGetUrl: vi.fn(async (k: string) => k),
  uploadObject: vi.fn(),
}));

import { cvChunks, emails, jobScores, notifications, users, userSessions } from "../../db/schema/index.js";
import { deleteUserAccount } from "./profile.service.js";

describe("deleteUserAccount (GDPR)", () => {
  beforeEach(() => {
    deletedTables.length = 0;
  });

  it("explicitly deletes cv_chunks before cascading the user", async () => {
    const result = await deleteUserAccount("user-a");
    expect(result).toEqual({ deleted: true, userId: "user-a" });
    expect(deletedTables[0]).toBe(cvChunks);
    expect(deletedTables).toContain(emails);
    expect(deletedTables).toContain(notifications);
    expect(deletedTables).toContain(jobScores);
    expect(deletedTables).toContain(userSessions);
    expect(deletedTables.at(-1)).toBe(users);
  });
});
