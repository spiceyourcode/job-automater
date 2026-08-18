import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent-folder package-lock.json made Turbopack walk to C:\Users\Administrator
  // and drop (auth) pages (/login, /register) from the route tree.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
