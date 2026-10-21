import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { razaoDeContraste } from "./contraste";

describe("razaoDeContraste", () => {
  it("preto no branco é 21 e a mesma cor é 1", () => {
    expect(razaoDeContraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(razaoDeContraste("#284995", "#284995")).toBeCloseTo(1, 5);
  });
});

/** As variáveis de cor de um bloco do globals.css, na ordem em que aparecem. */
function paleta(seletor: string): Record<string, string> {
  const css = readFileSync("src/app/globals.css", "utf8");
  const inicio = css.indexOf(seletor);
  const bloco = css.slice(css.indexOf("{", inicio) + 1, css.indexOf("}", inicio));
  return Object.fromEntries([...bloco.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

// Texto comum precisa de 4,5 (WCAG AA).
const PARES_DE_TEXTO: [string, string][] = [
  ["texto", "fundo"],
  ["texto", "superficie"],
  ["texto-suave", "fundo"],
  ["texto-suave", "superficie"],
  ["marca", "fundo"],
  ["marca", "superficie"],
  ["marca-texto", "marca"],
  ["erro", "superficie"],
  ["sucesso", "superficie"],
  ["aviso", "superficie"],
  ["fundo", "aviso"], // o aviso de "sem internet"
];

describe.each([
  ["modo claro", ":root {"],
  ["modo escuro", ':root[data-tema="escuro"]'],
])("contraste das cores no %s", (_nome, seletor) => {
  const cores = paleta(seletor);
  it.each(PARES_DE_TEXTO)("%s sobre %s passa de 4,5", (frente, fundo) => {
    expect(razaoDeContraste(cores[frente], cores[fundo])).toBeGreaterThanOrEqual(4.5);
  });
  it("a borda dos cartões ainda se distingue da superfície", () => {
    expect(razaoDeContraste(cores["borda"], cores["superficie"])).toBeGreaterThanOrEqual(1.2);
  });
});
