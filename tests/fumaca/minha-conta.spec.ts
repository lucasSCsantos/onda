import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

/** Fumaça da página "Minha conta": a Assinatura de calendário, no tamanho de tela de um celular. */

const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
const lerAmbiente = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
const admin = createClient(lerAmbiente("API_URL"), lerAmbiente("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA = "senha-de-teste-123";

test("Minha conta: o endereço do calendário aparece uma vez, o feed responde, regerar invalida o anterior e revogar apaga", async ({ page, request }) => {
  const funcao = await admin.from("funcoes").select("id").eq("nome", "Líder do louvor").single().throwOnError();
  const convite = await admin.from("convites").insert({ nivel: "lider", funcao_id: funcao.data.id }).select("codigo").single().throwOnError();
  const nome = `Calendário ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto(`/cadastro?convite=${convite.data.codigo}`);
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("E-mail").fill(`${crypto.randomUUID()}@teste.onda`);
  await page.getByLabel("Data de nascimento").fill("1995-05-10");
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();

  // Pelo menu do cabeçalho.
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("link", { name: "Minha conta" }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole("heading", { name: "Calendário", exact: true })).toBeVisible();

  // Um Evento da própria pessoa, para ver o feed de verdade.
  const eu = await admin.from("perfis").select("id").eq("nome", nome).single().throwOnError();
  const categoria = await admin.from("categorias").select("id").eq("nome", "Culto").single().throwOnError();
  const titulo = `Culto do feed ${crypto.randomUUID().slice(0, 8)}`;
  const amanha = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
  await admin
    .from("eventos")
    .insert({ titulo, categoria_id: categoria.data.id, inicio: amanha, local: "Templo", status: "confirmado", responsavel_id: eu.data.id, criado_por: eu.data.id })
    .throwOnError();

  await page.getByRole("button", { name: "Gerar meu endereço" }).click();
  const primeiro = await page.getByLabel("Endereço do calendário").inputValue();
  expect(primeiro).toMatch(/\/feed\/[\w-]{43}\.ics$/);

  const feed = await request.get(primeiro);
  expect(feed.status()).toBe(200);
  expect(feed.headers()["content-type"]).toContain("text/calendar");
  const texto = await feed.text();
  expect(texto).toContain("BEGIN:VCALENDAR");
  expect(texto).toContain(`SUMMARY:${titulo}`);
  expect(texto).toContain("LOCATION:Templo");

  // Mostrado uma vez: ao recarregar, só resta regerar ou revogar.
  await page.reload();
  await expect(page.getByLabel("Endereço do calendário")).toHaveCount(0);
  await page.getByRole("button", { name: "Regerar endereço" }).click();
  const segundo = await page.getByLabel("Endereço do calendário").inputValue();
  expect(segundo).not.toBe(primeiro);
  expect((await request.get(primeiro)).status()).toBe(404);
  expect((await request.get(segundo)).status()).toBe(200);

  await page.getByRole("button", { name: "Revogar" }).click();
  await expect(page.getByRole("button", { name: "Gerar meu endereço" })).toBeVisible();
  expect((await request.get(segundo)).status()).toBe(404);

  const larguraExcedida = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(larguraExcedida).toBeLessThanOrEqual(0);
});

test("o feed responde 404 a um endereço qualquer, sem sessão", async ({ request }) => {
  const resposta = await request.get(`/feed/${"a".repeat(43)}.ics`, { maxRedirects: 0 });
  expect(resposta.status()).toBe(404);
});
