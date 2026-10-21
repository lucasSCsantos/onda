import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mural ONDA",
    short_name: "Mural ONDA",
    description: "Calendário e equipe do ONDA, ministério de adolescentes.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#284995",
    theme_color: "#284995",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
