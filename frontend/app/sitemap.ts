import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/delete-account`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
