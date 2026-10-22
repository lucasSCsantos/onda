import { describe, expect, it } from "vitest";
import {
  diasComEventos,
  enderecoDoNovoEvento,
  eventosPorDia,
  lerDataDoNovoEvento,
  lerPosicao,
  navegar,
  periodoDaVisao,
} from "./calendario";

describe("visão mensal", () => {
  it("cobre o mês em semanas inteiras de segunda a domingo", () => {
    // outubro de 2026 começa numa quinta e termina num sábado
    const { semanas } = periodoDaVisao("mes", "2026-10-21");

    expect(semanas).toHaveLength(5);
    expect(semanas[0][0]).toEqual({ dia: "2026-09-28", doPeriodo: false });
    expect(semanas[0][3]).toEqual({ dia: "2026-10-01", doPeriodo: true });
    expect(semanas.at(-1)!.at(-1)).toEqual({ dia: "2026-11-01", doPeriodo: false });
    expect(semanas.every((semana) => semana.length === 7)).toBe(true);
  });

  it("o período vai da meia-noite da primeira segunda à da segunda depois da grade, no fuso America/Bahia", () => {
    const { inicio, fim } = periodoDaVisao("mes", "2026-10-21");

    expect(inicio.toISOString()).toBe("2026-09-28T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-11-02T03:00:00.000Z");
  });
});

describe("visão semanal", () => {
  it("vai de segunda a domingo; o domingo é o último dia da sua semana", () => {
    const { semanas, inicio, fim } = periodoDaVisao("semana", "2026-11-01");

    expect(semanas).toHaveLength(1);
    expect(semanas[0].map((d) => d.dia)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(semanas[0].every((d) => d.doPeriodo)).toBe(true);
    expect(inicio.toISOString()).toBe("2026-10-26T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-11-02T03:00:00.000Z");
  });
});

describe("visão em lista", () => {
  it("mostra o mês, sem os dias de outros meses", () => {
    const { semanas, inicio, fim } = periodoDaVisao("lista", "2026-10-21");

    expect(semanas.flat().every((d) => d.doPeriodo)).toBe(true);
    expect(semanas.flat()).toHaveLength(31);
    expect(inicio.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });
});

describe("navegação", () => {
  it("o mês anterior e o seguinte partem do primeiro dia, mesmo do dia 31", () => {
    expect(navegar("mes", "2026-01-31", 1)).toBe("2026-02-01");
    expect(navegar("mes", "2026-01-31", -1)).toBe("2025-12-01");
    expect(navegar("lista", "2026-12-15", 1)).toBe("2027-01-01");
  });

  it("a semana anterior e a seguinte partem da segunda-feira", () => {
    expect(navegar("semana", "2026-11-01", 1)).toBe("2026-11-02");
    expect(navegar("semana", "2026-11-01", -1)).toBe("2026-10-19");
  });
});

describe("posição na URL", () => {
  // quarta-feira, 21/10/2026, 22h em Salvador (já é 22/10 em UTC)
  const agora = new Date("2026-10-21T22:00:00-03:00");

  it("sem nada, mostra hoje no fuso America/Bahia, e a visão fica em aberto (lista no celular)", () => {
    expect(lerPosicao({}, agora)).toEqual({ visao: null, dia: "2026-10-21" });
  });

  it("lê a visão e o dia", () => {
    expect(lerPosicao({ visao: "semana", dia: "2026-11-01" }, agora)).toEqual({ visao: "semana", dia: "2026-11-01" });
  });

  it("uma visão ou um dia que não existem voltam ao padrão", () => {
    expect(lerPosicao({ visao: "ano", dia: "2026-02-30" }, agora)).toEqual({ visao: null, dia: "2026-10-21" });
    expect(lerPosicao({ dia: "2026-02-32" }, agora)).toEqual({ visao: null, dia: "2026-10-21" });
    expect(lerPosicao({ visao: ["mes", "semana"], dia: "ontem" }, agora)).toEqual({ visao: null, dia: "2026-10-21" });
  });
});

describe("Novo Evento neste dia", () => {
  it("o endereço leva a data pela escolha da Categoria até o formulário", () => {
    expect(enderecoDoNovoEvento("2026-11-03")).toBe("/eventos/novo?data=2026-11-03");
    expect(enderecoDoNovoEvento("2026-11-03", "cat-1")).toBe("/eventos/novo/cat-1?data=2026-11-03");
    expect(lerDataDoNovoEvento({ data: "2026-11-03" })).toBe("2026-11-03");
  });

  it("sem data, a criação fica como sempre foi", () => {
    expect(enderecoDoNovoEvento(null)).toBe("/eventos/novo");
    expect(enderecoDoNovoEvento(null, "cat-1")).toBe("/eventos/novo/cat-1");
    expect(lerDataDoNovoEvento({})).toBeNull();
  });

  it("uma data inválida é ignorada", () => {
    expect(lerDataDoNovoEvento({ data: "2026-02-30" })).toBeNull();
    expect(lerDataDoNovoEvento({ data: "amanhã" })).toBeNull();
    expect(lerDataDoNovoEvento({ data: ["2026-11-03", "2026-11-04"] })).toBeNull();
  });
});

describe("Eventos nos dias da grade", () => {
  const evento = (id: string, inicio: string, fim: string | null = null, diaInteiro = false) => ({
    id,
    inicio: new Date(inicio),
    fim: fim ? new Date(fim) : null,
    diaInteiro,
  });
  const ids = (porDia: Record<string, { id: string }[]>) =>
    Object.fromEntries(Object.entries(porDia).map(([dia, eventos]) => [dia, eventos.map((e) => e.id)]));

  it("cada Evento fica no seu dia no fuso America/Bahia, com o dia inteiro no topo", () => {
    const porDia = eventosPorDia(
      [
        evento("culto", "2026-10-25T09:00:00-03:00"),
        evento("ensaio", "2026-10-24T22:30:00-03:00"), // já é 25/10 em UTC, mas ainda 24/10 em Salvador
        evento("postagem", "2026-10-25T00:00:00-03:00", null, true),
        evento("reuniao", "2026-10-25T07:00:00-03:00"),
      ],
      ["2026-10-24", "2026-10-25", "2026-10-26"],
    );

    expect(ids(porDia)).toEqual({
      "2026-10-24": ["ensaio"],
      "2026-10-25": ["postagem", "reuniao", "culto"],
      "2026-10-26": [],
    });
  });

  it("um Evento de vários dias aparece em cada dia do período, inclusive o último", () => {
    // acampamento de dia inteiro de sexta a domingo
    const porDia = eventosPorDia(
      [evento("acampamento", "2026-10-23T00:00:00-03:00", "2026-10-25T00:00:00-03:00", true)],
      ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"],
    );

    expect(ids(porDia)).toEqual({
      "2026-10-22": [],
      "2026-10-23": ["acampamento"],
      "2026-10-24": ["acampamento"],
      "2026-10-25": ["acampamento"],
      "2026-10-26": [],
    });
  });

  it("um Evento com hora que passa da meia-noite cobre os dois dias; um que acaba à meia-noite, só o primeiro", () => {
    const porDia = eventosPorDia(
      [
        evento("vigilia", "2026-10-24T22:00:00-03:00", "2026-10-25T02:00:00-03:00"),
        evento("festa", "2026-10-24T20:00:00-03:00", "2026-10-25T00:00:00-03:00"),
      ],
      ["2026-10-24", "2026-10-25"],
    );

    expect(ids(porDia)).toEqual({ "2026-10-24": ["festa", "vigilia"], "2026-10-25": ["vigilia"] });
  });

  it("um Evento que começou antes da grade aparece nos dias dela que ele cobre", () => {
    const porDia = eventosPorDia(
      [evento("retiro", "2026-09-26T00:00:00-03:00", "2026-09-29T00:00:00-03:00", true)],
      ["2026-09-28", "2026-09-29", "2026-09-30"],
    );

    expect(ids(porDia)).toEqual({ "2026-09-28": ["retiro"], "2026-09-29": ["retiro"], "2026-09-30": [] });
  });
});

describe("lista do período", () => {
  const evento = (id: string, inicio: string, fim: string | null = null, diaInteiro = false) => ({
    id,
    inicio: new Date(inicio),
    fim: fim ? new Date(fim) : null,
    diaInteiro,
  });

  it("só os dias do período que têm Evento, e um Evento que começou antes aparece nos dias dele dentro do período", () => {
    const dias = diasComEventos(
      [
        evento("retiro", "2026-09-30T00:00:00-03:00", "2026-10-02T00:00:00-03:00", true),
        evento("festa", "2026-09-30T20:00:00-03:00", "2026-10-01T00:00:00-03:00"), // acaba à meia-noite do dia 1º
        evento("culto", "2026-10-03T19:00:00-03:00"),
      ],
      ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"],
    );

    expect(dias.map((d) => [d.dia, d.eventos.map((e) => e.id)])).toEqual([
      ["2026-10-01", ["retiro"]],
      ["2026-10-02", ["retiro"]],
      ["2026-10-03", ["culto"]],
    ]);
  });
});

describe("diasComEventos com dias ocupados", () => {
  it("mantém dias sem Evento que têm outra coisa a mostrar, na ordem da grade", () => {
    const evento = { inicio: new Date("2026-10-20T10:00:00-03:00"), fim: null, diaInteiro: false };
    const dias = ["2026-10-19", "2026-10-20", "2026-10-21"];
    expect(diasComEventos([evento], dias, (dia) => dia === "2026-10-21")).toEqual([
      { dia: "2026-10-20", eventos: [evento] },
      { dia: "2026-10-21", eventos: [] },
    ]);
  });
});
