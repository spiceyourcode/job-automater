/**
 * Rotation leaves the old session unexpired so concurrent tabs can replay it
 * briefly without logging the user out. Intentional revocations set
 * `expiresAt` to the revocation time, so they can never be reused.
 */
export const REFRESH_REPLAY_GRACE_MS = 60_000;

export interface RevokedSessionLike {
  expiresAt: Date;
  revokedAt: Date | null;
}

export const canReuseRevokedSession = (
  session: RevokedSessionLike,
  now: Date,
): boolean => {
  if (!session.revokedAt) return false;
  if (session.expiresAt.getTime() <= now.getTime()) return false;

  const ageMs = now.getTime() - session.revokedAt.getTime();
  return ageMs >= 0 && ageMs <= REFRESH_REPLAY_GRACE_MS;
};
