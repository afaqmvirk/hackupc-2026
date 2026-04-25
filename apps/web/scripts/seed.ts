import { loadCreatives, loadDailyMetrics } from "../src/lib/data/csv";
import { seedMongo } from "../src/lib/data/repository";

async function main() {
  const localCreatives = loadCreatives();
  const dailyRows = loadDailyMetrics();

  console.log(`Loaded ${localCreatives.length} creatives from CSV.`);
  console.log(`Loaded ${dailyRows.length} daily metric rows from CSV.`);

  if (!process.env.MONGODB_URI) {
    console.log("MONGODB_URI is not set. CSV fallback is ready; MongoDB seed skipped.");
    return;
  }

  const result = await seedMongo();
  console.log(`Seeded MongoDB: ${JSON.stringify(result)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
