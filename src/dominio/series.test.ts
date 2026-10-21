import { describe, expect, it } from "vitest";
import type { Pessoa } from "./acesso";
import {
  cancelarFuturas,
  descreverRegra,
  lerSerie,
  editarSerie,
  encerrarSerie,
  escoposDeEdicao,
  expandirSerie,
  lerDiaDeEncerramento,
  lerRegra,
  resumoDosCancelamentos,
  ocorrenciasDe,
  type EntradaDeRegra,
  type OcorrenciaGravada,
} from "./series";
import { diaDe, type Evento } from "./eventos";
import { meiaNoite } from "./fuso";

const entrada = (mudancas: Partial<EntradaDeRegra> = {}): EntradaDeRegra => ({
  frequencia: "semanal",
  dias: [],
  posicao: "",
  diaDaSemana: "",
  terminoPor: "contagem",
  terminoData: "",
  terminoOcorrencias: "4",
  ...mudancas,
});

const DOMINGO = "0";
const QUARTA = "3";

/** Lê a regra e expande, ou falha o teste. */
function datas(mudancas: Partial<EntradaDeRegra>, primeiroDia: string): string[] {
  const regra = lerRegra(entrada(mudancas), primeiroDia);
  if ("erro" in regra) throw new Error(regra.erro);
  const lidas = expandirSerie(regra.regra, primeiroDia);
  if ("erro" in lidas) throw new Error(lidas.erro);
  return lidas.datas;
}

describe("expandir Séries", () => {
  it("semanal: os dias escolhidos de cada semana, a partir do primeiro dia", () => {
    // 2026-10-21 é quarta-feira.
    expect(datas({ dias: [DOMINGO, QUARTA], terminoOcorrencias: "5" }, "2026-10-21")).toEqual([
      "2026-10-21",
      "2026-10-25",
      "2026-10-28",
      "2026-11-01",
      "2026-11-04",
    ]);
  });

  it("sem dias escolhidos, repete no dia da semana do primeiro dia", () => {
    expect(datas({}, "2026-10-25")).toEqual(["2026-10-25", "2026-11-01", "2026-11-08", "2026-11-15"]);
  });

  it("quinzenal: pula uma semana, contando a partir da semana do primeiro dia", () => {
    expect(datas({ frequencia: "quinzenal", dias: [QUARTA, DOMINGO], terminoOcorrencias: "5" }, "2026-10-21")).toEqual([
      "2026-10-21",
      "2026-11-01",
      "2026-11-04",
      "2026-11-15",
      "2026-11-18",
    ]);
  });

  it("termina por data, inclusive nela", () => {
    expect(datas({ terminoPor: "data", terminoData: "2026-11-08" }, "2026-10-25")).toEqual([
      "2026-10-25",
      "2026-11-01",
      "2026-11-08",
    ]);
  });

  it("mensal: o N-ésimo dia da semana de cada mês", () => {
    expect(datas({ frequencia: "mensal", posicao: "1", diaDaSemana: DOMINGO, terminoOcorrencias: "4" }, "2026-10-01")).toEqual([
      "2026-10-04",
      "2026-11-01",
      "2026-12-06",
      "2027-01-03",
    ]);
  });

  it("mensal: o primeiro dia já passou no mês, então começa no mês seguinte", () => {
    expect(datas({ frequencia: "mensal", posicao: "1", diaDaSemana: DOMINGO, terminoOcorrencias: "2" }, "2026-10-05")).toEqual([
      "2026-11-01",
      "2026-12-06",
    ]);
  });

  it("mensal: o último dia da semana do mês, inclusive com cinco no mês", () => {
    // Outubro de 2026 tem cinco sextas (2, 9, 16, 23, 30); fevereiro de 2027 termina num domingo, dia 28.
    expect(datas({ frequencia: "mensal", posicao: "ultimo", diaDaSemana: "5", terminoOcorrencias: "2" }, "2026-10-01")).toEqual([
      "2026-10-30",
      "2026-11-27",
    ]);
    expect(datas({ frequencia: "mensal", posicao: "ultimo", diaDaSemana: DOMINGO, terminoOcorrencias: "1" }, "2027-02-01")).toEqual([
      "2027-02-28",
    ]);
  });

  it("mensal: o quarto dia da semana não confunde com o último", () => {
    expect(datas({ frequencia: "mensal", posicao: "4", diaDaSemana: "5", terminoOcorrencias: "1" }, "2026-10-01")).toEqual([
      "2026-10-23",
    ]);
  });

  it("recusa regra incompleta ou impossível", () => {
    const erro = (e: Partial<EntradaDeRegra>, dia = "2026-10-21") => {
      const lida = lerRegra(entrada(e), dia);
      return "erro" in lida ? lida.erro : null;
    };
    expect(erro({ frequencia: "diaria" })).toMatch(/frequência/i);
    expect(erro({ dias: ["7"] })).toMatch(/dia da semana/i);
    expect(erro({ frequencia: "mensal", posicao: "", diaDaSemana: DOMINGO })).toMatch(/posição/i);
    expect(erro({ frequencia: "mensal", posicao: "1", diaDaSemana: "" })).toMatch(/dia da semana/i);
    expect(erro({ terminoOcorrencias: "0" })).toMatch(/Ocorrências/);
    expect(erro({ terminoOcorrencias: "" })).toMatch(/Ocorrências/);
    expect(erro({ terminoPor: "data", terminoData: "" })).toMatch(/data/i);
    expect(erro({ terminoPor: "data", terminoData: "2026-10-01" })).toMatch(/antes/i);
    expect(erro({ terminoPor: "nunca" })).toMatch(/término/i);
  });

  it("não gera Séries sem fim prático", () => {
    const regra = lerRegra(entrada({ terminoPor: "data", terminoData: "2040-12-31" }), "2026-10-25");
    if ("erro" in regra) throw new Error(regra.erro);
    expect(expandirSerie(regra.regra, "2026-10-25")).toEqual({ erro: expect.stringMatching(/Ocorrências/) });
  });
});

const evento = (mudancas: Partial<Evento> = {}): Evento => ({
  titulo: "EBD",
  inicio: new Date("2026-10-25T12:00:00Z"), // 09:00 em Salvador
  fim: new Date("2026-10-25T13:30:00Z"),
  diaInteiro: false,
  local: "Sala 1",
  responsavel: "mariana",
  status: "planejado",
  observacoes: "",
  link: null,
  campos: {},
  ...mudancas,
});

describe("Ocorrências de uma Série", () => {
  it("cada uma leva o horário do modelo no seu dia", () => {
    const todas = ocorrenciasDe(evento(), ["2026-10-25", "2026-11-01"]);
    expect(todas.map((o) => o.inicio.toISOString())).toEqual(["2026-10-25T12:00:00.000Z", "2026-11-01T12:00:00.000Z"]);
    expect(todas[1].fim?.toISOString()).toBe("2026-11-01T13:30:00.000Z");
  });

  it("um Evento de vários dias mantém a duração em dias", () => {
    const modelo = evento({
      diaInteiro: true,
      inicio: meiaNoite(2026, 10, 30),
      fim: meiaNoite(2026, 11, 1),
    });
    const [, segunda] = ocorrenciasDe(modelo, ["2026-10-30", "2026-12-04"]);
    expect(diaDe(segunda.inicio)).toBe("2026-12-04");
    expect(diaDe(segunda.fim!)).toBe("2026-12-06");
  });
});

const AGORA = new Date("2026-11-10T12:00:00Z");
const dia = (d: string) => new Date(`${d}T12:00:00Z`);

/** Quatro domingos: 25/10 e 01/11 já passaram; 15/11 e 22/11, não. Os ids são os números 1 a 4 em ordem. */
function serie(extras: Record<string, Partial<OcorrenciaGravada>> = {}): OcorrenciaGravada[] {
  return ["2026-10-25", "2026-11-01", "2026-11-15", "2026-11-22"].map((d, i) => ({
    id: String(i + 1),
    editada: false,
    evento: evento({
      inicio: dia(d),
      fim: new Date(dia(d).getTime() + 90 * 60 * 1000),
      status: i < 2 ? "realizado" : "planejado",
    }),
    ...extras[String(i + 1)],
  }));
}

const lucas: Pessoa = { id: "lucas", nivel: "admin", ativo: true };
const mariana: Pessoa = { id: "mariana", nivel: "lider", ativo: true };

function editar(
  ocorrencias: OcorrenciaGravada[],
  alvoId: string,
  escopo: "esta" | "esta_e_seguintes" | "toda",
  mudancas: Partial<Evento>,
  quem: Pessoa = mariana,
) {
  const alvo = ocorrencias.find((o) => o.id === alvoId)!;
  return editarSerie({ ocorrencias, alvo: alvoId, escopo, anterior: alvo.evento, novo: { ...alvo.evento, ...mudancas }, quem, agora: AGORA });
}

const ok = (r: ReturnType<typeof editarSerie>) => {
  if ("erro" in r) throw new Error(r.erro);
  return r.alteracoes;
};

describe("editar só esta", () => {
  it("altera só a Ocorrência e a marca como editada", () => {
    const alteracoes = ok(editar(serie(), "3", "esta", { local: "Quadra", responsavel: "beythel" }));
    expect(alteracoes).toHaveLength(1);
    expect(alteracoes[0]).toMatchObject({ id: "3", editada: true, evento: { local: "Quadra", responsavel: "beythel" } });
  });

  it("mudar só o Status não conta como edição", () => {
    const [alteracao] = ok(editar(serie(), "3", "esta", { status: "confirmado" }));
    expect(alteracao.editada).toBeUndefined();
    expect(alteracao.evento.status).toBe("confirmado");
  });

  it("cancelar uma data não mexe nas outras", () => {
    expect(ok(editar(serie(), "3", "esta", { status: "cancelado" })).map((a) => a.id)).toEqual(["3"]);
  });

  it("a Ocorrência pode mudar de data e horário sem sair da Série", () => {
    const [alteracao] = ok(editar(serie(), "3", "esta", { inicio: dia("2026-11-16"), fim: null }));
    expect(diaDe(alteracao.evento.inicio)).toBe("2026-11-16");
  });

  it("uma Realizada ou Cancelada só é editada, individualmente, pelo Admin", () => {
    expect(editar(serie(), "1", "esta", { observacoes: "Faltou som" }, mariana)).toMatchObject({ erro: expect.any(String) });
    expect(ok(editar(serie(), "1", "esta", { observacoes: "Faltou som" }, lucas))[0].id).toBe("1");
  });
});

describe("editar esta e as seguintes", () => {
  it("altera as Ocorrências daqui em diante, sem as anteriores", () => {
    const alteracoes = ok(editar(serie(), "3", "esta_e_seguintes", { local: "Quadra" }));
    expect(alteracoes.map((a) => a.id)).toEqual(["3", "4"]);
    expect(alteracoes.every((a) => a.evento.local === "Quadra")).toBe(true);
  });

  it("não sobrescreve Ocorrência editada individualmente", () => {
    const alteracoes = ok(editar(serie({ "4": { editada: true } }), "3", "esta_e_seguintes", { local: "Quadra" }));
    expect(alteracoes.map((a) => a.id)).toEqual(["3"]);
  });

  it("não mexe em Realizadas nem Canceladas, mesmo daqui em diante", () => {
    const ocorrencias = serie();
    ocorrencias[3].evento.status = "cancelado";
    expect(ok(editar(ocorrencias, "3", "esta_e_seguintes", { local: "Quadra" })).map((a) => a.id)).toEqual(["3"]);
  });

  it("as Ocorrências afetadas continuam sem a marca de editada", () => {
    const alteracoes = ok(editar(serie(), "3", "esta_e_seguintes", { local: "Quadra" }));
    expect(alteracoes.map((a) => a.editada)).toEqual([undefined, undefined]);
  });

  it("leva só o que mudou: cada Ocorrência guarda o resto", () => {
    const ocorrencias = serie({ "4": { evento: evento({ inicio: dia("2026-11-22"), fim: null, local: "Pátio" }) } });
    const alteracoes = ok(editar(ocorrencias, "3", "esta_e_seguintes", { titulo: "EBD de Natal" }));
    const quarta = alteracoes.find((a) => a.id === "4")!.evento;
    expect(quarta).toMatchObject({ titulo: "EBD de Natal", local: "Pátio", fim: null });
  });

  it("o horário novo vale no dia de cada Ocorrência", () => {
    const novoInicio = new Date("2026-11-15T23:00:00Z"); // 20:00 em Salvador
    const alteracoes = ok(editar(serie(), "3", "esta_e_seguintes", { inicio: novoInicio, fim: null }));
    expect(alteracoes.map((a) => a.evento.inicio.toISOString())).toEqual(["2026-11-15T23:00:00.000Z", "2026-11-22T23:00:00.000Z"]);
    expect(alteracoes.every((a) => a.evento.fim === null)).toBe(true);
  });

  it("a Ocorrência escolhida leva o Status do formulário; as demais, o delas", () => {
    const alteracoes = ok(editar(serie(), "3", "esta_e_seguintes", { local: "Quadra", status: "confirmado" }));
    expect(alteracoes.map((a) => a.evento.status)).toEqual(["confirmado", "planejado"]);
  });

  it("um campo específico mudado vale para todas; os demais ficam", () => {
    const ocorrencias = serie({ "4": { evento: evento({ inicio: dia("2026-11-22"), campos: { a: "x", b: "y" } }) } });
    ocorrencias[2].evento.campos = { a: "x", b: "y" };
    const alteracoes = ok(editar(ocorrencias, "3", "esta_e_seguintes", { campos: { a: "z", b: "y" } }));
    expect(alteracoes.map((a) => a.evento.campos)).toEqual([{ a: "z", b: "y" }, { a: "z", b: "y" }]);
  });

  it("recusa mudar a data: é só esta", () => {
    expect(editar(serie(), "3", "esta_e_seguintes", { inicio: dia("2026-11-16") })).toMatchObject({ erro: expect.stringMatching(/só esta/i) });
  });

  it("recusa quando a escolhida está congelada", () => {
    expect(editar(serie(), "1", "toda", { local: "Quadra" }, lucas)).toMatchObject({ erro: expect.any(String) });
  });
});

describe("editar toda a série", () => {
  it("altera todas as que ainda podem mudar, antes ou depois", () => {
    const alteracoes = ok(editar(serie({ "4": { editada: true } }), "3", "toda", { local: "Quadra" }));
    expect(alteracoes.map((a) => a.id)).toEqual(["3"]);
    const todas = ok(editar(serie(), "3", "toda", { local: "Quadra" }));
    expect(todas.map((a) => a.id)).toEqual(["3", "4"]);
  });

  it("alcança as anteriores que ainda estão abertas", () => {
    const ocorrencias = serie();
    ocorrencias[0].evento.status = "planejado";
    ocorrencias[0].evento.inicio = dia("2026-11-30");
    expect(ok(editar(ocorrencias, "3", "toda", { local: "Quadra" })).map((a) => a.id).sort()).toEqual(["1", "3", "4"]);
  });

  it("um Confirmado que já terminou conta como Realizado e fica congelado", () => {
    const ocorrencias = serie();
    ocorrencias[1].evento.status = "confirmado";
    expect(ok(editar(ocorrencias, "3", "toda", { local: "Quadra" })).map((a) => a.id)).toEqual(["3", "4"]);
  });
});

describe("quem escolhe o escopo", () => {
  it("quem edita a Categoria escolhe qualquer escopo; o Responsável, só esta", () => {
    expect(escoposDeEdicao(true)).toEqual(["esta", "esta_e_seguintes", "toda"]);
    expect(escoposDeEdicao(false)).toEqual(["esta"]);
  });
});

describe("encerrar a Série e cancelar as futuras", () => {
  it("encerrar cancela as depois do fim, e só as abertas", () => {
    const ocorrencias = serie();
    const alteracoes = encerrarSerie(ocorrencias, "2026-11-15", AGORA);
    expect(alteracoes.map((a) => [a.id, a.evento.status])).toEqual([["4", "cancelado"]]);
  });

  it("o dia final continua valendo", () => {
    expect(encerrarSerie(serie(), "2026-11-22", AGORA)).toEqual([]);
  });

  it("cancelar as futuras deixa as passadas e as que já terminaram", () => {
    const alteracoes = cancelarFuturas(serie(), AGORA);
    expect(alteracoes.map((a) => a.id)).toEqual(["3", "4"]);
    expect(alteracoes.every((a) => a.evento.status === "cancelado" && a.editada === undefined)).toBe(true);
  });

  it("não cancela de novo as já Canceladas", () => {
    const ocorrencias = serie();
    ocorrencias[2].evento.status = "cancelado";
    expect(cancelarFuturas(ocorrencias, AGORA).map((a) => a.id)).toEqual(["4"]);
  });
});

describe("lerSerie", () => {
  it("gera as Ocorrências a partir da data do Evento modelo, no horário dele", () => {
    const lida = lerSerie(evento(), entrada({ terminoOcorrencias: "3" }));
    if ("erro" in lida) throw new Error(lida.erro);
    expect(lida.primeiroDia).toBe("2026-10-25");
    expect(lida.ocorrencias.map((o) => diaDe(o.inicio))).toEqual(["2026-10-25", "2026-11-01", "2026-11-08"]);
    expect(lida.ocorrencias.every((o) => o.fim && o.fim.getTime() - o.inicio.getTime() === 90 * 60 * 1000)).toBe(true);
  });

  it("devolve o erro da regra", () => {
    expect(lerSerie(evento(), entrada({ frequencia: "" }))).toMatchObject({ erro: expect.stringMatching(/frequência/i) });
  });
});

describe("descrever a regra", () => {
  const regra = (mudancas: Partial<EntradaDeRegra>, dia = "2026-10-25") => {
    const lida = lerRegra(entrada(mudancas), dia);
    if ("erro" in lida) throw new Error(lida.erro);
    return descreverRegra(lida.regra);
  };

  it("em português", () => {
    expect(regra({ dias: [DOMINGO, QUARTA], terminoOcorrencias: "8" })).toBe("Toda semana, domingos e quartas, por 8 Ocorrências");
    expect(regra({ frequencia: "quinzenal", terminoPor: "data", terminoData: "2026-12-20" })).toBe(
      "A cada duas semanas, domingos, até 20/12/2026",
    );
    expect(regra({ frequencia: "mensal", posicao: "ultimo", diaDaSemana: "5" })).toBe("Todo mês, última sexta, por 4 Ocorrências");
  });
});

describe("encerramento", () => {
  it("o último dia precisa existir e não vir antes da primeira Ocorrência", () => {
    expect(lerDiaDeEncerramento("2026-11-15", serie())).toEqual({ dia: "2026-11-15" });
    expect(lerDiaDeEncerramento("2026-02-31", serie())).toMatchObject({ erro: expect.any(String) });
    expect(lerDiaDeEncerramento("", serie())).toMatchObject({ erro: expect.any(String) });
    expect(lerDiaDeEncerramento("2026-10-01", serie())).toMatchObject({ erro: expect.stringMatching(/antes/) });
  });

  it("resume os cancelamentos no singular e no plural", () => {
    expect(resumoDosCancelamentos(0)).toBe("Nenhuma Ocorrência foi cancelada.");
    expect(resumoDosCancelamentos(1)).toBe("1 Ocorrência cancelada.");
    expect(resumoDosCancelamentos(3)).toBe("3 Ocorrências canceladas.");
  });
});
