import path from "node:path";
import fs from "node:fs";

let repoRootCache: string | undefined;

export function repoRoot() {
  if (repoRootCache) {
    return repoRootCache;
  }

  const candidates = [
    process.env.REPO_ROOT,
    path.resolve(process.cwd(), "../.."),
    process.cwd(),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "Smadex_Creative_Intelligence_Dataset_FULL"))) {
      repoRootCache = candidate;
      return candidate;
    }
  }

  repoRootCache = process.cwd();
  return repoRootCache;
}

export function datasetDir() {
  return path.join(repoRoot(), "Smadex_Creative_Intelligence_Dataset_FULL");
}

export function uploadsDir() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..", ".data", "uploads");
}
