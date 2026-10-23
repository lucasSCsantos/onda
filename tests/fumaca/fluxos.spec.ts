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

/** Convite de Admin, sem Função. */
async function novoConviteDeAdmin(): Promise<string> {
  const convite = await admin.from("convites").insert({ nivel: "admin" }).select("codigo").single();
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
  await page.getByRole("button", { name: "Abrir menu" }).click();
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

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("link", { name: "Calendário" }).click();
  await expect(page.getByRole("link", { name: new RegExp(titulo) }).first()).toBeVisible();

  // No celular não pode haver rolagem lateral.
  const larguraExcedida = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(larguraExcedida).toBeLessThanOrEqual(0);
});

test("menu hambúrguer: abre, mostra os destinos, fecha com Esc e ao navegar", async ({ page }) => {
  await cadastrar(page, "Menu de Fumaça", await novoConvite());
  const botao = page.getByRole("button", { name: "Abrir menu" });
  await expect(botao).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: "Adolescentes" })).toBeHidden();

  await botao.click();
  const menu = page.getByRole("button", { name: "Fechar menu" });
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Adolescentes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Adolescentes" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeFocused();

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("link", { name: "Calendário" }).click();
  await expect(page).toHaveURL(/\/calendario/);
  await expect(page.getByRole("link", { name: "Adolescentes" })).toBeHidden();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("link", { name: "Calendário" })).toHaveAttribute("aria-current", "page");
});

test("Painel do dia: tocar num dia abre o painel com a URL refletindo o dia, e fecha", async ({ page }) => {
  await cadastrar(page, "Painel de Fumaça", await novoConvite());
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();

  await page.goto("/calendario?visao=mes");
  const painel = page.getByRole("dialog");
  await expect(painel).toBeHidden();

  await page.locator(`a[href*="abrir=${hoje()}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`abrir=${hoje()}`));
  await expect(painel).toBeVisible();
  await expect(painel.getByRole("button", { name: "Fechar" })).toBeVisible();

  await painel.getByRole("button", { name: "Fechar" }).click();
  await expect(painel).toBeHidden();
  await expect(page).not.toHaveURL(/abrir=/);

  // Esc fecha, e o voltar do navegador também.
  await page.locator(`a[href*="abrir=${hoje()}"]`).first().click();
  await expect(painel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(painel).toBeHidden();
  await expect(page).not.toHaveURL(/abrir=/);

  await page.locator(`a[href*="abrir=${hoje()}"]`).first().click();
  await expect(painel).toBeVisible();
  await page.goBack();
  await expect(painel).toBeHidden();
});

test("painel do Admin: indicadores, cartões e navegação; o Líder não entra", async ({ page }) => {
  await cadastrar(page, "Admin de Fumaça", await novoConviteDeAdmin());
  await page.getByRole("button", { name: "Abrir menu" }).click();
  // O header do Admin tem só Calendário, Adolescentes e Administração.
  await expect(page.getByRole("link", { name: "Professores" })).toBeHidden();
  await page.getByRole("link", { name: "Administração" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Indicadores" }).getByText("Aguardando aprovação")).toBeVisible();
  await expect(page.getByRole("region", { name: "Indicadores" }).getByText("Eventos sem Responsável")).toBeVisible();
  const secoes = page.getByRole("region", { name: "Seções" });
  for (const nome of ["Usuários", "Convites", "Catálogo", "Professores", "Exportar"]) {
    await expect(secoes.getByRole("link", { name: new RegExp(nome) })).toBeVisible();
  }

  await secoes.getByRole("link", { name: /Convites/ }).click();
  await expect(page.getByRole("heading", { name: "Novo convite" })).toBeVisible();
  // No celular não há sidebar; a navegação administrativa está no menu.
  await expect(page.getByRole("navigation", { name: "Administração" })).toBeHidden();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("link", { name: "Usuários" })).toBeVisible();
});

test("o formulário de Evento mostra só os campos da Categoria", async ({ page }) => {
  await cadastrar(page, "Campos de Fumaça", await novoConviteDeAdmin());
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  const { data: categorias } = await admin.from("categorias").select("id, nome").in("nome", ["Postagem", "Evento extra", "Culto"]);
  const id = (nome: string) => categorias!.find((c) => c.nome === nome)!.id;

  // Postagem: só a Publicação, sem fim, local nem link.
  await page.goto(`/eventos/novo/${id("Postagem")}`);
  await expect(page.getByLabel("Publicação", { exact: true })).toBeVisible();
  for (const oculto of ["Local", "Fim (data)", "Fim (hora)", "Link"]) await expect(page.getByLabel(oculto, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Observações")).toBeVisible();

  // Evento extra: o local é obrigatório, e o navegador barra o envio sem ele.
  await page.goto(`/eventos/novo/${id("Evento extra")}`);
  await expect(page.getByLabel("Local", { exact: true })).toHaveAttribute("required", "");
  await expect(page.getByLabel("Fim (data)")).toBeVisible();

  // Culto: local e link opcionais; as observações já estão na liturgia.
  await page.goto(`/eventos/novo/${id("Culto")}`);
  await expect(page.getByLabel("Local", { exact: true })).not.toHaveAttribute("required", "");
  await expect(page.getByLabel("Link", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Observações", { exact: true })).toHaveCount(0);

  // O Admin configura isso na tela da Categoria, e não há rolagem lateral no celular.
  await page.goto(`/admin/catalogo/${id("Postagem")}`);
  await expect(page.getByLabel(/^Local/)).toHaveValue("oculto");
  await expect(page.getByLabel(/^Fim/)).toHaveValue("oculto");
  const larguraExcedida = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(larguraExcedida).toBeLessThanOrEqual(0);
});

test("Logs: o Admin vê a própria entrada em frase legível, abre os detalhes e filtra os alertas", async ({ page }) => {
  await cadastrar(page, "Logs de Fumaça", await novoConviteDeAdmin());
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  await page.goto("/admin/logs");
  await expect(page.getByRole("heading", { name: "Logs", exact: true })).toBeVisible();

  const cadastro = page.getByText("Logs de Fumaça criou uma conta com um convite, como Admin").first();
  await expect(cadastro).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
  await cadastro.click();
  await expect(page.getByText("Detalhe técnico").first()).toBeVisible();

  await page.getByRole("link", { name: "Alertas e erros" }).click();
  await expect(page).toHaveURL(/aba=alertas/);
  await expect(page.getByText("Logs de Fumaça criou uma conta")).toHaveCount(0);
});

test("Chamada: um toque marca e salva na hora, e a marcação continua depois de recarregar", async ({ page }) => {
  const nome = `Chamada ${crypto.randomUUID().slice(0, 6)}`;
  await cadastrar(page, nome, await novoConviteDeAdmin());
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();

  const { data: eu } = await admin.from("perfis").select("id").eq("nome", nome).single();
  const ebd = await admin.from("categorias").select("id, campos_das_categorias(id, nome)").eq("nome", "EBD").single();
  const tema = (ebd.data!.campos_das_categorias as { id: string; nome: string }[]).find((c) => c.nome === "Tema")!.id;
  const aluno = `Ana ${crypto.randomUUID().slice(0, 6)}`;
  await admin.from("adolescentes").insert({ nome: aluno, nascimento: "2011-05-10" }).throwOnError();
  const { data: aula } = await admin
    .from("eventos")
    .insert({
      titulo: "EBD de fumaça",
      categoria_id: ebd.data!.id,
      inicio: `${hoje()}T00:01:00-03:00`,
      responsavel_id: eu!.id,
      status: "planejado",
      campos: { [tema]: "Semeador" },
      criado_por: eu!.id,
    })
    .select("id")
    .single()
    .throwOnError();

  await page.goto(`/eventos/${aula.id}`);
  await page.getByRole("link", { name: "Chamada" }).click();
  await expect(page.getByRole("heading", { name: "Chamada" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Procurar Adolescente" }).fill(aluno);
  const marcacoes = page.getByRole("group", { name: `Marcações de ${aluno}` });
  await marcacoes.getByRole("button", { name: "Trouxe bíblia" }).click();
  await expect(page.getByText("Salvo")).toBeVisible();
  await expect(marcacoes.getByRole("button", { name: "Presente" })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await page.getByRole("searchbox", { name: "Procurar Adolescente" }).fill(aluno);
  await expect(page.getByRole("group", { name: `Marcações de ${aluno}` }).getByRole("button", { name: "Trouxe bíblia" })).toHaveAttribute("aria-pressed", "true");
});

test("o Líder é mandado de volta ao início ao abrir /admin", async ({ page }) => {
  await cadastrar(page, "Líder Barrado", await novoConvite());
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin/usuarios");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin/logs");
  await expect(page).toHaveURL(/\/$/);
});

test("atalhos de filtro: ligar muda a lista e a URL sem botão, e Limpar desliga", async ({ page }) => {
  await cadastrar(page, "Atalhos de Fumaça", await novoConvite());
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  const barra = page.getByRole("group", { name: "Atalhos de filtro" });
  await expect(barra.getByRole("button", { name: "Próximos" })).toHaveCount(0);
  await expect(barra.getByRole("button", { name: "Limpar" })).toHaveCount(0);

  // Quem acabou de entrar não tem Evento nenhum: "Meus eventos" esvazia a lista sem apertar "Filtrar".
  await barra.getByRole("button", { name: "Meus eventos" }).click();
  await expect(page).toHaveURL(/meus=1/);
  await expect(page.getByText("Nenhum Evento com esses filtros.")).toBeVisible();
  await barra.getByRole("button", { name: "Meus eventos" }).click();
  await expect(page.getByText("Nenhum Evento com esses filtros.")).toBeHidden();

  await barra.getByRole("button", { name: "Atrasados" }).click();
  await expect(page).toHaveURL(/atrasados=1/);
  await expect(barra.getByRole("button", { name: "Atrasados" })).toHaveAttribute("aria-pressed", "true");

  await barra.getByRole("button", { name: "Sem Responsável" }).click();
  await expect(page).toHaveURL(/sem-responsavel=1/);
  await expect(page).toHaveURL(/atrasados=1/);

  await barra.getByRole("button", { name: "Limpar" }).click();
  await expect(page).not.toHaveURL(/atrasados|sem-responsavel/);
  await expect(barra.getByRole("button", { name: "Atrasados" })).toHaveAttribute("aria-pressed", "false");

  await page.goto("/calendario?atrasados=1");
  await expect(page.getByRole("group", { name: "Atalhos de filtro" }).getByRole("button", { name: "Próximos" })).toBeVisible();
  await page.getByRole("link", { name: "Hoje", exact: true }).click();
  await expect(page).toHaveURL(/atrasados=1/);
});

test("filtros avançados: abrem com contador, aplicam na hora e abrem sozinhos pela URL", async ({ page }) => {
  await cadastrar(page, "Avançados de Fumaça", await novoConvite());
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filtrar", exact: true })).toHaveCount(0);

  const botao = page.getByRole("button", { name: /Filtros avançados/ });
  await expect(botao).toHaveAttribute("aria-expanded", "false");
  await botao.click();
  await expect(botao).toHaveAttribute("aria-expanded", "true");
  const painel = page.getByRole("group", { name: "Filtros avançados" });
  await expect(painel).toBeVisible();
  expect((await painel.getByLabel("Status", { exact: true }).locator("option").allTextContents()).length).toBe(7);

  await painel.getByLabel("Status", { exact: true }).selectOption("adiado");
  await expect(page).toHaveURL(/status=adiado/);
  await expect(botao).toContainText("1");
  await painel.getByLabel("Dia", { exact: true }).fill("2026-10-21");
  await expect(page).toHaveURL(/data=2026-10-21/);
  await expect(page).toHaveURL(/status=adiado/);

  // Fecha com Esc, e a URL com filtro avançado abre o painel sozinha.
  await page.goto("/calendario?status=adiado");
  await expect(page.getByRole("button", { name: /Filtros avançados/ })).toHaveAttribute("aria-expanded", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
