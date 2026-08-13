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
  authTokens,
} from "../../db/schema/index.js";
import type { WorkspaceRole } from "../../db/schema/workspaces.js";
import { env } from "../../env.js";
import { signAccessToken } from "../../lib/jwt.js";
import {
  generateAuthActionToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
  emailVerifyExpiry,
  passwordResetExpiry,
} from "../../lib/token.js";
import {
  passwordResetEmail,
  sendMail,
  verificationEmail,
} from "../../lib/mailer.js";
import {
  buildAuthorizeUrl,
  createOAuthState,
  fetchOAuthProfile,
  isOAuthConfigured,
  pkcePair,
  type OAuthProvider,
} from "../../lib/oauth.js";
import { saveOAuthState, takeOAuthState } from "../../lib/oauth-state.js";
import { createClient } from "redis";
import type {
  RegisterBody,
  LoginBody,
  TokenPair,
  AuthUser,
  ForgotPasswordBody,
  ResetPasswordBody,
  VerifyEmailBody,
  PatchMeBody,
  SessionView,
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

export class BadRequestError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

async function issueAuthToken(
  tx: Tx,
  userId: string,
  type: "email_verify" | "password_reset",
  expiresAt: Date,
): Promise<string> {
  // Invalidate prior unused tokens of this type
  await tx
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
      ),
    );

  const raw = generateAuthActionToken();
  await tx.insert(authTokens).values({
    userId,
    tokenHash: hashToken(raw),
    type,
    expiresAt,
  });
  return raw;
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
      const verifyRaw = await issueAuthToken(
        tx,
        user.id,
        "email_verify",
        emailVerifyExpiry(),
      );
      const tokens = await issueTokens(
        tx,
        user.id,
        user.email,
        membership.role,
        membership.workspaceId,
        userAgent,
        ipAddress,
      );

      // Send after commit path — fire inside tx is ok for local outbox
      await sendMail(
        verificationEmail({
          to: user.email,
          verifyUrl: `${env.appUrl}/verify-email?token=${verifyRaw}`,
        }),
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          emailVerified: false,
          avatarUrl: null,
          timezone: "UTC",
          locale: "en-US",
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
      emailVerified: users.emailVerified,
      avatarUrl: users.avatarUrl,
      timezone: users.timezone,
      locale: users.locale,
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
        emailVerified: user.emailVerified,
        avatarUrl: user.avatarUrl ?? null,
        timezone: user.timezone,
        locale: user.locale,
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
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      avatarUrl: users.avatarUrl,
      timezone: users.timezone,
      locale: users.locale,
    })
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
    emailVerified: user.emailVerified,
    avatarUrl: user.avatarUrl ?? null,
    timezone: user.timezone,
    locale: user.locale,
    role: membership.role,
    workspaceId: membership.workspaceId,
  };
};

export const patchMe = async (
  userId: string,
  body: PatchMeBody,
): Promise<AuthUser> => {
  const [updated] = await db
    .update(users)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
    })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      avatarUrl: users.avatarUrl,
      timezone: users.timezone,
      locale: users.locale,
    });

  if (!updated) throw new AuthError();
  const membership = await db.transaction(async (tx) =>
    resolveMembership(tx, updated.id, updated.email),
  );
  return {
    id: updated.id,
    email: updated.email,
    name: updated.name ?? null,
    emailVerified: updated.emailVerified,
    avatarUrl: updated.avatarUrl ?? null,
    timezone: updated.timezone,
    locale: updated.locale,
    role: membership.role,
    workspaceId: membership.workspaceId,
  };
};

/** Active (non-revoked, non-expired) sessions for the caller only. */
export const listSessions = async (userId: string): Promise<SessionView[]> => {
  const now = new Date();
  const rows = await db
    .select({
      id: userSessions.id,
      userAgent: userSessions.userAgent,
      ipAddress: userSessions.ipAddress,
      createdAt: userSessions.createdAt,
      expiresAt: userSessions.expiresAt,
    })
    .from(userSessions)
    .where(
      and(
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt),
        sql`${userSessions.expiresAt} > ${now}`,
      ),
    );

  return rows.map((r) => ({
    id: r.id,
    userAgent: r.userAgent,
    ipAddress: r.ipAddress ? String(r.ipAddress) : null,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
  }));
};

/**
 * Revoke a session by id. Ownership required — other users' sessions → 404 (no IDOR).
 * Sets revoked_at so the refresh token can no longer rotate.
 */
export const revokeSession = async (
  userId: string,
  sessionId: string,
): Promise<void> => {
  const now = new Date();
  const [row] = await db
    .update(userSessions)
    .set({ revokedAt: now })
    .where(
      and(
        eq(userSessions.id, sessionId),
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt),
      ),
    )
    .returning({ id: userSessions.id });

  if (!row) throw new NotFoundError();
};

/**
 * Mark email verified via single-use token.
 * Token alone identifies the user — never accept userId from body (FAILURE clause).
 */
export const verifyEmail = async (body: VerifyEmailBody): Promise<{ ok: true }> => {
  const tokenHash = hashToken(body.token);
  const now = new Date();

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, "email_verify"),
          isNull(authTokens.usedAt),
          sql`${authTokens.expiresAt} > ${now}`,
        ),
      )
      .returning({ userId: authTokens.userId });

    if (!row) throw new BadRequestError("Invalid or expired verification token");

    await tx
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, row.userId));

    return { ok: true as const };
  });
};

/** Always returns the same message — no email enumeration. */
export const forgotPassword = async (
  body: ForgotPasswordBody,
): Promise<{ ok: true; message: string }> => {
  const message =
    "If an account exists for that email, a reset link has been sent.";

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.email, body.email), isNull(users.deletedAt)))
    .limit(1);

  if (!user) return { ok: true, message };

  const raw = await db.transaction(async (tx) =>
    issueAuthToken(tx, user.id, "password_reset", passwordResetExpiry()),
  );

  await sendMail(
    passwordResetEmail({
      to: user.email,
      resetUrl: `${env.appUrl}/reset-password?token=${raw}`,
    }),
  );

  return { ok: true, message };
};

/**
 * Reset password with single-use token. Token identifies user (no userId in body).
 * Marks token used and revokes all sessions.
 */
export const resetPassword = async (
  body: ResetPasswordBody,
): Promise<{ ok: true }> => {
  const tokenHash = hashToken(body.token);
  const now = new Date();
  const passwordHash = await hash(body.password, BCRYPT_ROUNDS);

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, "password_reset"),
          isNull(authTokens.usedAt),
          sql`${authTokens.expiresAt} > ${now}`,
        ),
      )
      .returning({ userId: authTokens.userId });

    if (!row) throw new BadRequestError("Invalid or expired reset token");

    await tx
      .update(users)
      .set({ passwordHash, emailVerified: true })
      .where(eq(users.id, row.userId));

    // Force re-login everywhere
    await tx
      .update(userSessions)
      .set({ revokedAt: now })
      .where(
        and(eq(userSessions.userId, row.userId), isNull(userSessions.revokedAt)),
      );

    return { ok: true as const };
  });
};

export const resendVerification = async (
  userId: string,
): Promise<{ ok: true }> => {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!user) throw new AuthError();
  if (user.emailVerified) return { ok: true };

  const raw = await db.transaction(async (tx) =>
    issueAuthToken(tx, user.id, "email_verify", emailVerifyExpiry()),
  );

  await sendMail(
    verificationEmail({
      to: user.email,
      verifyUrl: `${env.appUrl}/verify-email?token=${raw}`,
    }),
  );

  return { ok: true };
};

const providerColumn = {
  google: users.googleId,
  github: users.githubId,
  linkedin: users.linkedinId,
} as const;

export async function startOAuth(
  provider: OAuthProvider,
): Promise<{ url: string }> {
  if (!isOAuthConfigured(provider)) {
    throw new BadRequestError(`OAuth provider '${provider}' is not configured`);
  }
  const state = createOAuthState();
  const usePkce = provider === "google" || provider === "linkedin";
  const pkce = usePkce ? pkcePair() : undefined;
  await saveOAuthState(state, {
    provider,
    codeVerifier: pkce?.verifier,
  });
  const url = buildAuthorizeUrl(provider, {
    state,
    codeChallenge: pkce?.challenge,
  });
  return { url };
}

/**
 * Complete OAuth: link or create user. Refuse email collision without verified link.
 */
export async function completeOAuth(
  provider: OAuthProvider,
  params: { code: string; state: string },
  userAgent?: string | null,
  rawIp?: string | null,
): Promise<{ exchangeCode: string }> {
  const saved = await takeOAuthState(params.state);
  if (!saved || saved.provider !== provider) {
    throw new BadRequestError("Invalid OAuth state");
  }

  const profile = await fetchOAuthProfile(
    provider,
    params.code,
    saved.codeVerifier,
  );

  const col = providerColumn[provider];
  const ipAddress = parseClientIp(rawIp);

  const result = await db.transaction(async (tx) => {
    const [byProvider] = await tx
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(and(eq(col, profile.providerUserId), isNull(users.deletedAt)))
      .limit(1);

    let user = byProvider;

    if (!user) {
      const [byEmail] = await tx
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(and(eq(users.email, profile.email), isNull(users.deletedAt)))
        .limit(1);

      if (byEmail) {
        if (!byEmail.emailVerified) {
          throw new ConflictError(
            "Email already registered — verify email or sign in with password to link",
          );
        }
        const patch: {
          emailVerified: boolean;
          googleId?: string;
          githubId?: string;
          linkedinId?: string;
          avatarUrl?: string | null;
          name?: string | null;
        } = { emailVerified: true };
        if (provider === "google") patch.googleId = profile.providerUserId;
        if (provider === "github") patch.githubId = profile.providerUserId;
        if (provider === "linkedin") patch.linkedinId = profile.providerUserId;
        if (profile.avatarUrl) patch.avatarUrl = profile.avatarUrl;
        if (!byEmail.name && profile.name) patch.name = profile.name;
        await tx.update(users).set(patch).where(eq(users.id, byEmail.id));
        user = {
          id: byEmail.id,
          email: byEmail.email,
          name: patch.name ?? byEmail.name,
          emailVerified: true,
        };
      } else {
        const [created] = await tx
          .insert(users)
          .values({
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            emailVerified: true,
            passwordHash: null,
            googleId: provider === "google" ? profile.providerUserId : null,
            githubId: provider === "github" ? profile.providerUserId : null,
            linkedinId:
              provider === "linkedin" ? profile.providerUserId : null,
          })
          .returning({
            id: users.id,
            email: users.email,
            name: users.name,
            emailVerified: users.emailVerified,
          });
        if (!created) throw new Error("Failed to create OAuth user");
        await createPersonalWorkspace(tx, created.id, created.email);
        user = created;
      }
    }

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
    return tokens;
  });

  const exchangeCode = generateAuthActionToken();
  const redis = createClient({ url: env.redisUrl });
  await redis.connect();
  try {
    await redis.set(`oauth:exchange:${exchangeCode}`, JSON.stringify(result), {
      EX: 60,
    });
  } finally {
    await redis.quit().catch(() => {});
  }
  return { exchangeCode };
}

export async function exchangeOAuthCode(code: string): Promise<TokenPair> {
  const redis = createClient({ url: env.redisUrl });
  await redis.connect();
  try {
    const key = `oauth:exchange:${code}`;
    const raw = await redis.get(key);
    if (!raw) {
      throw new BadRequestError("Invalid or expired OAuth exchange code");
    }
    await redis.del(key);
    return JSON.parse(raw) as TokenPair;
  } finally {
    await redis.quit().catch(() => {});
  }
}
