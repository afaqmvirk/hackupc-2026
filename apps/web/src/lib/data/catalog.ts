import { loadCampaigns } from "@/lib/data/csv";
import { getDatasetCreatives } from "@/lib/data/repository";

export async function getCatalog(filters: {
  category?: string | null;
  language?: string | null;
  format?: string | null;
  limit?: number | null;
}) {
  const campaigns = loadCampaigns();
  const creatives = await getDatasetCreatives();
  const filteredCreatives = creatives
    .filter((creative) => !filters.category || creative.category === filters.category)
    .filter((creative) => !filters.language || creative.language === filters.language)
    .filter((creative) => !filters.format || creative.format === filters.format)
    .slice(0, filters.limit ?? 96);

  const countries = new Set<string>();
  const objectives = new Set<string>();
  const categories = new Set<string>();
  const operatingSystems = new Set<string>();
  const campaignOptions = campaigns.slice(0, 60).map((campaign) => {
    campaign.countries.forEach((country) => countries.add(country));
    objectives.add(campaign.objective);
    categories.add(campaign.vertical);
    operatingSystems.add(campaign.targetOs);
    return {
      id: campaign.campaignId,
      appName: campaign.appName,
      advertiserName: campaign.advertiserName,
      category: campaign.vertical,
      objective: campaign.objective,
      countries: campaign.countries,
      os: campaign.targetOs,
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
