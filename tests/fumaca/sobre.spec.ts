import { expect, test } from "@playwright/test";

/** Fumaça da página /sobre: pública, de marca neutra, com as imagens do produto, sem rolagem lateral no celular. */

test("quem não entrou abre a página /sobre, de marca neutra e com as imagens do produto", async ({ page }) => {
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

  // Marca neutra: nem o nome do ministério nem o da igreja, nem o rodapé com as logos, nem nas imagens (que têm o texto alternativo).
  const texto = await page.locator("body").innerText();
  expect(texto).not.toMatch(/ONDA|IBAM/i);
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.locator('[aria-label="ONDA"], [aria-label="IBAM Ondina"]')).toHaveCount(0);

  const imagens = page.locator("main img");
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
