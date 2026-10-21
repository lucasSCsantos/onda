import type { NextConfig } from "next";

// Sem cacheComponents: todas as telas dependem da sessão de quem está logado,
// então não há conteúdo público para pré-renderizar.
const nextConfig: NextConfig = {
  // As instruções para agentes ficam no CLAUDE.md; sem isso o `next dev` cria um AGENTS.md.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
