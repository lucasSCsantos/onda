import { describe, expect, it } from "vitest";
import type { Status } from "./eventos";
import { alertas, envolvidosDoEvento, filtrar, haFiltros, lerFiltros, parametrosDosFiltros, proximosEventos, SEM_FILTROS, type EventoFiltravel } from "./filtros";

// 2026-10-21 é uma quarta-feira; a semana vai de 19/10 a 25/10 (fuso America/Bahia, UTC-3)
const agora = new Date("2026-10-21T15:00:00Z");
const em = (dia: string, hora = "12:00") => new Date(`${dia}T${hora}:00-03:00`);

function evento(dia: string, extra: Partial<EventoFiltravel> = {}) {
  return {
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

const eu = "eu";
const filtrado = (eventos: ReturnType<typeof evento>[], filtros: Partial<typeof SEM_FILTROS>) =>
  filtrar(eventos, { ...SEM_FILTROS, ...filtros }, { eu, agora });

describe("envolvidosDoEvento", () => {
  const definicoes = [
    { id: "p", nome: "Professor", tipo: "pessoa" },
    { id: "a", nome: "Auxiliar", tipo: "pessoa" },
    { id: "r", nome: "Regente", tipo: "pessoa" },
    { id: "t", nome: "Professor", tipo: "texto" },
  ];

  it("junta o Responsável, o Professor e o Auxiliar, sem repetir", () => {
    expect(envolvidosDoEvento("ana", { p: "bia", a: "ana", r: "caio", t: "x" }, definicoes)).toEqual(["ana", "bia"]);
  });

  it("aceita Evento sem Responsável nem aula", () => {
    expect(envolvidosDoEvento(null, {}, definicoes)).toEqual([]);
  });
});

describe("filtros", () => {
  it("sem filtros, tudo passa", () => {
    expect(filtrado([evento("2026-10-21"), evento("2026-12-01")], {})).toHaveLength(2);
  });

  it("meus eventos: Responsável, Professor ou Auxiliar", () => {
    const meu = evento("2026-10-21", { envolvidos: ["x", eu] });
    expect(filtrado([meu, evento("2026-10-21", { envolvidos: ["x"] })], { meus: true })).toEqual([meu]);
  });

  it("esta semana vai de segunda a domingo", () => {
    const dentro = [evento("2026-10-19"), evento("2026-10-25")];
    const fora = [evento("2026-10-18"), evento("2026-10-26")];
    expect(filtrado([...fora, ...dentro], { semana: true })).toEqual(dentro);
  });

  it("esta semana inclui um Evento de vários dias que a atravessa", () => {
    const longo = { ...evento("2026-10-15"), diaInteiro: true, inicio: em("2026-10-15", "00:00"), fim: em("2026-10-30", "00:00") };
    expect(filtrado([longo], { semana: true })).toEqual([longo]);
  });

  it("um dia: o Evento cobre aquele dia", () => {
    const longo = { ...evento("2026-10-20"), fim: em("2026-10-22") };
    const outro = evento("2026-10-23");
    expect(filtrado([longo, outro], { dia: "2026-10-21" })).toEqual([longo]);
  });

  it("Categoria é múltipla", () => {
    const [a, b, c] = ["a", "b", "c"].map((categoriaId) => evento("2026-10-21", { categoriaId }));
    expect(filtrado([a, b, c], { categorias: ["a", "c"] })).toEqual([a, c]);
  });

  it("Área e Status", () => {
    const louvor = evento("2026-10-21", { area: "Louvor", status: "confirmado" });
    const ensino = evento("2026-10-21", { area: "Ensino", status: "confirmado" });
    const rascunho = evento("2026-10-21", { area: "Louvor", status: "rascunho" });
    expect(filtrado([louvor, ensino, rascunho], { area: "Louvor" })).toEqual([louvor, rascunho]);
    expect(filtrado([louvor, ensino, rascunho], { status: "confirmado" })).toEqual([louvor, ensino]);
  });

  it("combinam entre si", () => {
    const certo = evento("2026-10-22", { envolvidos: [eu], area: "Louvor", categoriaId: "a", status: "confirmado" });
    const errados = [
      { ...certo, envolvidos: [] },
      { ...certo, inicio: em("2026-11-22") },
      { ...certo, area: "Ensino" },
      { ...certo, categoriaId: "b" },
      { ...certo, status: "planejado" as Status },
    ];
    const filtros = { meus: true, semana: true, categorias: ["a"], area: "Louvor", status: "confirmado" as Status };
    expect(filtrado([certo, ...errados], filtros)).toEqual([certo]);
  });
});

describe("lerFiltros", () => {
  it("lê os parâmetros da URL", () => {
    expect(
      lerFiltros({ meus: "1", semana: "1", data: "2026-10-21", categoria: ["a", "b"], area: "Louvor", status: "adiado" }),
    ).toEqual({ ...SEM_FILTROS, meus: true, semana: true, dia: "2026-10-21", categorias: ["a", "b"], area: "Louvor", status: "adiado" });
  });

  it("uma Categoria só vem como texto", () => {
    expect(lerFiltros({ categoria: "a" }).categorias).toEqual(["a"]);
  });

  it("ignora o que não reconhece", () => {
    expect(lerFiltros({ meus: "sim", data: "2026-02-31", status: "zumbi" })).toEqual(SEM_FILTROS);
  });
});

describe("parametrosDosFiltros", () => {
  it("volta aos mesmos filtros ao ser lido de novo", () => {
    const filtros = {
      meus: true,
      hoje: true,
      semana: true,
      proximos: true,
      semResponsavel: true,
      semProfessor: true,
      atrasados: true,
      dia: "2026-10-21",
      categorias: ["a", "b"],
      area: "Louvor",
      status: "adiado" as Status,
    };
    const parametros = new URLSearchParams(parametrosDosFiltros(filtros));
    expect(lerFiltros({ ...Object.fromEntries(parametros), categoria: parametros.getAll("categoria") })).toEqual(filtros);
  });

  it("sem filtros, nenhum parâmetro", () => {
    expect(parametrosDosFiltros(SEM_FILTROS)).toEqual([]);
  });
});

describe("Próximos eventos", () => {
  it("agrupa em hoje, esta semana e depois, em ordem, e deixa de fora o que passou", () => {
    const passou = evento("2026-10-20");
    const hojeTarde = evento("2026-10-21", { inicio: em("2026-10-21", "19:00") });
    const hojeCedo = evento("2026-10-21", { inicio: em("2026-10-21", "08:00") });
    const domingo = evento("2026-10-25");
    const segunda = evento("2026-10-26");
    const emCurso = { ...evento("2026-10-19"), diaInteiro: true, inicio: em("2026-10-19", "00:00"), fim: em("2026-10-22", "00:00") };

    const grupos = proximosEventos([segunda, domingo, passou, hojeTarde, emCurso, hojeCedo], agora);

    expect(grupos.hoje).toEqual([emCurso, hojeCedo, hojeTarde]);
    expect(grupos.semana).toEqual([domingo]);
    expect(grupos.depois).toEqual([segunda]);
  });
});

describe("alertas", () => {
  const tipos = (eventos: Parameters<typeof alertas>[0]) => alertas(eventos, agora).map((a) => a.tipo);

  it("sem Responsável: Rascunho, Planejado ou Confirmado ainda por vir", () => {
    const futuro = evento("2026-10-30", { responsavel: null });
    expect(alertas([futuro], agora)).toEqual([{ tipo: "sem-responsavel", eventos: [futuro] }]);
    expect(tipos([evento("2026-10-30", { responsavel: null, status: "confirmado" })])).toEqual(["sem-responsavel"]);
  });

  it("Rascunho alerta, e um Rascunho sem Responsável aparece nos dois", () => {
    expect(tipos([evento("2026-10-30", { status: "rascunho", responsavel: null })])).toEqual(["sem-responsavel", "rascunho"]);
  });

  it("Planejado e Rascunho que passaram da data alertam como vencidos", () => {
    expect(tipos([evento("2026-10-10")])).toEqual(["vencido"]);
    expect(tipos([evento("2026-10-10", { status: "rascunho" })])).toEqual(["rascunho", "vencido"]);
  });

  it("não vence antes do fim", () => {
    expect(tipos([evento("2026-10-21", { inicio: em("2026-10-21", "10:00"), fim: em("2026-10-21", "18:00") })])).toEqual([]);
    expect(tipos([evento("2026-10-21", { inicio: em("2026-10-21", "10:00"), fim: em("2026-10-21", "11:00") })])).toEqual(["vencido"]);
  });

  it("Adiado, Cancelado e Realizado não alertam", () => {
    for (const status of ["adiado", "cancelado", "realizado"] as const) {
      expect(tipos([evento("2026-10-10", { status, responsavel: null }), evento("2026-10-30", { status, responsavel: null })])).toEqual([]);
    }
  });

  it("Confirmado com Responsável não alerta", () => {
    expect(tipos([evento("2026-10-30", { status: "confirmado" })])).toEqual([]);
  });
});

describe("alerta de aula sem Professor", () => {
  type Aula = ReturnType<typeof evento> & { semProfessor?: boolean };
  const tipos = (eventos: Aula[]) => alertas(eventos, agora).map((a) => a.tipo);

  it("avisa a aula sem Professor que ainda não terminou, em Rascunho, Planejado ou Confirmado", () => {
    for (const status of ["rascunho", "planejado", "confirmado"] as Status[]) {
      expect(tipos([{ ...evento("2026-10-24", { status }), semProfessor: true }])).toContain("aula-sem-professor");
    }
  });

  it("não avisa aula com Professor, vencida, Adiada, Cancelada ou Realizada", () => {
    expect(tipos([{ ...evento("2026-10-24"), semProfessor: false }])).toEqual([]);
    expect(tipos([evento("2026-10-24")])).toEqual([]);
    // Vencida: já passou da data, então só o alerta de vencido vale.
    expect(tipos([{ ...evento("2026-10-14"), semProfessor: true }])).toEqual(["vencido"]);
    for (const status of ["adiado", "cancelado", "realizado"] as Status[]) {
      expect(tipos([{ ...evento("2026-10-24", { status }), semProfessor: true }])).toEqual([]);
    }
  });

  it("um Rascunho sem Professor e sem Responsável cai em três alertas, sem impedir nada", () => {
    expect(tipos([{ ...evento("2026-10-24", { status: "rascunho", responsavel: null }), semProfessor: true }])).toEqual([
      "sem-responsavel",
      "aula-sem-professor",
      "rascunho",
    ]);
  });
});

describe("atalhos de filtro", () => {
  type Aula = ReturnType<typeof evento> & { semProfessor?: boolean };
  const dos = (eventos: Aula[], filtros: Partial<typeof SEM_FILTROS>) => filtrado(eventos, filtros);

  it("hoje: cobre o dia de hoje, inclusive Evento de vários dias", () => {
    const hoje = evento("2026-10-21");
    const longo = evento("2026-10-19", { fim: em("2026-10-23"), diaInteiro: true });
    const amanha = evento("2026-10-22");
    const ontem = evento("2026-10-20");
    expect(dos([hoje, longo, amanha, ontem], { hoje: true })).toEqual([hoje, longo]);
  });

  it("próximos: esconde o que já terminou, mantém o que cobre hoje", () => {
    const passado = evento("2026-10-20");
    const hoje = evento("2026-10-21");
    const longo = evento("2026-10-19", { fim: em("2026-10-22"), diaInteiro: true });
    const futuro = evento("2026-11-01");
    expect(dos([passado, hoje, longo, futuro], { proximos: true })).toEqual([hoje, longo, futuro]);
  });

  it("sem Responsável: Evento ativo sem Responsável; ignora Cancelado, Realizado, Adiado e vencido", () => {
    const sem = evento("2026-10-30", { responsavel: null });
    const confirmado = evento("2026-10-30", { responsavel: null, status: "confirmado" });
    const outros = [
      evento("2026-10-30", { responsavel: null, status: "cancelado" }),
      evento("2026-10-30", { responsavel: null, status: "adiado" }),
      evento("2026-10-10", { responsavel: null, status: "realizado" }),
      evento("2026-10-10", { responsavel: null }),
      evento("2026-10-30"),
    ];
    expect(dos([sem, confirmado, ...outros], { semResponsavel: true })).toEqual([sem, confirmado]);
  });

  it("aula sem Professor: só a aula ativa e sem Professor", () => {
    const aula: Aula = { ...evento("2026-10-30"), semProfessor: true };
    const comProfessor: Aula = { ...evento("2026-10-30"), semProfessor: false };
    const vencida: Aula = { ...evento("2026-10-10"), semProfessor: true };
    expect(dos([aula, comProfessor, vencida], { semProfessor: true })).toEqual([aula]);
  });

  it("atrasados: Planejado ou Rascunho que já terminou; Confirmado e o que ainda vem ficam de fora", () => {
    const planejado = evento("2026-10-10");
    const rascunho = evento("2026-10-10", { status: "rascunho" });
    const outros = [
      evento("2026-10-10", { status: "confirmado" }),
      evento("2026-10-10", { status: "realizado" }),
      evento("2026-10-30"),
      evento("2026-10-21", { fim: em("2026-10-21", "18:00") }),
    ];
    expect(dos([planejado, rascunho, ...outros], { atrasados: true })).toEqual([planejado, rascunho]);
  });

  it("os atalhos combinam entre si", () => {
    const certo = evento("2026-10-21", { responsavel: null, envolvidos: [eu] });
    const semMeu = evento("2026-10-21", { responsavel: null });
    expect(dos([certo, semMeu], { hoje: true, semResponsavel: true, meus: true })).toEqual([certo]);
  });

  it("os atalhos por situação seguem as mesmas regras dos alertas", () => {
    const aula = (dia: string, extra: Partial<EventoFiltravel> = {}): Aula => ({ ...evento(dia, extra), semProfessor: true });
    const todos: Aula[] = (["rascunho", "planejado", "confirmado", "realizado", "cancelado", "adiado"] as Status[]).flatMap((status) =>
      ["2026-10-10", "2026-10-21", "2026-10-30"].flatMap((dia) => [aula(dia, { status }), aula(dia, { status, responsavel: null })]),
    );
    const doAlerta = (tipo: string) => alertas(todos, agora).find((a) => a.tipo === tipo)?.eventos ?? [];
    expect(dos(todos, { semResponsavel: true }).sort(porInicio)).toEqual(doAlerta("sem-responsavel").sort(porInicio));
    expect(dos(todos, { semProfessor: true }).sort(porInicio)).toEqual(doAlerta("aula-sem-professor").sort(porInicio));
    expect(dos(todos, { atrasados: true }).sort(porInicio)).toEqual(doAlerta("vencido").sort(porInicio));
    expect(dos(todos, { status: "rascunho" }).sort(porInicio)).toEqual(doAlerta("rascunho").sort(porInicio));
  });

  it("os atalhos fazem o ciclo URL → filtros → URL", () => {
    const url = { meus: "1", hoje: "1", semana: "1", proximos: "1", "sem-responsavel": "1", "sem-professor": "1", atrasados: "1" };
    const filtros = lerFiltros(url);
    expect(filtros).toMatchObject({ hoje: true, proximos: true, semResponsavel: true, semProfessor: true, atrasados: true });
    expect(Object.fromEntries(parametrosDosFiltros(filtros))).toEqual(url);
  });

  it("haFiltros vê os atalhos", () => {
    expect(haFiltros({ ...SEM_FILTROS, atrasados: true })).toBe(true);
    expect(haFiltros(SEM_FILTROS)).toBe(false);
  });
});

function porInicio(a: { inicio: Date }, b: { inicio: Date }) {
  return a.inicio.getTime() - b.inicio.getTime();
}
