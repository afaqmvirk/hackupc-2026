import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

loadRootEnv();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

function loadRootEnv() {
  const envPath = path.resolve(process.cwd(), "../..", ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}
