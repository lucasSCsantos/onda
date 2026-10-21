import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/** Testes de fumaça dos fluxos críticos do MVP, no tamanho de tela de um celular. */

const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
const lerAmbiente = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
const admin = createClient(lerAmbiente("API_URL"), lerAmbiente("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA = "senha-de-teste-123";

/** Convite de Líder do louvor, gerado direto no banco (como o Admin faria na tela de convites). */
async function novoConvite(): Promise<string> {
  const funcao = await admin.from("funcoes").select("id").eq("nome", "Líder do louvor").single();
  const convite = await admin
    .from("convites")
    .insert({ nivel: "lider", funcao_id: funcao.data!.id })
    .select("codigo")
    .single();
  if (convite.error) throw convite.error;
  return convite.data.codigo;
}

async function cadastrar(page: Page, nome: string, convite?: string) {
  await page.goto(convite ? `/cadastro?convite=${convite}` : "/cadastro");
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("E-mail").fill(`${crypto.randomUUID()}@teste.onda`);
  await page.getByLabel("Data de nascimento").fill("1995-05-10");
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
}

const hoje = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bahia" }).format(new Date());

test("login por convite: a pessoa entra no Mural com a Função do convite", async ({ page }) => {
  await page.goto(`/cadastro?convite=${await novoConvite()}`);
  await expect(page.getByText("Líder do louvor")).toBeVisible();

  await cadastrar(page, "Líder de Fumaça", await novoConvite());
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Calendário" })).toBeVisible();
});

test("sem convite, a pessoa fica aguardando aprovação e não vê o Mural", async ({ page }) => {
  await cadastrar(page, "Pessoa de Fora");
  await expect(page.getByText(/aguard/i).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Calendário" })).toHaveCount(0);
});

test("criar um Evento e vê-lo no calendário no celular", async ({ page }) => {
  // O nome começa com "Ab" para ficar entre os primeiros da lista de Responsáveis: o banco local acumula contas dos
  // testes de RLS, e a consulta devolve no máximo mil linhas em ordem alfabética.
  await cadastrar(page, "Abel Fumaça", await novoConvite());
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();

  const titulo = `Ensaio de fumaça ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByRole("link", { name: "Novo Evento" }).click();
  await page.getByRole("link", { name: /Ensaio de louvor/ }).click();
  await page.getByLabel("Título").fill(titulo);
  await page.getByLabel("Data", { exact: true }).fill(hoje());
  // Quem cria já vem como Responsável.
  await expect(page.getByLabel("Responsável").locator("option:checked")).toHaveText("Abel Fumaça");
  await page.getByRole("button", { name: "Criar Evento" }).click();
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();

  await page.getByRole("link", { name: "Calendário" }).click();
  await expect(page.getByRole("link", { name: new RegExp(titulo) }).first()).toBeVisible();

  // No celular não pode haver rolagem lateral.
  const larguraExcedida = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(larguraExcedida).toBeLessThanOrEqual(0);
});

test("sem internet, a navegação mostra a tela offline", async ({ page, context }) => {
  await page.goto("/entrar");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // passa a ser controlada pelo service worker
  await context.setOffline(true);
  await expect(page.getByText("Sem internet. Você pode ver")).toBeVisible();
  await page.goto("/entrar").catch(() => {});
  await expect(page.getByRole("heading", { name: "Sem internet" })).toBeVisible();
});

test("o manifesto permite instalar o app", async ({ request }) => {
  const manifesto = await (await request.get("/manifest.webmanifest")).json();
  expect(manifesto).toMatchObject({ display: "standalone", start_url: "/" });
  for (const icone of manifesto.icons) expect((await request.get(icone.src)).ok()).toBe(true);
});
