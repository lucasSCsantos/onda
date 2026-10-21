import type { NextConfig } from "next";

// Sem cacheComponents: todas as telas dependem da sessão de quem está logado,
// então não há conteúdo público para pré-renderizar.
const nextConfig: NextConfig = {
  // As instruções para agentes ficam no CLAUDE.md; sem isso o `next dev` cria um AGENTS.md.
  agentRules: false,
  async headers() {
    // O navegador precisa rever o service worker a cada abertura para que atualizações cheguem.
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
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
