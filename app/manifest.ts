import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "cricketmatch.today",
    short_name: "cricketmatch",
    description:
      "Cricket matches today, upcoming fixtures and official ticket links, from internationals to local clubs and academies.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5ef",
    theme_color: "#176b43",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
