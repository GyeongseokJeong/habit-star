import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "별하루",
    short_name: "별하루",
    description: "나의 속도로 실천하고, 별로 기억하는 하루의 루틴",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#19242a",
    theme_color: "#19242a",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
