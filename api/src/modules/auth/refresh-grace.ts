export const REFRESH_REPLAY_GRACE_MS = 60000;
export interface RevokedSessionLike {
    expiresAt: Date;
    revokedAt: Date | null;
}
export const canReuseRevokedSession = (session: RevokedSessionLike, now: Date): boolean => {
    if (!session.revokedAt)
        return false;
    if (session.expiresAt.getTime() <= now.getTime())
        return false;
    const ageMs = now.getTime() - session.revokedAt.getTime();
    return ageMs >= 0 && ageMs <= REFRESH_REPLAY_GRACE_MS;
};
