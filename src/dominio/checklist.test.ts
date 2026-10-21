import { describe, expect, it } from "vitest";
import { eChecklist, lerMudancaDoChecklist, mudarChecklist, tarefasFeitas, type ItemDoChecklist } from "./checklist";

const itens: ItemDoChecklist[] = [
  { texto: "Reservar ônibus", feito: true },
  { texto: "Comprar lanches", feito: false },
];

const itensDepois = (resultado: ReturnType<typeof mudarChecklist>) => {
  if ("erro" in resultado) throw new Error(resultado.erro);
  return resultado.itens;
};

describe("checklist", () => {
  it("adiciona uma tarefa não feita, sem espaços nas pontas", () => {
    expect(itensDepois(mudarChecklist(itens, { tipo: "adicionar", texto: "  Imprimir autorizações " }))).toEqual([
      ...itens,
      { texto: "Imprimir autorizações", feito: false },
    ]);
  });

  it("não adiciona tarefa vazia", () => {
    expect(mudarChecklist(itens, { tipo: "adicionar", texto: "   " })).toEqual({ erro: "Escreva a tarefa." });
  });

  it("marca e desmarca uma tarefa, sem mexer nas outras nem no checklist anterior", () => {
    const marcado = itensDepois(mudarChecklist(itens, { tipo: "marcar", posicao: 1, feito: true }));
    expect(marcado.map((i) => i.feito)).toEqual([true, true]);
    const desmarcado = itensDepois(mudarChecklist(marcado, { tipo: "marcar", posicao: 0, feito: false }));
    expect(desmarcado.map((i) => i.feito)).toEqual([false, true]);
    expect(itens.map((i) => i.feito)).toEqual([true, false]);
  });

  it("remove uma tarefa", () => {
    expect(itensDepois(mudarChecklist(itens, { tipo: "remover", posicao: 0 }))).toEqual([itens[1]]);
  });

  it("recusa uma posição que não existe", () => {
    for (const posicao of [-1, 2, 0.5, Number.NaN]) {
      expect(mudarChecklist(itens, { tipo: "remover", posicao }), `${posicao}`).toHaveProperty("erro");
      expect(mudarChecklist(itens, { tipo: "marcar", posicao, feito: true }), `${posicao}`).toHaveProperty("erro");
    }
  });

  it("reconhece o formato gravado", () => {
    expect(eChecklist(itens)).toBe(true);
    expect(eChecklist([])).toBe(true);
    expect(eChecklist([{ texto: "", feito: false }])).toBe(false);
    expect(eChecklist([{ texto: "x" }])).toBe(false);
    expect(eChecklist(["x"])).toBe(false);
    expect(eChecklist(null)).toBe(false);
  });

  it("conta as tarefas feitas", () => {
    expect(tarefasFeitas(itens)).toBe(1);
  });

  it("lê o que cada botão envia", () => {
    expect(lerMudancaDoChecklist("adicionar", "Ônibus")).toEqual({ tipo: "adicionar", texto: "Ônibus" });
    expect(lerMudancaDoChecklist("marcar:2:true", "")).toEqual({ tipo: "marcar", posicao: 2, feito: true });
    expect(lerMudancaDoChecklist("marcar:0:false", "")).toEqual({ tipo: "marcar", posicao: 0, feito: false });
    expect(lerMudancaDoChecklist("remover:1", "")).toEqual({ tipo: "remover", posicao: 1 });
  });
});
