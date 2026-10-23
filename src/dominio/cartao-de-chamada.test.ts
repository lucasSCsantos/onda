import { describe, expect, it } from "vitest";
import type { Status } from "./eventos";
import { cartoesDeChamada, JANELA_PADRAO } from "./cartao-de-chamada";

// 2026-10-21 é uma quarta-feira (fuso America/Bahia, UTC-3)
const em = (dia: string, hora = "19:00") => new Date(`${dia}T${hora}:00-03:00`);
const eu = "eu";

function aula(id: string, dia: string, extra: Partial<Parameters<typeof cartoesDeChamada>[0][number]> = {}) {
  return {
    id,
    inicio: em(dia),
    fim: em(dia, "21:00"),
    diaInteiro: false,
    status: "confirmado" as Status,
    temChamada: true,
    professores: [eu],
    ...extra,
  };
}

const cartoes = (aulas: ReturnType<typeof aula>[], agora: string, feitas: string[] = [], janelaDias = JANELA_PADRAO) =>
  cartoesDeChamada(aulas, { eu, agora: new Date(agora), janelaDias, feitas: new Set(feitas) }).map((c) => [c.aula.id, c.estado]);

describe("cartoesDeChamada", () => {
  it("no dia da aula o cartão aparece desde o começo do dia, mesmo antes do horário", () => {
    expect(cartoes([aula("a", "2026-10-21")], "2026-10-21T03:00:00Z")).toEqual([["a", "de-hoje"]]);
  });

  it("não aparece antes do dia da aula", () => {
    expect(cartoes([aula("a", "2026-10-22")], "2026-10-22T02:59:00Z")).toEqual([]);
  });

  it("vira pendente quando o fim da aula passa sem Chamada", () => {
    expect(cartoes([aula("a", "2026-10-21")], "2026-10-22T00:30:00Z")).toEqual([["a", "pendente"]]);
  });

  it("sem fim, o horário de início é o da aula", () => {
    expect(cartoes([aula("a", "2026-10-21", { fim: null })], "2026-10-21T22:30:00Z")).toEqual([["a", "pendente"]]);
  });

  it("aula de dia inteiro só fica pendente quando o dia acaba", () => {
    const dia = aula("a", "2026-10-21", { inicio: em("2026-10-21", "00:00"), fim: null, diaInteiro: true });
    expect(cartoes([dia], "2026-10-21T20:00:00Z")).toEqual([["a", "de-hoje"]]);
    expect(cartoes([dia], "2026-10-22T10:00:00Z")).toEqual([["a", "pendente"]]);
  });

  it("depois da Chamada concluída mostra 'feita', antes e depois do horário", () => {
    expect(cartoes([aula("a", "2026-10-21")], "2026-10-21T15:00:00Z", ["a"])).toEqual([["a", "feita"]]);
    expect(cartoes([aula("a", "2026-10-21")], "2026-10-22T15:00:00Z", ["a"])).toEqual([["a", "feita"]]);
  });

  it("fica até o fim do dia seguinte e some depois", () => {
    const a = aula("a", "2026-10-21");
    expect(cartoes([a], "2026-10-23T02:59:00Z")).toEqual([["a", "pendente"]]);
    expect(cartoes([a], "2026-10-23T03:00:00Z")).toEqual([]);
  });

  it("a janela é configurável em dias", () => {
    const a = aula("a", "2026-10-21");
    expect(cartoes([a], "2026-10-23T12:00:00Z", [], 0)).toEqual([]);
    expect(cartoes([a], "2026-10-23T12:00:00Z", [], 2)).toEqual([["a", "pendente"]]);
    expect(cartoes([a], "2026-10-21T15:00:00Z", [], 0)).toEqual([["a", "de-hoje"]]);
  });

  it("só para o Professor e o Auxiliar daquela aula, escolhidos pelo id", () => {
    const aulas = [aula("minha", "2026-10-21"), aula("de-outro", "2026-10-21", { professores: ["outro"] }), aula("sem", "2026-10-21", { professores: [] })];
    expect(cartoes(aulas, "2026-10-21T15:00:00Z")).toEqual([["minha", "de-hoje"]]);
  });

  it("só aulas de Categoria com chamada e que vão acontecer", () => {
    const aulas = [
      aula("culto", "2026-10-21", { temChamada: false }),
      aula("cancelada", "2026-10-21", { status: "cancelado" }),
      aula("adiada", "2026-10-21", { status: "adiado" }),
      aula("rascunho", "2026-10-21", { status: "rascunho" }),
      aula("realizada", "2026-10-21", { status: "realizado" }),
    ];
    expect(cartoes(aulas, "2026-10-22T02:00:00Z")).toEqual([["realizada", "pendente"]]);
  });

  it("em ordem cronológica", () => {
    const aulas = [aula("tarde", "2026-10-21", { inicio: em("2026-10-21", "19:00") }), aula("ontem", "2026-10-20"), aula("manha", "2026-10-21", { inicio: em("2026-10-21", "09:00"), fim: null })];
    expect(cartoes(aulas, "2026-10-21T15:00:00Z").map(([id]) => id)).toEqual(["ontem", "manha", "tarde"]);
  });
});
