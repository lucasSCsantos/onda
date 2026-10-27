import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/** Fumaça do Gênero dos Adolescentes: cadastro, edição, selo, filtro e totais, no tamanho de tela de um celular. */

const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
const lerAmbiente = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
const admin = createClient(lerAmbiente("API_URL"), lerAmbiente("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA = "senha-de-teste-123";

async function entrarComoAdmin(page: Page) {
  const convite = await admin.from("convites").insert({ nivel: "admin" }).select("codigo").single().throwOnError();
  await page.goto(`/cadastro?convite=${convite.data.codigo}`);
  await page.getByLabel("Nome").fill(`Gênero adolescentes ${crypto.randomUUID().slice(0, 8)}`);
  await page.getByLabel("E-mail").fill(`${crypto.randomUUID()}@teste.onda`);
  await page.getByLabel("Data de nascimento").fill("1995-05-10");
  await page.getByRole("radio", { name: "Masculino" }).check();
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
}

const generoDe = async (nome: string) => (await admin.from("adolescentes").select("genero").eq("nome", nome).single().throwOnError()).data!.genero;

/** Os totais que a tela deveria mostrar, contados direto no banco entre os ativos. */
async function totaisDoBanco() {
  const { data } = await admin.from("adolescentes").select("genero").eq("ativo", true).throwOnError();
  const conta = (g: string | null) => data!.filter((a) => a.genero === g).length;
  return `Ativos: ${conta("masculino")} masculinos · ${conta("feminino")} femininos · ${conta(null)} sem gênero informado`;
}

test("cadastro novo exige o Gênero; o antigo aparece incompleto e é completado na edição", async ({ page }) => {
  await entrarComoAdmin(page);
  const novo = `Novo ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto("/adolescentes");

  const formulario = page.locator("form", { has: page.getByRole("button", { name: "Cadastrar" }) });
  await formulario.getByLabel("Nome").fill(novo);
  await formulario.getByLabel("Data de nascimento").fill("2011-03-04");
  await expect(formulario.getByRole("group", { name: "Gênero" }).getByRole("radio")).toHaveCount(2);
  await formulario.getByRole("button", { name: "Cadastrar" }).click();
  // Sem Gênero, o navegador barra o envio: nada foi cadastrado.
  expect((await admin.from("adolescentes").select("id").eq("nome", novo)).data).toEqual([]);

  await formulario.getByRole("radio", { name: "Feminino" }).check();
  await formulario.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText("Adolescente cadastrado.")).toBeVisible();
  expect(await generoDe(novo)).toBe("feminino");

  // Um Adolescente antigo: sem Gênero, com o selo.
  const antigo = `Antigo ${crypto.randomUUID().slice(0, 8)}`;
  const { data } = await admin.from("adolescentes").insert({ nome: antigo, nascimento: "2010-01-02", genero: "feminino" }).select("id").single().throwOnError();
  await admin.from("adolescentes").update({ genero: null }).eq("id", data.id).throwOnError();

  await page.goto(`/adolescentes?q=${encodeURIComponent(antigo)}`);
  const linha = page.locator("li", { hasText: antigo });
  await expect(linha.getByText("cadastro incompleto")).toBeVisible();

  // Inativar um registro antigo, sem Gênero, continua funcionando.
  await linha.getByRole("button", { name: "Inativar" }).click();
  await expect.poll(async () => (await admin.from("adolescentes").select("ativo").eq("id", data.id).single()).data?.ativo).toBe(false);
  await admin.from("adolescentes").update({ ativo: true }).eq("id", data.id).throwOnError();

  await page.goto(`/adolescentes?q=${encodeURIComponent(antigo)}`);
  await linha.getByText("Editar", { exact: true }).click();
  await linha.getByRole("radio", { name: "Masculino" }).check();
  await linha.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(linha.getByText("Adolescente salvo.")).toBeVisible();
  expect(await generoDe(antigo)).toBe("masculino");
});

test("filtro por Gênero e totais que não mudam com o filtro", async ({ page }) => {
  await entrarComoAdmin(page);
  const sufixo = crypto.randomUUID().slice(0, 8);
  const nomes = { m: `Mateus ${sufixo}`, f: `Fabi ${sufixo}`, s: `Sem ${sufixo}` };
  await admin.from("adolescentes").insert([
    { nome: nomes.m, nascimento: "2010-01-02", genero: "masculino" },
    { nome: nomes.f, nascimento: "2010-01-02", genero: "feminino" },
    { nome: nomes.s, nascimento: "2010-01-02", genero: "feminino" },
  ]).throwOnError();
  await admin.from("adolescentes").update({ genero: null }).eq("nome", nomes.s).throwOnError();

  const totais = page.getByTestId("totais-por-genero");
  await page.goto(`/adolescentes?q=${sufixo}&ordem=nome`);
  const esperado = await totaisDoBanco();
  await expect(totais).toHaveText(esperado);
  await expect(page.locator("li", { hasText: sufixo })).toHaveCount(3);

  for (const [valor, nome] of [["masculino", nomes.m], ["feminino", nomes.f], ["sem", nomes.s]] as const) {
    await page.goto(`/adolescentes?q=${sufixo}&ordem=nome&genero=${valor}`);
    await expect(page.locator("li", { hasText: sufixo })).toHaveCount(1);
    await expect(page.locator("li", { hasText: nome })).toHaveCount(1);
    await expect(totais).toHaveText(esperado);
  }

  // O mesmo pela tela: o seletor de Gênero, com a opção "sem gênero informado".
  await page.goto(`/adolescentes?q=${sufixo}&ordem=nome`);
  await page.getByRole("combobox", { name: /Gênero/ }).click();
  await page.getByRole("option", { name: "Sem gênero informado" }).click();
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/genero=sem/);
  await expect(page.locator("li", { hasText: nomes.s })).toHaveCount(1);
});
