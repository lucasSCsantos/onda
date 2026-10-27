import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/** Fumaça do Gênero das contas: cadastro, Minha conta e tela de usuários, no tamanho de tela de um celular. */

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

test("Minha conta e usuários: perfil antigo aparece incompleto e o Gênero é completado", async ({ page }) => {
  // A tela de usuários é lenta no banco local, que acumula contas de teste.
  test.setTimeout(120_000);
  test.slow();
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
  await cadastro.getByRole("radio", { name: "Feminino" }).check();
  await cadastro.getByRole("button", { name: "Salvar Gênero" }).click();
  await expect(cadastro.getByText("Gênero salvo.")).toBeVisible();
  await expect(cadastro.getByText("cadastro incompleto")).toHaveCount(0);
  expect(await generoDe(nome)).toBe("feminino");

  // O Admin completa o de outra pessoa.
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
  await linha.getByText("Editar Gênero").click();
  await linha.getByRole("radio", { name: "Masculino" }).check();
  await linha.getByRole("button", { name: "Salvar Gênero" }).click();
  // A ação revalida a lista inteira, lenta no banco local; o que vale é o que ficou gravado.
  await expect.poll(() => generoDe(outro), { timeout: 90_000 }).toBe("masculino");
});
