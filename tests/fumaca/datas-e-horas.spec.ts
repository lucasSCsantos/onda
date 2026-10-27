import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/** Fumaça dos seletores de data, de intervalo e de hora, no tamanho de tela de um celular. */

const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
const lerAmbiente = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
const admin = createClient(lerAmbiente("API_URL"), lerAmbiente("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA = "senha-de-teste-123";

async function entrarComoAdmin(page: Page) {
  const convite = await admin.from("convites").insert({ nivel: "admin" }).select("codigo").single().throwOnError();
  await page.goto(`/cadastro?convite=${convite.data.codigo}`);
  await page.getByLabel("Nome").fill(`Datas ${crypto.randomUUID().slice(0, 8)}`);
  await page.getByLabel("E-mail").fill(`${crypto.randomUUID()}@teste.onda`);
  await page.getByLabel("Data de nascimento").fill("1995-05-10");
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
}

/** O que o formulário enviaria, campo a campo. */
const enviado = (page: Page, formulario = "main form") =>
  page.locator(formulario).first().evaluate((f) => Object.fromEntries(new FormData(f as HTMLFormElement).entries()) as Record<string, string>);

test("data: calendário em pt-BR com a semana na segunda, teclado, valor enviado e área de toque", async ({ page }) => {
  await entrarComoAdmin(page);
  const { data: culto } = await admin.from("categorias").select("id").eq("nome", "Culto").single().throwOnError();
  await page.goto(`/eventos/novo/${culto.id}`);

  const campo = page.getByLabel("Data", { exact: true });
  await expect(campo).toHaveAttribute("placeholder", "dd/mm/aaaa");
  expect((await campo.locator("xpath=..").boundingBox())!.height).toBeGreaterThanOrEqual(44);

  const abrir = campo.locator("xpath=following-sibling::button");
  await expect(abrir).toHaveAttribute("aria-haspopup", "dialog");
  await expect(abrir).toHaveAttribute("aria-expanded", "false");
  await abrir.click();
  await expect(abrir).toHaveAttribute("aria-expanded", "true");

  const dialogo = page.getByRole("dialog", { name: /Calendário de Data/ });
  await expect(dialogo).toBeVisible();
  // No celular, painel inferior colado ao pé da tela.
  const caixa = await dialogo.boundingBox();
  expect(Math.abs(caixa!.y + caixa!.height - page.viewportSize()!.height)).toBeLessThan(2);

  // Semana na segunda, em português.
  const cabecalhos = await dialogo.getByRole("columnheader").allTextContents();
  expect(cabecalhos.map((t) => t.toLowerCase())).toEqual(["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]);
  // Hoje destacado, e todo dia com área de toque de 44 px.
  await expect(dialogo.locator("[aria-current='date']")).toHaveCount(1);
  for (const dia of (await dialogo.getByRole("gridcell").all()).slice(0, 7)) expect((await dia.boundingBox())!.width).toBeGreaterThanOrEqual(44);

  // O foco entra no dia; setas andam, Enter escolhe, e o painel fecha devolvendo o foco ao botão.
  await expect(dialogo.locator("button[data-data]:focus")).toHaveCount(1);
  const inicial = await dialogo.locator("button[data-data]:focus").getAttribute("data-data");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const esperado = await dialogo.locator("button[data-data]:focus").getAttribute("data-data");
  expect(esperado).not.toBe(inicial);
  await page.keyboard.press("Enter");
  await expect(dialogo).toHaveCount(0);
  await expect(abrir).toBeFocused();
  const [ano, mes, dia] = esperado!.split("-");
  await expect(campo).toHaveValue(`${dia}/${mes}/${ano}`);
  expect((await enviado(page)).data).toBe(esperado);

  // Esc fecha sem escolher.
  await abrir.click();
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(abrir).toBeFocused();
  await expect(campo).toHaveValue(`${dia}/${mes}/${ano}`);

  // Digitar também vale, e uma data que não existe é barrada com mensagem ligada ao campo.
  await campo.fill("31/02/2027");
  await campo.blur();
  await expect(campo).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: "Data inválida" })).toBeVisible();
  expect((await enviado(page)).data).toBe("");
  await campo.fill("15/03/2027");
  await expect(campo).not.toHaveAttribute("aria-invalid", "true");
  expect((await enviado(page)).data).toBe("2027-03-15");
});

test("hora: digitar, lista em passos, sem horário e hora vazia como dia inteiro", async ({ page }) => {
  await entrarComoAdmin(page);
  const { data: culto } = await admin.from("categorias").select("id").eq("nome", "Culto").single().throwOnError();
  await page.goto(`/eventos/novo/${culto.id}`);

  const hora = page.getByLabel("Hora", { exact: true });
  // Sem hora, o Evento é de dia inteiro: o campo vai vazio, como antes.
  expect((await enviado(page)).hora).toBe("");
  await expect(hora).toHaveAttribute("placeholder", "Sem horário");

  await hora.fill("930");
  await hora.blur();
  await expect(hora).toHaveValue("09:30");
  expect((await enviado(page)).hora).toBe("09:30");

  // Minuto fora do passo também vale.
  await hora.fill("09:10");
  await hora.blur();
  expect((await enviado(page)).hora).toBe("09:10");

  // A lista: passos de 15 minutos, com a hora atual por perto e "Sem horário" no topo.
  await page.getByRole("button", { name: "Escolher a hora" }).first().click();
  const lista = page.getByRole("listbox", { name: "Hora de Hora" });
  await expect(lista).toBeVisible();
  await expect(lista.getByRole("option").nth(0)).toHaveText("Sem horário");
  await expect(lista.getByRole("option").nth(1)).toHaveText("00:00");
  await expect(lista.getByRole("option").nth(2)).toHaveText("00:15");
  await page.getByRole("combobox", { name: /Buscar em Hora de Hora/ }).fill("15:45");
  await page.keyboard.press("Enter");
  await expect(lista).toHaveCount(0);
  await expect(hora).toHaveValue("15:45");
  expect((await enviado(page)).hora).toBe("15:45");

  // "Sem horário" volta ao dia inteiro.
  await page.getByRole("button", { name: "Escolher a hora" }).first().click();
  await page.getByRole("option", { name: "Sem horário" }).click();
  await expect(hora).toHaveValue("");
  expect((await enviado(page)).hora).toBe("");

  // Hora que não existe: mensagem ligada ao campo.
  await hora.fill("25:00");
  await hora.blur();
  await expect(hora).toHaveAttribute("aria-invalid", "true");
});

test("data de nascimento: chega a anos antigos sem rolar mês a mês", async ({ page }) => {
  await page.goto("/cadastro");
  const campo = page.getByLabel("Data de nascimento");
  await page.getByRole("button", { name: "Abrir calendário" }).click();
  const dialogo = page.getByRole("dialog", { name: /Calendário de Data de nascimento/ });
  // Toque no título: anos, e de doze em doze.
  await dialogo.getByRole("button", { name: /escolher mês e ano/ }).click();
  await dialogo.getByRole("button", { name: "Anos anteriores" }).click();
  await dialogo.getByRole("button", { name: "Anos anteriores" }).click();
  await dialogo.getByRole("button", { name: "1995", exact: true }).click();
  await dialogo.getByRole("button", { name: "mai", exact: true }).click();
  await dialogo.getByRole("button", { name: "10 de maio de 1995" }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(campo).toHaveValue("10/05/1995");
  expect((await enviado(page)).data_nascimento).toBe("1995-05-10");
});

test("intervalo: dois toques definem o período, que vai no formulário dos Logs", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin/logs");
  await page.locator("summary", { hasText: "Filtros" }).click();

  const gatilho = page.getByRole("button", { name: /Datas do período/ });
  await expect(gatilho).toContainText("Qualquer período");
  await gatilho.click();
  const dialogo = page.getByRole("dialog", { name: /Calendário de Datas do período/ });
  await dialogo.getByRole("button", { name: /^10 de / }).click();
  // Um toque só: o painel segue aberto, pedindo o último dia.
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText("Agora escolha o último dia.")).toBeVisible();
  await dialogo.getByRole("button", { name: /^20 de / }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(gatilho).toBeFocused();
  await expect(gatilho).toContainText(/^10\/\d{2}\/\d{4} até 20\/\d{2}\/\d{4}$/);

  const valores = await page.locator("form").filter({ has: page.locator("input[name='de']") }).evaluate((f) => {
    const dados = new FormData(f as HTMLFormElement);
    return { de: dados.get("de"), ate: dados.get("ate") };
  });
  expect(valores.de).toMatch(/^\d{4}-\d{2}-10$/);
  expect(valores.ate).toMatch(/^\d{4}-\d{2}-20$/);

  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/de=\d{4}-\d{2}-10/);
  await expect(page).toHaveURL(/ate=\d{4}-\d{2}-20/);
});
