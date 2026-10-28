import { expect, test } from "@playwright/test";

/** Fumaça da página /sobre: pública, com a logo do ONDA no cabeçalho e as imagens do produto, sem rolagem lateral no celular. */

test("quem não entrou abre a página /sobre, com a logo no cabeçalho e as imagens do produto", async ({ page }) => {
  await page.goto("/sobre");
  await expect(page).toHaveURL(/\/sobre$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Um bloco por grupo de funcionalidades e o dos bastidores.
  for (const titulo of ["Calendário", "Chamada", "Acesso", "Avisos", "Por trás do produto"]) {
    await expect(page.getByRole("heading", { level: 2, name: new RegExp(titulo) })).toBeVisible();
  }
  for (const titulo of ["Processo", "Testes", "Stack"]) {
    await expect(page.getByRole("heading", { level: 3, name: new RegExp(titulo) })).toBeVisible();
  }

  // Marca: a logo do ONDA só no cabeçalho; a da igreja e o rodapé do app (que traz as duas) não aparecem.
  await expect(page.locator('header [aria-label="ONDA"]')).toHaveCount(1);
  await expect(page.locator('[aria-label="IBAM Ondina"]')).toHaveCount(0);
  await expect(page.locator("footer")).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toMatch(/IBAM/i);

  // As telas da vitrine existem em duas versões (fixa no computador, em linha no celular); só a visível carrega.
  const imagens = page.locator("main img:visible");
  expect(await imagens.count()).toBeGreaterThanOrEqual(6);
  for (const imagem of await imagens.all()) {
    await imagem.scrollIntoViewIfNeeded();
    await expect.poll(() => imagem.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(imagem).toHaveAttribute("alt", /.{10,}/);
  }

  await expect(page.getByRole("link", { name: /GitHub/ }).first()).toHaveAttribute("href", /^https:\/\/github\.com\//);
  // Celular: nada passa da largura da tela.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("os buscadores podem ler só a página /sobre", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Allow: \/sobre\n/);
  expect(robots).toMatch(/Disallow: \//);
});
