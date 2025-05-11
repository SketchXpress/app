import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SketchXpress",
    short_name: "SketchXpress",
    description:
      "Transform messy sketches into masterpieces and mint them as NFTs",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#00B7E1",
    icons: [
      {
        src: "/assets/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/assets/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/assets/icons/maskable-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
