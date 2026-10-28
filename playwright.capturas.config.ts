import { defineConfig, devices } from "@playwright/test";
import { execSync } from "node:child_process";

const PORTA = Number(process.env.PORTA_CAPTURAS ?? 3200);

// Sem `CAPTURAS_SUPABASE_WORKDIR`, `supabase status` leria o banco de desenvolvimento, cheio de dados dos testes; o gerador de capturas exige um Supabase à parte (ver tests/capturas/gerar.spec.ts).
const WORKDIR = process.env.CAPTURAS_SUPABASE_WORKDIR;
if (!WORKDIR) throw new Error("Defina CAPTURAS_SUPABASE_WORKDIR com a pasta do Supabase limpo das capturas (ver tests/capturas/gerar.spec.ts).");

function ambienteDoApp() {
  const saida = execSync(`pnpm exec supabase status -o env --workdir "${WORKDIR}"`, { encoding: "utf8" });
  const valor = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
  return {
    NEXT_PUBLIC_SUPABASE_URL: valor("API_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: valor("ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: valor("SERVICE_ROLE_KEY"),
  };
}

// Gera as imagens da página /sobre: o app compilado falando com o Supabase limpo, aberto como num celular.
export default defineConfig({
  testDir: "tests/capturas",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: "pt-BR",
    timezoneId: "America/Bahia",
    ...devices["Pixel 5"],
    deviceScaleFactor: 2,
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${PORTA}`,
    url: `http://localhost:${PORTA}/entrar`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: ambienteDoApp(),
  },
});
