import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/** Fumaça do Gênero das contas: cadastro, Minha conta (edição dos dados pessoais) e tela de usuários (sem edição), no tamanho de tela de um celular. */

const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
const lerAmbiente = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
const admin = createClient(lerAmbiente("API_URL"), lerAmbiente("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA = "senha-de-teste-123";

async function preencherCadastro(page: Page, nome: string, convite: string) {
  await page.goto(`/cadastro?convite=${convite}`);
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("E-mail").fill(`${crypto.randomUUID()}@teste.onda`);
  await page.getByLabel("Data de nascimento").fill("1995-05-10");
  await page.getByLabel("Senha").fill(SENHA);
}

const generoDe = async (nome: string) => (await admin.from("perfis").select("genero").eq("nome", nome).single().throwOnError()).data!.genero;

test("cadastro: o Gênero é obrigatório e vai para o perfil", async ({ page }) => {
  const convite = await admin.from("convites").insert({ nivel: "professor" }).select("codigo").single().throwOnError();
  const nome = `Gênero ${crypto.randomUUID().slice(0, 8)}`;
  await preencherCadastro(page, nome, convite.data.codigo);

  const grupo = page.getByRole("group", { name: "Gênero" });
  await expect(grupo.getByRole("radio")).toHaveCount(2);
  await page.getByRole("button", { name: "Criar conta" }).click();
  // Sem Gênero, o envio é recusado e a pessoa continua no cadastro.
  await expect(page).toHaveURL(/\/cadastro/);
  expect((await admin.from("perfis").select("id").eq("nome", nome)).data).toEqual([]);

  await page.getByRole("radio", { name: "Feminino" }).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).not.toHaveURL(/\/cadastro/);
  expect(await generoDe(nome)).toBe("feminino");
});

test("Minha conta: perfil antigo aparece incompleto e a própria pessoa edita nome, nascimento e Gênero", async ({ page }) => {
  const convite = await admin.from("convites").insert({ nivel: "admin" }).select("codigo").single().throwOnError();
  const nome = `Antigo ${crypto.randomUUID().slice(0, 8)}`;
  await preencherCadastro(page, nome, convite.data.codigo);
  await page.getByRole("radio", { name: "Masculino" }).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).not.toHaveURL(/\/cadastro/);

  // Um perfil antigo: sem Gênero.
  await admin.from("perfis").update({ genero: null }).eq("nome", nome).throwOnError();

  await page.goto("/conta");
  const cadastro = page.locator("section[aria-labelledby=cadastro]");
  await expect(cadastro.getByText("cadastro incompleto")).toBeVisible();
  const novoNome = `${nome} Editado`;
  await cadastro.getByLabel("Nome").fill(novoNome);
  await cadastro.getByRole("radio", { name: "Feminino" }).check();
  await cadastro.getByRole("button", { name: "Salvar dados" }).click();
  await expect(cadastro.getByText("Dados salvos.")).toBeVisible();
  await expect(cadastro.getByText("cadastro incompleto")).toHaveCount(0);
  expect(await generoDe(novoNome)).toBe("feminino");
});

test("Admin → Usuários: não há edição de Gênero nem de dados pessoais, só o selo de cadastro incompleto", async ({ page }) => {
  // A tela de usuários é lenta no banco local, que acumula contas de teste.
  test.setTimeout(120_000);
  test.slow();
  const convite = await admin.from("convites").insert({ nivel: "admin" }).select("codigo").single().throwOnError();
  const nome = `Admin ${crypto.randomUUID().slice(0, 8)}`;
  await preencherCadastro(page, nome, convite.data.codigo);
  await page.getByRole("radio", { name: "Masculino" }).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).not.toHaveURL(/\/cadastro/);

  // Começa com "Aa" para ficar entre os primeiros (o banco local acumula contas e a lista é ordenada por nome).
  const outro = `Aaa Sem gênero ${crypto.randomUUID().slice(0, 8)}`;
  const criado = await admin.auth.admin.createUser({
    email: `${crypto.randomUUID()}@teste.onda`,
    password: SENHA,
    email_confirm: true,
    user_metadata: { nome: outro },
  });
  await admin.from("perfis").update({ nivel: "professor" }).eq("id", criado.data.user!.id).throwOnError();

  await page.goto("/admin/usuarios");
  const linha = page.locator("li", { hasText: outro });
  await expect(linha.getByText("cadastro incompleto")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Editar Gênero")).toHaveCount(0);
  await expect(linha.getByRole("radio")).toHaveCount(0);
});
