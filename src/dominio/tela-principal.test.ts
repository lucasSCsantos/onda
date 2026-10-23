import { describe, expect, it } from "vitest";
import type { Status } from "./eventos";
import type { EventoFiltravel } from "./filtros";
import { SEM_FILTROS } from "./filtros";
import { montarTelaPrincipal } from "./tela-principal";

// 2026-10-21 é uma quarta-feira; a semana vai de 19/10 a 25/10 (fuso America/Bahia, UTC-3)
const agora = new Date("2026-10-21T15:00:00Z");
const em = (dia: string, hora = "12:00") => new Date(`${dia}T${hora}:00-03:00`);
const eu = "eu";

function evento(id: string, dia: string, extra: Partial<EventoFiltravel> = {}) {
  return {
    id,
    inicio: em(dia),
    fim: null,
    diaInteiro: false,
    status: "planejado" as Status,
    categoriaId: "c1",
    area: "Ensino",
    envolvidos: [] as string[],
    responsavel: "ana" as string | null,
    ...extra,
  };
}

const ids = (lista: { id: string }[]) => lista.map((e) => e.id);
const montar = (eventos: ReturnType<typeof evento>[], soMeus = false) => montarTelaPrincipal(eventos, { eu, agora, soMeus });

describe("montarTelaPrincipal", () => {
  const todos = [
    evento("segunda-minha", "2026-10-19", { envolvidos: [eu] }),
    evento("sexta-outro", "2026-10-23"),
    evento("quinta-minha", "2026-10-22", { envolvidos: ["ana", eu] }),
    evento("domingo-minha", "2026-10-25", { envolvidos: [eu] }),
    evento("semana-que-vem", "2026-10-26", { envolvidos: [eu] }),
    evento("semana-passada", "2026-10-15", { envolvidos: [eu] }),
  ];

  it("'meus' são só os da semana em que a pessoa está envolvida, em ordem cronológica", () => {
    expect(ids(montar(todos).meus)).toEqual(["segunda-minha", "quinta-minha", "domingo-minha"]);
  });

  it("'Esta semana no ONDA' traz todos da semana, ou só os meus com a opção", () => {
    expect(ids(montar(todos).semana)).toEqual(["segunda-minha", "quinta-minha", "sexta-outro", "domingo-minha"]);
    expect(ids(montar(todos, true).semana)).toEqual(["segunda-minha", "quinta-minha", "domingo-minha"]);
  });

  it("'Depois' tem só o que começa depois do domingo, sem repetir nada da semana", () => {
    const tela = montar(todos);
    expect(ids(tela.depois)).toEqual(["semana-que-vem"]);
    expect(ids(tela.depois).filter((id) => ids(tela.semana).includes(id))).toEqual([]);
  });

  it("os filtros valem só para 'Depois'", () => {
    const outros = [evento("a", "2026-10-22"), evento("b", "2026-11-02", { categoriaId: "c2" }), evento("c", "2026-11-03", { categoriaId: "c1" })];
    const tela = montarTelaPrincipal(outros, { eu, agora, filtros: { ...SEM_FILTROS, categorias: ["c2"] } });
    expect(ids(tela.depois)).toEqual(["b"]);
    expect(ids(tela.semana)).toEqual(["a"]);
  });

  it("um Evento de vários dias que começou antes e ainda cobre a semana conta como da semana", () => {
    const acampamento = evento("acampamento", "2026-10-17", { fim: em("2026-10-20"), envolvidos: [eu] });
    const tela = montar([acampamento]);
    expect(ids(tela.semana)).toEqual(["acampamento"]);
    expect(ids(tela.meus)).toEqual(["acampamento"]);
    expect(tela.depois).toEqual([]);
  });

  it("alertas olham só os Eventos da semana: sem Responsável e Rascunho", () => {
    const tela = montar([
      evento("sem-dono", "2026-10-22", { responsavel: null }),
      evento("rascunho", "2026-10-24", { status: "rascunho" }),
      evento("sem-dono-depois", "2026-11-02", { responsavel: null }),
    ]);
    expect(tela.alertas.map((a) => [a.tipo, ids(a.eventos)])).toEqual([
      ["sem-responsavel", ["sem-dono"]],
      ["rascunho", ["rascunho"]],
    ]);
  });

  it("os alertas não mudam com 'só os meus'", () => {
    const tela = montar([evento("sem-dono", "2026-10-22", { responsavel: null })], true);
    expect(tela.alertas).toHaveLength(1);
  });

  it("estados vazios: nada na semana nem depois", () => {
    const tela = montar([]);
    expect(tela).toEqual({ meus: [], semana: [], alertas: [], depois: [] });
  });
});
