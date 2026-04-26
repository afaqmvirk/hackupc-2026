import { loadCampaigns } from "@/lib/data/csv";
import { getDatasetCreatives } from "@/lib/data/repository";

export async function getCatalog(filters: {
  category?: string | null;
  language?: string | null;
  format?: string | null;
  campaignId?: string | null;
  limit?: number | null;
}) {
  const campaigns = loadCampaigns();
  const creatives = await getDatasetCreatives();
  const baseCreatives = creatives
    .filter((creative) => !filters.category || creative.category === filters.category)
    .filter((creative) => !filters.language || creative.language === filters.language)
    .filter((creative) => !filters.format || creative.format === filters.format);
  const campaignCounts = new Map<string, number>();
  baseCreatives.forEach((creative) => {
    if (!creative.campaignId) return;
    campaignCounts.set(creative.campaignId, (campaignCounts.get(creative.campaignId) ?? 0) + 1);
  });

  const filteredCreatives = baseCreatives
    .filter((creative) => !filters.campaignId || creative.campaignId === filters.campaignId)
    .slice(0, filters.limit ?? 96);

  const countries = new Set<string>();
  const objectives = new Set<string>();
  const categories = new Set<string>();
  const operatingSystems = new Set<string>();
  campaigns.forEach((campaign) => {
    campaign.countries.forEach((country) => countries.add(country));
    objectives.add(campaign.objective);
    categories.add(campaign.vertical);
    operatingSystems.add(campaign.targetOs);
  });

  const campaignOptions = campaigns
    .filter((campaign) => campaignCounts.has(campaign.campaignId))
    .slice(0, 120)
    .map((campaign) => {
      return {
        id: campaign.campaignId,
        appName: campaign.appName,
        advertiserName: campaign.advertiserName,
        category: campaign.vertical,
        objective: campaign.objective,
        countries: campaign.countries,
        os: campaign.targetOs,
        creativeCount: campaignCounts.get(campaign.campaignId) ?? 0,
      };
    });

  creatives.forEach((creative) => {
    categories.add(creative.category);
    if (creative.country) {
      countries.add(creative.country);
    }
    if (creative.os) {
      operatingSystems.add(creative.os);
    }
  });

  return {
    filters: {
      categories: Array.from(categories).sort(),
      countries: ["global", ...Array.from(countries).sort()],
      languages: ["any", ...Array.from(new Set(creatives.map((creative) => creative.language))).sort()],
      operatingSystems: ["any", ...Array.from(operatingSystems).sort()],
      objectives: Array.from(objectives).sort(),
      formats: Array.from(new Set(creatives.map((creative) => creative.format))).sort(),
    },
    campaigns: campaignOptions,
    creatives: filteredCreatives,
  };
}
