import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        // O cliente real do Drive (tests/drive) também roda aqui: fala só com um servidor HTTP de mentira, sem banco.
        test: { name: "dominio", include: ["src/dominio/**/*.test.ts", "tests/drive/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "rls",
          include: ["tests/rls/**/*.test.ts"],
          testTimeout: 20_000,
          // Todos falam com o mesmo banco local, e alguns mexem em configuração e fila globais.
          fileParallelism: false,
        },
      },
    ],
  },
});
