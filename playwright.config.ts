import { defineConfig, devices } from "@playwright/test";
import { execSync } from "node:child_process";

const PORTA = Number(process.env.PORTA_FUMACA ?? 3100);

/** URL e chaves do Supabase local, as mesmas que o app lê: a pública no build e a service-role (só do servidor) em execução. */
function ambienteDoApp() {
  const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
  const valor = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
  return {
    NEXT_PUBLIC_SUPABASE_URL: valor("API_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: valor("ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: valor("SERVICE_ROLE_KEY"),
    // O agendador responde só a quem manda este segredo (tests/fumaca/pasta-do-evento.spec.ts); o Google fica sem credencial.
    CRON_SECRET: "segredo-de-teste-da-fumaca",
  };
}

// Testes de fumaça: o app já compilado (o service worker só existe em produção) falando com o Supabase local,
// aberto como num celular. `PLAYWRIGHT_CHANNEL=chrome` usa o Chrome instalado em vez do Chromium do Playwright.
export default defineConfig({
  testDir: "tests/fumaca",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: "pt-BR",
    timezoneId: "America/Bahia",
    ...devices["Pixel 5"],
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${PORTA}`,
    url: `http://localhost:${PORTA}/entrar`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: ambienteDoApp(),
  },
});
