import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, isPrivateOrReservedIp } from "./safe-url.js";

describe("isPrivateOrReservedIp", () => {
  it("flags loopback, RFC1918, link-local, CGNAT", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.1.2.3")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("100.64.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
  });
});

describe("assertPublicHttpUrl", () => {
  it("rejects non-http schemes and credentials", async () => {
    await expect(assertPublicHttpUrl("ftp://example.com")).rejects.toThrow();
    await expect(
      assertPublicHttpUrl("https://user:pass@example.com"),
    ).rejects.toThrow(/credentials/);
  });

  it("rejects localhost and metadata hostnames", async () => {
    await expect(assertPublicHttpUrl("http://localhost/")).rejects.toThrow();
    await expect(
      assertPublicHttpUrl("http://metadata.google.internal/"),
    ).rejects.toThrow();
  });
});
