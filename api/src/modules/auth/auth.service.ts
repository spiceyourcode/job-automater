import { hash, compare } from "bcryptjs";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema/index.js";
import {
  users,
  userSessions,
  workspaces,
  workspaceMembers,
} from "../../db/schema/index.js";
import type { WorkspaceRole } from "../../db/schema/workspaces.js";
import { signAccessToken } from "../../lib/jwt.js";
import {
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
} from "../../lib/token.js";
import type {
  RegisterBody,
  LoginBody,
  TokenPair,
  AuthUser,
} from "./auth.schema.js";

type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

const BCRYPT_ROUNDS = 12;

// Pre-computed dummy hash — ensures login always runs bcrypt.compare
// regardless of whether the email exists (prevents timing enumeration).
const DUMMY_HASH =
  "$2a$12$dummy.hash.for.timing.protection.only.AAAAAAAAAAAAAAAA";

/** Generic auth error — never reveal which of email/password was wrong. */
export class AuthError extends Error {
  readonly statusCode = 401;
  constructor() {
    super("Invalid credentials");
    this.name = "AuthError";
  }
}

export class ConflictError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

async function createPersonalWorkspace(
  tx: Tx,
  userId: string,
  email: string,
): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const label = email.split("@")[0] || "User";
  const [ws] = await tx
    .insert(workspaces)
    .values({
      name: `${label}'s workspace`,
      ownerUserId: userId,
    })
    .returning({ id: workspaces.id });
  if (!ws) throw new Error("Failed to create workspace");
  await tx.insert(workspaceMembers).values({
    workspaceId: ws.id,
    userId,
    role: "owner",
  });
  return { workspaceId: ws.id, role: "owner" };
}

async function resolveMembership(
  tx: Tx,
  userId: string,
  email: string,
): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const [row] = await tx
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);
  if (row) {
    return {
      workspaceId: row.workspaceId,
      role: row.role as WorkspaceRole,
    };
  }
  return createPersonalWorkspace(tx, userId, email);
}

const issueTokens = async (
  tx: Tx,
  userId: string,
  email: string,
  role: WorkspaceRole,
  workspaceId: string,
  userAgent?: string | null,
  ipAddress?: string | null,
): Promise<TokenPair> => {
  const accessToken = await signAccessToken({
    sub: userId,
    email,
    role,
    workspaceId,
  });
  const rawRefresh = generateRefreshToken();
  const tokenHash = hashToken(rawRefresh);

  await tx.insert(userSessions).values({
    userId,
    tokenHash,
    userAgent: userAgent ?? null,
    ipAddress: ipAddress ?? null,
    expiresAt: refreshTokenExpiry(),
  });

  return { accessToken, refreshToken: rawRefresh };
};

/** Parse first IP from x-forwarded-for (may be comma-separated). */
export const parseClientIp = (header: string | null | undefined): string | null => {
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first ?? null;
};

export const register = async (
  body: RegisterBody,
  userAgent?: string | null,
  rawIp?: string | null,
): Promise<{ user: AuthUser; tokens: TokenPair }> => {
  const ipAddress = parseClientIp(rawIp);
  const passwordHash = await hash(body.password, BCRYPT_ROUNDS);

  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: body.email,
          passwordHash,
          name: body.name ?? null,
        })
        .returning({ id: users.id, email: users.email, name: users.name });

      if (!user) throw new Error("Failed to create user");

      const membership = await createPersonalWorkspace(tx, user.id, user.email);
      const tokens = await issueTokens(
        tx,
        user.id,
        user.email,
        membership.role,
        membership.workspaceId,
        userAgent,
        ipAddress,
      );
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          role: membership.role,
          workspaceId: membership.workspaceId,
        },
        tokens,
      };
    });
  } catch (err: unknown) {
    // Postgres unique violation (23505) means duplicate email
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      throw new ConflictError("Unable to create account");
    }
    throw err;
  }
};

export const login = async (
  body: LoginBody,
  userAgent?: string | null,
  rawIp?: string | null,
): Promise<{ user: AuthUser; tokens: TokenPair }> => {
  const ipAddress = parseClientIp(rawIp);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(and(eq(users.email, body.email), isNull(users.deletedAt)))
    .limit(1);

  // Always run compare to prevent timing-based email enumeration
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const valid = await compare(body.password, hashToCompare);

  if (!user || !valid) throw new AuthError();

  return await db.transaction(async (tx) => {
    const membership = await resolveMembership(tx, user.id, user.email);
    const tokens = await issueTokens(
      tx,
      user.id,
      user.email,
      membership.role,
      membership.workspaceId,
      userAgent,
      ipAddress,
    );
    await tx
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        role: membership.role,
        workspaceId: membership.workspaceId,
      },
      tokens,
    };
  });
};

export const refresh = async (
  rawToken: string,
  userAgent?: string | null,
  rawIp?: string | null,
): Promise<TokenPair> => {
  const ipAddress = parseClientIp(rawIp);
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  return await db.transaction(async (tx) => {
    // Atomically revoke the session — only succeeds if not already revoked
    const [revoked] = await tx
      .update(userSessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(userSessions.tokenHash, tokenHash),
          isNull(userSessions.revokedAt),
          sql`${userSessions.expiresAt} > ${now}`,
        ),
      )
      .returning({
        id: userSessions.id,
        userId: userSessions.userId,
        expiresAt: userSessions.expiresAt,
        revokedAt: userSessions.revokedAt,
      });

    if (!revoked) {
      // Could be reuse of already-revoked token — revoke all sessions for safety
      const [existingSession] = await tx
        .select({ userId: userSessions.userId })
        .from(userSessions)
        .where(eq(userSessions.tokenHash, tokenHash))
        .limit(1);

      if (existingSession) {
        await tx
          .update(userSessions)
          .set({ revokedAt: now })
          .where(
            and(
              eq(userSessions.userId, existingSession.userId),
              isNull(userSessions.revokedAt),
            ),
          );
      }

      throw new AuthError();
    }

    const [user] = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.id, revoked.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new AuthError();

    const membership = await resolveMembership(tx, user.id, user.email);
    return issueTokens(
      tx,
      user.id,
      user.email,
      membership.role,
      membership.workspaceId,
      userAgent,
      ipAddress,
    );
  });
};

export const logout = async (userId: string): Promise<void> => {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)),
    );
};

export const getMe = async (userId: string): Promise<AuthUser> => {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!user) throw new AuthError();
  const membership = await db.transaction(async (tx) =>
    resolveMembership(tx, user.id, user.email),
  );
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: membership.role,
    workspaceId: membership.workspaceId,
  };
};
