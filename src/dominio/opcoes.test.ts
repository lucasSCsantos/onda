import { describe, expect, it } from "vitest";
import { alternarValor, buscarPorDigitacao, filtrarOpcoes, indiceDoValor, moverIndice, temBusca } from "./opcoes";

const opcoes = [
  { valor: "1", texto: "Ação social" },
  { valor: "2", texto: "Ensino" },
  { valor: "3", texto: "Evento especial" },
  { valor: "4", texto: "Louvor" },
];

describe("busca dentro das opções", () => {
  it("só oferece a busca com mais de 8 opções", () => {
    expect(temBusca(8)).toBe(false);
    expect(temBusca(9)).toBe(true);
  });

  it("filtra sem diferenciar maiúsculas nem acentos", () => {
    expect(filtrarOpcoes(opcoes, "acao").map((o) => o.valor)).toEqual(["1"]);
    expect(filtrarOpcoes(opcoes, "EN").map((o) => o.valor)).toEqual(["2", "3"]);
  });

  it("sem busca, devolve todas; sem resultado, vazio", () => {
    expect(filtrarOpcoes(opcoes, "  ")).toEqual(opcoes);
    expect(filtrarOpcoes(opcoes, "zzz")).toEqual([]);
  });
});

describe("navegação pelas setas", () => {
  it("anda dentro dos limites, sem dar a volta", () => {
    expect(moverIndice(0, 4, "baixo")).toBe(1);
    expect(moverIndice(3, 4, "baixo")).toBe(3);
    expect(moverIndice(0, 4, "cima")).toBe(0);
  });

  it("sem item ativo, baixo vai ao primeiro e cima ao último", () => {
    expect(moverIndice(-1, 4, "baixo")).toBe(0);
    expect(moverIndice(-1, 4, "cima")).toBe(3);
  });

  it("Home e End, e lista vazia", () => {
    expect(moverIndice(2, 4, "inicio")).toBe(0);
    expect(moverIndice(1, 4, "fim")).toBe(3);
    expect(moverIndice(0, 0, "baixo")).toBe(-1);
  });
});

describe("digitar para achar a opção", () => {
  it("acha a primeira que começa com o que foi digitado, ignorando acento", () => {
    expect(buscarPorDigitacao(opcoes, "l", -1)).toBe(3);
    expect(buscarPorDigitacao(opcoes, "aç", -1)).toBe(0);
  });

  it("repetir a mesma letra percorre as opções que começam com ela", () => {
    expect(buscarPorDigitacao(opcoes, "e", 1)).toBe(2);
    expect(buscarPorDigitacao(opcoes, "ee", 1)).toBe(2);
    expect(buscarPorDigitacao(opcoes, "e", 2)).toBe(1);
  });

  it("sem correspondência, não muda", () => {
    expect(buscarPorDigitacao(opcoes, "x", 2)).toBe(2);
  });
});

describe("valores", () => {
  it("acha o índice do valor, ou -1", () => {
    expect(indiceDoValor(opcoes, "3")).toBe(2);
    expect(indiceDoValor(opcoes, "9")).toBe(-1);
  });

  it("alterna um valor numa seleção múltipla, mantendo a ordem", () => {
    expect(alternarValor(["a"], "b")).toEqual(["a", "b"]);
    expect(alternarValor(["a", "b"], "a")).toEqual(["b"]);
  });
});
