import { describe, expect, it } from "vitest";
import { anosDoSeletor, classificar, lerAno, lerDesempate, type PontosDaMarcacao } from "./ranking";

const linha = (adolescente: string, marcacao: string, quantas: number, pontosPorVez: number): PontosDaMarcacao => ({
  adolescente,
  nome: adolescente[0].toUpperCase() + adolescente.slice(1),
  ativo: adolescente !== "caio",
  marcacao,
  quantas,
  pontos: quantas * pontosPorVez,
});

// Presente vale 1, Bíblia 1, Visitante 3, Atividade 2.
const LINHAS = [
  linha("ana", "presente", 10, 1),
  linha("ana", "visitante", 1, 3),
  linha("bia", "presente", 8, 1),
  linha("bia", "atividade", 2, 2),
  linha("bia", "biblia", 1, 1),
  linha("caio", "presente", 5, 1),
  linha("davi", "presente", 13, 1),
];

describe("classificar", () => {
  it("soma os pontos de cada um e põe quem tem mais na frente, com o detalhamento", () => {
    const ranking = classificar(LINHAS, "presente");
    expect(ranking.map((r) => [r.posicao, r.adolescente.nome, r.pontos])).toEqual([
      [1, "Davi", 13],
      [2, "Ana", 13],
      [3, "Bia", 13],
      [4, "Caio", 5],
    ]);
    expect(ranking[2].porMarcacao).toEqual([
      { marcacao: "presente", quantas: 8, pontos: 8 },
      { marcacao: "atividade", quantas: 2, pontos: 4 },
      { marcacao: "biblia", quantas: 1, pontos: 1 },
    ]);
    expect(ranking[3].adolescente.ativo).toBe(false);
  });

  it("no empate de pontos, desempata pela Marcação escolhida (padrão: mais presenças)", () => {
    expect(classificar(LINHAS, "presente").slice(0, 3).map((r) => [r.adolescente.nome, r.desempate])).toEqual([
      ["Davi", 13],
      ["Ana", 10],
      ["Bia", 8],
    ]);
    expect(classificar(LINHAS, "atividade").slice(0, 3).map((r) => r.adolescente.nome)).toEqual(["Bia", "Ana", "Davi"]);
  });

  it("quem continua empatado divide a posição, e a seguinte pula", () => {
    // Ana e Davi empatam também em Atividade (0): dividem o 2º lugar, e Caio é o 4º.
    expect(classificar(LINHAS, "atividade").map((r) => [r.posicao, r.adolescente.nome])).toEqual([
      [1, "Bia"],
      [2, "Ana"],
      [2, "Davi"],
      [4, "Caio"],
    ]);
  });

  it("sem desempate, o empate em pontos já divide a posição", () => {
    expect(classificar(LINHAS, null).map((r) => r.posicao)).toEqual([1, 1, 1, 4]);
  });

  it("sem presença no ano, o ranking é vazio", () => {
    expect(classificar([], "presente")).toEqual([]);
  });
});

describe("ano do ranking", () => {
  // 1º/01/2027, 1h em Salvador: ainda 31/12/2026 em nenhum lugar, mas 2027 já começou no fuso do Mural.
  const agora = new Date("2027-01-01T01:00:00-03:00");

  it("usa o ano pedido, ou o corrente no fuso do Mural", () => {
    expect(lerAno("2025", agora)).toBe(2025);
    expect(lerAno(undefined, agora)).toBe(2027);
    expect(lerAno("abc", agora)).toBe(2027);
    expect(lerAno("1800", agora)).toBe(2027);
    expect(lerAno("2026", new Date("2027-01-01T02:30:00Z"))).toBe(2026);
    expect(lerAno(undefined, new Date("2027-01-01T02:30:00Z"))).toBe(2026);
  });

  it("o seletor tem o ano corrente e os anos com presença, sem repetir", () => {
    expect(anosDoSeletor([2026, 2025], agora)).toEqual([2027, 2026, 2025]);
    expect(anosDoSeletor([2027], agora)).toEqual([2027]);
  });

  it("o desempate é uma Marcação ou nenhum", () => {
    expect(lerDesempate("")).toBeNull();
    expect(lerDesempate("11111111-1111-1111-1111-111111111111")).toBe("11111111-1111-1111-1111-111111111111");
    expect(lerDesempate("qualquer")).toHaveProperty("erro");
  });
});
