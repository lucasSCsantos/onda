import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "dominio", include: ["src/dominio/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "rls",
          include: ["tests/rls/**/*.test.ts"],
          testTimeout: 20_000,
        },
      },
    ],
  },
});
