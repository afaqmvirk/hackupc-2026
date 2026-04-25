import { MongoClient, type Db } from "mongodb";
import { nanoid } from "nanoid";
import { config } from "@/lib/config";
import type { CreativeDoc, Experiment } from "@/lib/schemas";
import { loadCampaigns, loadCreatives, loadDailyMetrics } from "@/lib/data/csv";

type Collections = {
  db: Db;
  client: MongoClient;
};

let mongoClientPromise: Promise<MongoClient> | undefined;
const memoryExperiments = new Map<string, Experiment>();
const memoryUploads = new Map<string, CreativeDoc>();

async function getCollections(): Promise<Collections | null> {
  if (!config.mongodbUri) {
    return null;
  }

  if (!mongoClientPromise) {
    const client = new MongoClient(config.mongodbUri);
    mongoClientPromise = client.connect();
  }

  const client = await mongoClientPromise;
  return { client, db: client.db(config.mongodbDb) };
}

export async function getAllCreatives() {
  const collections = await getCollections();
  if (!collections) {
    return [...loadCreatives(), ...memoryUploads.values()];
  }

  const stored = await collections.db.collection<CreativeDoc>("creatives").find({}).toArray();
  if (stored.length) {
    return stored;
  }

  return loadCreatives();
}

export async function getDatasetCreatives() {
  const collections = await getCollections();
  if (!collections) {
    return loadCreatives();
  }

  const stored = await collections.db.collection<CreativeDoc>("creatives").find({ source: "dataset" }).toArray();
  return stored.length ? stored : loadCreatives();
}

export async function getCreativeById(id: string) {
  const allCreatives = await getAllCreatives();
  return allCreatives.find((creative) => creative.id === id) ?? null;
}

export async function queryAtlasSimilarCreatives(embedding: number[], filter: Record<string, unknown>, limit = 8) {
  const collections = await getCollections();
  if (!collections || !embedding.length) {
    return null;
  }

  try {
    return await collections.db
      .collection<CreativeDoc>("creatives")
      .aggregate<CreativeDoc>([
        {
          $vectorSearch: {
            index: config.atlasVectorIndex,
            path: "features.embedding",
            queryVector: embedding,
            numCandidates: Math.max(limit * 12, 80),
            limit,
            filter,
          },
        },
        {
          $match: {
            source: "dataset",
          },
        },
      ])
      .toArray();
  } catch (error) {
    console.warn("Atlas Vector Search failed; falling back to local cosine retrieval.", error);
    return null;
  }
}

export async function saveUploadedCreative(creative: CreativeDoc) {
  memoryUploads.set(creative.id, creative);

  const collections = await getCollections();
  if (collections) {
    await collections.db.collection<CreativeDoc>("creatives").updateOne(
      { id: creative.id },
      { $set: creative },
      { upsert: true },
    );
  }

  return creative;
}

export async function createExperiment(input: Omit<Experiment, "id" | "status" | "createdAt">) {
  const experiment: Experiment = {
    ...input,
    id: nanoid(10),
    status: "created",
    createdAt: new Date().toISOString(),
  };

  memoryExperiments.set(experiment.id, experiment);

  const collections = await getCollections();
  if (collections) {
    await collections.db.collection<Experiment>("experiments").insertOne(experiment);
  }

  return experiment;
}

export async function getExperiment(id: string) {
  const memory = memoryExperiments.get(id);
  if (memory) {
    return memory;
  }

  const collections = await getCollections();
  if (!collections) {
    return null;
  }

  return collections.db.collection<Experiment>("experiments").findOne({ id });
}

export async function saveExperiment(experiment: Experiment) {
  memoryExperiments.set(experiment.id, experiment);

  const collections = await getCollections();
  if (collections) {
    await collections.db.collection<Experiment>("experiments").updateOne(
      { id: experiment.id },
      { $set: experiment },
      { upsert: true },
    );
  }

  return experiment;
}

export async function seedMongo() {
  const collections = await getCollections();
  if (!collections) {
    throw new Error("MONGODB_URI is required for seeding MongoDB.");
  }

  const creatives = loadCreatives();
  const campaigns = loadCampaigns();
  const dailyMetrics = loadDailyMetrics();

  await collections.db.collection("creatives").deleteMany({ source: "dataset" });
  await collections.db.collection("campaigns").deleteMany({});
  await collections.db.collection("creative_daily_metrics").deleteMany({});

  await collections.db.collection("creatives").insertMany(creatives, { ordered: false });
  await collections.db.collection("campaigns").insertMany(campaigns, { ordered: false });

  const chunkSize = 5000;
  for (let offset = 0; offset < dailyMetrics.length; offset += chunkSize) {
    await collections.db
      .collection("creative_daily_metrics")
      .insertMany(dailyMetrics.slice(offset, offset + chunkSize), { ordered: false });
  }

  await collections.db.collection("creatives").createIndex({ id: 1 }, { unique: true });
  await collections.db.collection("creatives").createIndex({ category: 1, format: 1, language: 1 });
  await collections.db.collection("creative_daily_metrics").createIndex({ creativeId: 1, country: 1, os: 1 });
  await ensureVectorSearchIndex(collections.db);

  return {
    creatives: creatives.length,
    campaigns: campaigns.length,
    dailyMetrics: dailyMetrics.length,
  };
}

async function ensureVectorSearchIndex(db: Db) {
  try {
    const collection = db.collection("creatives");
    const existing = await collection.listSearchIndexes(config.atlasVectorIndex).toArray();
    if (existing.length) {
      return;
    }

    await collection.createSearchIndex({
      name: config.atlasVectorIndex,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "features.embedding",
            numDimensions: 64,
            similarity: "cosine",
          },
          { type: "filter", path: "category" },
          { type: "filter", path: "language" },
          { type: "filter", path: "os" },
        ],
      },
    });
  } catch (error) {
    console.warn("Atlas Vector Search index setup skipped.", error);
  }
}
