/**
 * OAuth providers — secrets from env only (HG-1). Never expose to NEXT_PUBLIC_*.
 */
import { createHash, randomBytes } from "node:crypto";
import { env } from "../env.js";

export type OAuthProvider = "google" | "github" | "linkedin";

export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  userInfoUrl: string;
};

function cfg(provider: OAuthProvider): ProviderConfig | null {
  if (provider === "google") {
    if (!env.oauthGoogleClientId || !env.oauthGoogleClientSecret) return null;
    return {
      clientId: env.oauthGoogleClientId,
      clientSecret: env.oauthGoogleClientSecret,
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: ["openid", "email", "profile"],
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    };
  }
  if (provider === "github") {
    if (!env.oauthGithubClientId || !env.oauthGithubClientSecret) return null;
    return {
      clientId: env.oauthGithubClientId,
      clientSecret: env.oauthGithubClientSecret,
      authUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      scopes: ["read:user", "user:email"],
      userInfoUrl: "https://api.github.com/user",
    };
  }
  if (!env.oauthLinkedinClientId || !env.oauthLinkedinClientSecret) return null;
  return {
    clientId: env.oauthLinkedinClientId,
    clientSecret: env.oauthLinkedinClientSecret,
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "email"],
    userInfoUrl: "https://api.linkedin.com/v2/userinfo",
  };
}

export function isOAuthConfigured(provider: OAuthProvider): boolean {
  return cfg(provider) != null;
}

export function createOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizeUrl(
  provider: OAuthProvider,
  params: { state: string; codeChallenge?: string },
): string {
  const c = cfg(provider);
  if (!c) throw new Error(`OAuth provider not configured: ${provider}`);
  const redirectUri = `${env.apiPublicUrl}/api/v1/auth/oauth/${provider}/callback`;
  const q = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: c.scopes.join(" "),
    state: params.state,
  });
  if (params.codeChallenge) {
    q.set("code_challenge", params.codeChallenge);
    q.set("code_challenge_method", "S256");
  }
  if (provider === "google") q.set("access_type", "online");
  return `${c.authUrl}?${q.toString()}`;
}

async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  codeVerifier?: string,
): Promise<string> {
  const c = cfg(provider);
  if (!c) throw new Error(`OAuth provider not configured: ${provider}`);
  const redirectUri = `${env.apiPublicUrl}/api/v1/auth/oauth/${provider}/callback`;
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (codeVerifier) body.set("code_verifier", codeVerifier);

  const res = await fetch(c.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
  if (!res.ok) throw new Error(`oauth_token_exchange_failed:${provider}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("oauth_missing_access_token");
  return json.access_token;
}

export async function fetchOAuthProfile(
  provider: OAuthProvider,
  code: string,
  codeVerifier?: string,
): Promise<OAuthProfile> {
  const c = cfg(provider);
  if (!c) throw new Error(`OAuth provider not configured: ${provider}`);
  const accessToken = await exchangeCode(provider, code, codeVerifier);

  if (provider === "github") {
    const userRes = await fetch(c.userInfoUrl, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/vnd.github+json",
        "user-agent": "jobautomater",
      },
    });
    if (!userRes.ok) throw new Error("oauth_github_user_failed");
    const user = (await userRes.json()) as {
      id: number;
      login: string;
      name: string | null;
      avatar_url: string | null;
      email: string | null;
    };
    let email = user.email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/vnd.github+json",
          "user-agent": "jobautomater",
        },
      });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        email =
          emails.find((e) => e.primary && e.verified)?.email ??
          emails.find((e) => e.verified)?.email ??
          null;
      }
    }
    if (!email) throw new Error("oauth_email_required");
    return {
      provider,
      providerUserId: String(user.id),
      email: email.toLowerCase(),
      name: user.name ?? user.login,
      avatarUrl: user.avatar_url,
    };
  }

  const res = await fetch(c.userInfoUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`oauth_userinfo_failed:${provider}`);
  const info = (await res.json()) as {
    sub?: string;
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  const id = info.sub ?? info.id;
  if (!id || !info.email) throw new Error("oauth_profile_incomplete");
  return {
    provider,
    providerUserId: String(id),
    email: info.email.toLowerCase(),
    name: info.name ?? null,
    avatarUrl: info.picture ?? null,
  };
}
