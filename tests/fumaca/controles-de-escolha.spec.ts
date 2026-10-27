import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/** Fumaça dos controles de escolha (select, select múltiplo, radio e checkbox), no tamanho de tela de um celular. */

const saida = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
const lerAmbiente = (nome: string) => saida.match(new RegExp(`^${nome}="?([^"\r\n]*)"?`, "m"))?.[1] ?? "";
const admin = createClient(lerAmbiente("API_URL"), lerAmbiente("SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SENHA = "senha-de-teste-123";

async function entrarComoAdmin(page: Page) {
  const convite = await admin.from("convites").insert({ nivel: "admin" }).select("codigo").single().throwOnError();
  await page.goto(`/cadastro?convite=${convite.data.codigo}`);
  await page.getByLabel("Nome").fill(`Controles ${crypto.randomUUID().slice(0, 8)}`);
  await page.getByLabel("E-mail").fill(`${crypto.randomUUID()}@teste.onda`);
  await page.getByLabel("Data de nascimento").fill("1995-05-10");
  await page.getByRole("radio", { name: "Masculino" }).check();
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Próximos eventos" })).toBeVisible();
}

test("select único: teclado, papéis, painel inferior no celular, área de toque e valor enviado no formulário", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin/logs");
  await page.locator("summary", { hasText: "Filtros" }).click();

  const modulo = page.getByRole("combobox", { name: /Módulo/ });
  await expect(modulo).toHaveAttribute("aria-haspopup", "listbox");
  await expect(modulo).toHaveAttribute("aria-expanded", "false");
  expect((await modulo.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Abre pelo toque: no celular é um painel inferior, colado ao pé da tela.
  await modulo.click();
  await expect(modulo).toHaveAttribute("aria-expanded", "true");
  const lista = page.getByRole("listbox", { name: "Módulo" });
  await expect(lista).toBeVisible();
  const painel = await lista.locator("xpath=..").boundingBox();
  const altura = page.viewportSize()!.height;
  expect(Math.abs(painel!.y + painel!.height - altura)).toBeLessThan(2);
  await expect(lista.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  const opcoes = await lista.getByRole("option").count();
  expect(opcoes).toBeGreaterThan(2);
  for (const opcao of await lista.getByRole("option").all()) expect((await opcao.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Esc fecha e devolve o foco ao campo.
  await page.keyboard.press("Escape");
  await expect(lista).toHaveCount(0);
  await expect(modulo).toBeFocused();

  // Teclado: seta abre, seta anda, Enter escolhe.
  await page.keyboard.press("ArrowDown");
  await expect(lista).toBeVisible();
  await page.keyboard.press("ArrowDown");
  const segunda = await lista.getByRole("option").nth(1).textContent();
  await page.keyboard.press("Enter");
  await expect(lista).toHaveCount(0);
  await expect(modulo).toContainText(segunda!.trim());

  // O valor vai no formulário com o mesmo nome de campo.
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/modulo=/);

  // Tocar fora também fecha.
  // Com filtro ligado, o painel de filtros já volta aberto.
  await page.getByRole("combobox", { name: /Módulo/ }).click();
  await expect(page.getByRole("listbox", { name: "Módulo" })).toBeVisible();
  await page.getByRole("heading", { level: 1 }).click({ force: true });
  await expect(page.getByRole("listbox", { name: "Módulo" })).toHaveCount(0);
});

test("select com mais de 8 opções ganha busca no painel", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin/logs");
  await page.locator("summary", { hasText: "Filtros" }).click();
  await page.getByRole("combobox", { name: /Tipo de ação/ }).click();
  const busca = page.getByRole("combobox", { name: /Buscar em Tipo de ação/ });
  await expect(busca).toBeFocused();
  const todas = await page.getByRole("listbox", { name: "Tipo de ação" }).getByRole("option").count();
  await busca.fill("zzzz-nada");
  await expect(page.getByText("Nada encontrado.")).toBeVisible();
  await busca.fill("");
  await expect(page.getByRole("listbox", { name: "Tipo de ação" }).getByRole("option")).toHaveCount(todas);
  await busca.fill("login");
  const filtradas = await page.getByRole("listbox", { name: "Tipo de ação" }).getByRole("option").count();
  expect(filtradas).toBeLessThan(todas);
});

test("select múltiplo nos filtros de Eventos: chips removíveis e o mesmo filtro pela URL", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/calendario");
  await page.getByRole("button", { name: /Filtros avançados/ }).click();

  const categorias = page.getByRole("combobox", { name: /^Categorias/ });
  await categorias.click();
  const lista = page.getByRole("listbox", { name: "Categorias" });
  await expect(lista).toHaveAttribute("aria-multiselectable", "true");
  await lista.getByRole("option", { name: "Culto", exact: true }).first().click();
  // O painel segue aberto: a escolha é múltipla.
  await expect(lista).toBeVisible();
  await lista.getByRole("option", { name: "EBD", exact: true }).first().click();
  await expect(lista.getByRole("option", { name: "EBD", exact: true }).first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");

  await expect(page).toHaveURL(/categoria=.*categoria=/);
  await expect(page.getByRole("button", { name: "Remover Culto" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remover EBD" })).toBeVisible();

  await page.getByRole("button", { name: "Remover Culto" }).click();
  await expect(page.getByRole("button", { name: "Remover Culto" })).toHaveCount(0);
  await expect(page).not.toHaveURL(/categoria=.*categoria=/);
  await expect(page).toHaveURL(/categoria=/);
});

test("checkbox: caixa própria com papel e estado, e o valor vai no formulário", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/adolescentes");
  const inativos = page.getByRole("checkbox", { name: /Mostrar inativos/ });
  await expect(inativos).not.toBeChecked();
  expect((await page.getByText(/Mostrar inativos/).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByText(/Mostrar inativos/).click();
  await expect(inativos).toBeChecked();
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/inativos=1/);
  await expect(page.getByRole("checkbox", { name: /Mostrar inativos/ })).toBeChecked();
});

test("radio visual de ícone: um marcado por vez, por toque e por setas", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin/marcacoes");
  const grupo = page.getByRole("radio");
  const total = await grupo.count();
  expect(total).toBeGreaterThan(2);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(1);

  const primeiro = grupo.first();
  await primeiro.focus();
  await page.keyboard.press("ArrowRight");
  await expect(grupo.nth(1)).toBeChecked();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(1);
  await grupo.nth(2).locator("xpath=..").click();
  await expect(grupo.nth(2)).toBeChecked();
  await expect(grupo.nth(1)).not.toBeChecked();
});

test("select obrigatório sem valor: o navegador barra o envio e leva o foco ao campo", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin/catalogo");
  // Os formulários de "novo" começam sem Área escolhida.
  const area = page.getByRole("combobox", { name: /Escolha a Área/ }).first();
  await expect(area).toHaveAttribute("aria-required", "true");
  const formulario = area.locator("xpath=ancestor::form");
  await formulario.locator("input[name=nome]").fill("Sem Área");
  await formulario.locator("button[type=submit]").click();
  await expect(area).toBeFocused();
});
