import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/** Fumaça dos Horários padrão: o Admin edita, e o formulário de Evento novo já abre preenchido. */

const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
const lerAmbiente = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
const admin = createClient(lerAmbiente("API_URL"), lerAmbiente("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA = "senha-de-teste-123";

async function entrarComo(page: Page, nivel: "admin" | "lider") {
  const convite = await admin.from("convites").insert({ nivel: "admin" }).select("codigo").single().throwOnError();
  await page.goto(`/cadastro?convite=${convite.data.codigo}`);
  // Começa com "Ab" para ficar entre os primeiros Responsáveis (o banco local acumula contas).
  const nome = `Abel Horários ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("E-mail").fill(`${crypto.randomUUID()}@teste.onda`);
  await page.getByLabel("Data de nascimento").fill("1995-05-10");
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  // O convite de Líder pede uma Função; aqui basta o nível.
  if (nivel === "lider") {
    await admin.from("perfis").update({ nivel }).eq("nome", nome).throwOnError();
    await page.reload();
  }
}

const categoria = async (nome: string) =>
  (await admin.from("categorias").select("id").eq("nome", nome).single().throwOnError()).data.id as string;

test.afterEach(async () => {
  // O banco local é compartilhado: devolve a EBD ao padrão da migração.
  await admin.from("categorias").update({ horario_padrao: "09:00", duracao_padrao_minutos: null }).eq("nome", "EBD");
  await admin.from("categorias").update({ horario_padrao: null, duracao_padrao_minutos: null }).eq("nome", "Culto");
});

test("o Admin edita e limpa os padrões, e o formulário de Evento novo já abre preenchido", async ({ page }) => {
  test.setTimeout(120_000);
  await entrarComo(page, "admin");
  await admin.from("categorias").update({ horario_padrao: "09:00", duracao_padrao_minutos: null }).eq("nome", "EBD");
  const ebd = await categoria("EBD");

  await page.goto("/admin/horarios");
  await expect(page.getByRole("heading", { name: "Horários padrão", level: 1 })).toBeVisible();
  // A Postagem usa a data de publicação: fica de fora.
  await expect(page.getByRole("heading", { name: "Postagem" })).toHaveCount(0);
  await expect(page.getByLabel("Início de Pequeno grupo")).toHaveValue("15:00");
  await expect(page.getByLabel("Início de EBD")).toHaveValue("09:00");

  await page.getByLabel("Início de EBD").fill("09:30");
  await page.getByLabel("Duração de EBD (min)", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Salvar horários" }).click();
  // O banco local acumula centenas de Categorias dos testes de RLS, e a tela lista todas.
  await expect(page.getByText("Horários padrão salvos.")).toBeVisible({ timeout: 30_000 });

  // Evento novo de EBD: início e fim (a EBD mostra o campo de fim) já preenchidos.
  await page.goto(`/eventos/novo/${ebd}`);
  await expect(page.getByLabel("Hora", { exact: true })).toHaveValue("09:30");
  await expect(page.getByLabel("Fim (hora)")).toHaveValue("10:30");

  // Categorias sem padrão e a Postagem abrem como hoje.
  await page.goto(`/eventos/novo/${await categoria("Serviço")}`);
  await expect(page.getByLabel("Hora", { exact: true })).toHaveValue("");
  await page.goto(`/eventos/novo/${await categoria("Postagem")}`);
  await expect(page.getByLabel("Hora", { exact: true })).toHaveValue("");

  // Limpar: voltam a abrir sem horário.
  await page.goto("/admin/horarios");
  await page.getByLabel("Início de EBD").fill("");
  await page.getByLabel("Duração de EBD (min)", { exact: true }).fill("");
  await page.getByRole("button", { name: "Salvar horários" }).click();
  // O banco local acumula centenas de Categorias dos testes de RLS, e a tela lista todas.
  await expect(page.getByText("Horários padrão salvos.")).toBeVisible({ timeout: 30_000 });
  await page.goto(`/eventos/novo/${ebd}`);
  await expect(page.getByLabel("Hora", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Fim (hora)")).toHaveValue("");
});

test("o horário preenchido pode ser alterado, vale na Série e não mexe em Eventos existentes", async ({ page }) => {
  await entrarComo(page, "admin");
  const culto = await categoria("Culto");
  const antigo = `Antigo ${crypto.randomUUID().slice(0, 8)}`;
  const { data: eu } = await admin.from("perfis").select("id").order("criado_em", { ascending: false }).limit(1).single();
  await admin
    .from("eventos")
    .insert({ titulo: antigo, categoria_id: culto, inicio: "2027-05-02T15:00:00Z", status: "planejado", criado_por: eu!.id, responsavel_id: eu!.id })
    .throwOnError();

  // Alterar o padrão não mexe no Evento que já existia.
  await admin.from("categorias").update({ horario_padrao: "08:00" }).eq("id", culto);
  const { data: depois } = await admin.from("eventos").select("inicio").eq("titulo", antigo).single();
  expect(depois!.inicio).toBe("2027-05-02T15:00:00+00:00");

  // Uma Série nova usa o horário do formulário já preenchido, e o valor alterado é o que vale.
  const titulo = `Série ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto(`/eventos/novo/${culto}`);
  await expect(page.getByLabel("Hora", { exact: true })).toHaveValue("08:00");
  await page.getByLabel("Título").fill(titulo);
  await page.getByLabel("Data", { exact: true }).fill("2027-03-15");
  await page.getByLabel("Hora", { exact: true }).fill("09:45");
  await page.getByRole("combobox", { name: /Repetir/ }).click();
  await page.getByRole("option", { name: "Toda semana" }).click();
  await page.getByLabel(/Depois de quantas Ocorrências/).fill("2");
  await page.getByRole("button", { name: "Criar Evento" }).click();
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();

  const { data: ocorrencias } = await admin.from("eventos").select("inicio").like("titulo", `${titulo}%`).order("inicio");
  expect(ocorrencias!.map((o) => new Date(o.inicio).toISOString())).toEqual(["2027-03-15T12:45:00.000Z", "2027-03-22T12:45:00.000Z"]);
});

test("Líder não edita os Horários padrão", async ({ page }) => {
  await entrarComo(page, "lider");
  await page.goto("/admin/horarios");
  await expect(page).not.toHaveURL(/\/admin\/horarios/);
});
