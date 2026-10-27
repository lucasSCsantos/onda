import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/** Fumaça das pastas dos Eventos no Drive: Configurações, a tela do Evento e o agendador, no tamanho de tela de um celular. */

const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
const lerAmbiente = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
const admin = createClient(lerAmbiente("API_URL"), lerAmbiente("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA = "senha-de-teste-123";
/** O mesmo segredo que o playwright.config.ts passa ao app. */
const CRON_SECRET = "segredo-de-teste-da-fumaca";
const RAIZ = "https://drive.google.com/drive/folders/1RaizDoMinisterioDeTeste123";

/** Cria uma conta de Admin pelo convite e devolve o id do perfil. */
async function entrarComoAdmin(page: Page) {
  const convite = await admin.from("convites").insert({ nivel: "admin" }).select("codigo").single().throwOnError();
  const nome = `Admin do Drive ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto(`/cadastro?convite=${convite.data.codigo}`);
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("E-mail").fill(`${crypto.randomUUID()}@teste.onda`);
  await page.getByLabel("Data de nascimento").fill("1995-05-10");
  await page.getByRole("radio", { name: "Masculino" }).check();
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  return (await admin.from("perfis").select("id").eq("nome", nome).single().throwOnError()).data.id as string;
}

/** Volta ao padrão: Drive desligado, sem pasta raiz, e a EBD e o Pequeno grupo como Categorias com pasta automática. */
test.afterEach(async () => {
  const { data: padrao } = await admin.from("categorias").select("id").in("nome", ["EBD", "Pequeno grupo"]).throwOnError();
  await admin
    .from("configuracoes")
    .update({ drive_ligado: false, drive_pasta_raiz_id: null, drive_categorias: padrao!.map((c) => c.id) })
    .eq("id", true)
    .throwOnError();
});

test("Configurações: o Admin liga o Drive e escolhe as Categorias; o painel diz o que falta no servidor", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin/configuracoes");

  const drive = page.getByRole("group", { name: "Drive" });
  await expect(drive).toBeVisible();
  // O ambiente da fumaça tem a chave de serviço e o segredo do agendador, mas não as credenciais do Google.
  const estado = drive.getByRole("list", { name: "Estado do servidor" });
  await expect(estado.getByText(/Credenciais do Google.*faltando/)).toBeVisible();
  await expect(estado.getByText(/Chave de serviço do Supabase.*configurada/)).toBeVisible();
  await expect(estado.getByText(/Segredo do agendador.*configurada/)).toBeVisible();

  // A EBD e o Pequeno grupo já vêm marcados; o Culto não aparece, porque não tem campo de link para o material.
  const ebd = drive.getByLabel("EBD", { exact: true });
  const grupo = drive.getByLabel("Pequeno grupo", { exact: true });
  await expect(ebd).toBeChecked();
  await expect(grupo).toBeChecked();
  await expect(drive.getByLabel("Culto", { exact: true })).toHaveCount(0);

  // Ligar sem pasta raiz não salva.
  await drive.getByLabel("Criar as pastas no Drive").check();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/informe a pasta raiz/i)).toBeVisible();

  // Com a pasta raiz (pelo endereço), salva; o ID fica gravado e as Categorias também. O formulário volta ao que estava
  // gravado depois de cada envio, então a caixa de ligar é marcada de novo.
  await drive.getByLabel("Criar as pastas no Drive").check();
  await drive.getByLabel(/Pasta do ministério no Drive/).fill(RAIZ);
  await grupo.uncheck();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("group", { name: "Drive" }).getByLabel("Criar as pastas no Drive")).toBeChecked();
  await expect(page.getByRole("group", { name: "Drive" }).getByLabel(/Pasta do ministério no Drive/)).toHaveValue("1RaizDoMinisterioDeTeste123");
  await expect(page.getByRole("group", { name: "Drive" }).getByLabel("EBD", { exact: true })).toBeChecked();
  await expect(page.getByRole("group", { name: "Drive" }).getByLabel("Pequeno grupo", { exact: true })).not.toBeChecked();

  const larguraExcedida = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(larguraExcedida).toBeLessThanOrEqual(0);
});

test("o Evento mostra a situação da pasta: criando, criada com o aviso do acesso e com erro", async ({ page }) => {
  const eu = await entrarComoAdmin(page);
  await admin.from("configuracoes").update({ drive_ligado: true, drive_pasta_raiz_id: "1RaizDoMinisterioDeTeste123" }).eq("id", true).throwOnError();

  const ebd = await admin.from("categorias").select("id, campos_das_categorias(id, nome)").eq("nome", "EBD").single().throwOnError();
  const campo = (nome: string) => ebd.data.campos_das_categorias.find((c: { nome: string }) => c.nome === nome)!.id;
  const evento = await admin
    .from("eventos")
    .insert({
      titulo: `Aula do Drive ${crypto.randomUUID().slice(0, 8)}`,
      categoria_id: ebd.data.id,
      inicio: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      status: "rascunho",
      criado_por: eu,
      campos: { [campo("Tema")]: "A parábola do semeador" },
    })
    .select("id")
    .single()
    .throwOnError();

  await page.goto(`/eventos/${evento.data.id}`);
  const situacao = page.getByRole("status").filter({ hasText: /pasta/i });
  await expect(situacao).toContainText("Criando a pasta no Drive");

  await admin.from("eventos").update({ pasta_estado: "criada", pasta_id: "PASTA1234567" }).eq("id", evento.data.id).throwOnError();
  await page.reload();
  await expect(situacao).toContainText("O link só abre para quem tem acesso à pasta no Drive");

  await admin.from("eventos").update({ pasta_estado: "falhou" }).eq("id", evento.data.id).throwOnError();
  await page.reload();
  await expect(situacao).toContainText("Não foi possível criar a pasta no Drive");
  await expect(situacao).toContainText("Link do material");

  // Um Evento de outra Categoria, sem pasta automática, não diz nada da pasta.
  const culto = await admin.from("categorias").select("id").eq("nome", "Culto").single().throwOnError();
  const semPasta = await admin
    .from("eventos")
    .insert({ titulo: "Culto sem pasta", categoria_id: culto.data.id, inicio: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), status: "rascunho", criado_por: eu })
    .select("id")
    .single()
    .throwOnError();
  await page.goto(`/eventos/${semPasta.data.id}`);
  await expect(page.getByRole("heading", { name: /Culto sem pasta/ })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /pasta/i })).toHaveCount(0);
});

test("o agendador: sem o segredo certo é 401, sem credenciais do Google é 503, e nada redireciona ao login", async ({ request }) => {
  const semSegredo = await request.post("/api/agendador/pastas", { maxRedirects: 0 });
  expect(semSegredo.status()).toBe(401);

  const errado = await request.post("/api/agendador/pastas", { maxRedirects: 0, headers: { Authorization: "Bearer outro-segredo" } });
  expect(errado.status()).toBe(401);

  const comSegredo = await request.post("/api/agendador/pastas", { maxRedirects: 0, headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  expect(comSegredo.status()).toBe(503);
  expect(await comSegredo.json()).toMatchObject({ processado: false });

  // Só POST: o `pg_net` chama com POST.
  expect((await request.get("/api/agendador/pastas", { maxRedirects: 0 })).status()).toBe(405);
});
