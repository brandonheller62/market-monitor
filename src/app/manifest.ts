import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Market Monitor",
    short_name: "Market Monitor",
    description:
      "A pre-open desk note: what moved overnight, what prints today, and what to watch, assembled from public market data.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d131c",
    theme_color: "#0d131c",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
