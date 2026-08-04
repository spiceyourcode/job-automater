import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Block SSRF via test/collect fetch to private, link-local, or metadata hosts.
 * Resolves DNS and rejects if any address is non-public.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "0.0.0.0" || v === "::" || v === "::1") return true;

  if (v.includes(":")) {
    // IPv6 unique-local, link-local, loopback
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) {
      return true;
    }
    return false;
  }

  const parts = v.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const a = parts[0]!;
  const b = parts[1]!;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http/https URLs allowed");
  }
  if (url.username || url.password) {
    throw new Error("URL credentials not allowed");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Host not allowed");
  }

  if (isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error("Private or reserved IP not allowed");
    }
    return url;
  }

  const results = await lookup(host, { all: true, verbatim: true });
  if (results.length === 0) {
    throw new Error("Host could not be resolved");
  }
  for (const { address } of results) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error("Host resolves to private or reserved address");
    }
  }
  return url;
}
