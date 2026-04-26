import path from "node:path";
import fs from "node:fs";

let repoRootCache: string | undefined;
let datasetDirCache: string | undefined;

export function repoRoot() {
  if (repoRootCache) {
    return repoRootCache;
  }

  const candidates = [
    process.env.REPO_ROOT,
    process.env.LAMBDA_TASK_ROOT,
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
    path.resolve(process.cwd(), "../../.."),
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
  if (datasetDirCache) {
    return datasetDirCache;
  }

  const root = repoRoot();
  const candidates = [
    process.env.DATASET_DIR,
    path.join(root, "Smadex_Creative_Intelligence_Dataset_FULL"),
    path.resolve(process.cwd(), "Smadex_Creative_Intelligence_Dataset_FULL"),
    path.resolve(process.cwd(), "..", "Smadex_Creative_Intelligence_Dataset_FULL"),
    path.resolve(process.cwd(), "../..", "Smadex_Creative_Intelligence_Dataset_FULL"),
    path.resolve(process.cwd(), "../../..", "Smadex_Creative_Intelligence_Dataset_FULL"),
    process.env.LAMBDA_TASK_ROOT
      ? path.join(process.env.LAMBDA_TASK_ROOT, "Smadex_Creative_Intelligence_Dataset_FULL")
      : undefined,
    process.env.LAMBDA_TASK_ROOT
      ? path.join(process.env.LAMBDA_TASK_ROOT, "apps", "web", "Smadex_Creative_Intelligence_Dataset_FULL")
      : undefined,
    "/var/task/Smadex_Creative_Intelligence_Dataset_FULL",
    "/var/task/apps/web/Smadex_Creative_Intelligence_Dataset_FULL",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const campaigns = path.join(candidate, "campaigns.csv");
    const creatives = path.join(candidate, "creatives.csv");
    if (fs.existsSync(campaigns) && fs.existsSync(creatives)) {
      datasetDirCache = candidate;
      return candidate;
    }
  }

  datasetDirCache = path.join(root, "Smadex_Creative_Intelligence_Dataset_FULL");
  return datasetDirCache;
}

export function uploadsDir() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..", ".data", "uploads");
}
