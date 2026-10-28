import type { MetadataRoute } from "next";

// Há dados de menores no app: só a página de apresentação (/sobre) pode ser indexada.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/sobre", disallow: "/" } };
}
