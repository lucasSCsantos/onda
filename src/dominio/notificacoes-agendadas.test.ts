import { describe, expect, it } from "vitest";
import {
  conteudoDaNotificacao,
  conteudoDoResumo,
  ehUrgente,
  lerPreferencias,
  notificacoesDevidas,
  aindaVale,
  recebe,
  tagDaNotificacao,
  tiposDoNivel,
  ultimoResumoSemanal,
  type EventoDoPlano,
  type NotificacaoDevida,
  type SituacaoDoEvento,
  type PessoaDoPlano,
} from "./notificacoes";

// Salvador é UTC-3 o ano todo. 24/10/2026 é sábado e 25/10/2026, domingo.
const salvador = (iso: string) => new Date(`${iso}-03:00`);

const evento = (parte: Partial<EventoDoPlano> = {}): EventoDoPlano => ({
  id: "ev-1",
  titulo: "Ensaio",
  numero: null,
  inicio: salvador("2026-10-24T19:00:00"),
  fim: salvador("2026-10-24T21:00:00"),
  diaInteiro: false,
  local: "Templo",
  categoria: "Ensaio de louvor",
  status: "planejado",
  responsavelId: "lider",
  professores: [],
  temChamada: false,
  chamadaFeita: false,
  ...parte,
});

const pessoa = (id: string, nivel: string, parte: Partial<PessoaDoPlano> = {}): PessoaDoPlano => ({ id, nivel, ativo: true, tiposDesligados: [], ...parte });
const pessoas = [pessoa("lider", "lider"), pessoa("admin", "admin"), pessoa("prof", "professor"), pessoa("aux", "professor")];

const devidas = (agora: Date, eventos: EventoDoPlano[], quem: PessoaDoPlano[] = pessoas, janelaDaChamadaDias = 1) =>
  notificacoesDevidas({ agora, eventos, pessoas: quem, janelaDaChamadaDias });

const tipos = (lista: NotificacaoDevida[]) => lista.map((d) => `${d.tipo}:${d.pessoaId}`).sort();

describe("quem recebe cada tipo", () => {
  it("a Liderança e o Professor recebem os avisos de Evento; o resumo e os alertas de gestão são só da Liderança", () => {
    expect(recebe("evento_alterado", "professor")).toBe(true);
    expect(recebe("chamada_pendente", "professor")).toBe(true);
    expect(recebe("lembrete_1d", "professor")).toBe(false);
    expect(recebe("resumo_semanal", "professor")).toBe(false);
    expect(recebe("resumo_semanal", "lider")).toBe(true);
    expect(recebe("sem_responsavel", "lider")).toBe(false);
    expect(recebe("sem_responsavel", "admin")).toBe(true);
    expect(recebe("evento_cancelado", "pendente")).toBe(false);
  });

  it("em Minha conta, cada pessoa só vê os tipos que pode receber", () => {
    expect(tiposDoNivel("professor")).toEqual(["designacao_aula", "evento_alterado", "evento_cancelado", "chamada_pendente"]);
    expect(tiposDoNivel("lider")).not.toContain("sem_responsavel");
    expect(tiposDoNivel("admin")).toContain("sem_responsavel");
  });

  it("desligar um tipo continua valendo para todos os tipos novos", () => {
    expect(lerPreferencias({ tiposLigados: ["designacao_aula"], inicio: "8", fim: "21", nivel: "admin" })).toMatchObject({
      tiposDesligados: expect.arrayContaining(["lembrete_1d", "lembrete_2h", "evento_alterado", "evento_cancelado", "resumo_semanal", "chamada_pendente", "sem_responsavel"]),
    });
  });
});

describe("urgência", () => {
  const agora = salvador("2026-10-24T08:00:00");

  it("é urgente quando o Evento ainda não começou e começa em menos do limite", () => {
    expect(ehUrgente(salvador("2026-10-24T19:59:00"), agora, 12)).toBe(true);
    expect(ehUrgente(salvador("2026-10-24T20:00:00"), agora, 12)).toBe(false);
    expect(ehUrgente(salvador("2026-10-24T20:01:00"), agora, 12)).toBe(false);
  });

  it("o limite é editável", () => {
    expect(ehUrgente(salvador("2026-10-24T20:01:00"), agora, 24)).toBe(true);
    expect(ehUrgente(salvador("2026-10-24T12:00:00"), agora, 2)).toBe(false);
  });

  it("um Evento que já começou não é urgente", () => {
    expect(ehUrgente(salvador("2026-10-24T07:00:00"), agora, 12)).toBe(false);
  });
});

describe("lembretes", () => {
  it("1 dia antes, só para o Responsável; antes disso, nada", () => {
    expect(devidas(salvador("2026-10-23T18:59:00"), [evento()])).toEqual([]);
    const l = devidas(salvador("2026-10-23T19:00:00"), [evento()]);
    expect(tipos(l)).toEqual(["lembrete_1d:lider"]);
    expect(l[0]).toMatchObject({ eventoId: "ev-1", janela: String(Math.floor(salvador("2026-10-24T19:00:00").getTime() / 60_000)) });
  });

  it("2 horas antes substitui o de 1 dia (o de 1 dia não é mais devido)", () => {
    const l = devidas(salvador("2026-10-24T17:00:00"), [evento()]);
    expect(tipos(l)).toEqual(["lembrete_2h:lider"]);
  });

  it("a validade evita entregar um lembrete atrasado: o de 1 dia vale até 2 h antes e o de 2 h até o início", () => {
    const [um] = devidas(salvador("2026-10-23T19:00:00"), [evento()]);
    expect(um.validaAte).toEqual(salvador("2026-10-24T17:00:00"));
    const [duas] = devidas(salvador("2026-10-24T17:30:00"), [evento()]);
    expect(duas.validaAte).toEqual(salvador("2026-10-24T19:00:00"));
  });

  it("os horários dos lembretes vêm da configuração do Admin", () => {
    const lembretes = { longoHoras: 48, curtoHoras: 4 };
    const dev = (agora: Date) => notificacoesDevidas({ agora, eventos: [evento()], pessoas, janelaDaChamadaDias: 1, lembretes });
    expect(dev(salvador("2026-10-22T18:59:00"))).toEqual([]);
    const [longo] = dev(salvador("2026-10-22T19:00:00"));
    expect(longo).toMatchObject({ tipo: "lembrete_1d", validaAte: salvador("2026-10-24T15:00:00") });
    expect(dev(salvador("2026-10-24T15:00:00")).map((d) => d.tipo)).toEqual(["lembrete_2h"]);
  });

  it("os dois lembretes de um Evento compartilham a tag, para o novo substituir o anterior", () => {
    expect(tagDaNotificacao("lembrete_1d", "ev-1")).toBe(tagDaNotificacao("lembrete_2h", "ev-1"));
    expect(tagDaNotificacao("lembrete_1d", "ev-1")).not.toBe(tagDaNotificacao("lembrete_1d", "ev-2"));
  });

  it("um Evento remarcado tem uma chave nova: a janela é o início", () => {
    const antes = devidas(salvador("2026-10-24T17:30:00"), [evento()])[0];
    const depois = devidas(salvador("2026-10-24T17:30:00"), [evento({ inicio: salvador("2026-10-24T19:30:00") })])[0];
    expect(depois.janela).not.toBe(antes.janela);
  });

  it("Evento de dia inteiro só tem o de 1 dia, e vale até começar", () => {
    const dia = evento({ diaInteiro: true, inicio: salvador("2026-10-24T00:00:00"), fim: null });
    expect(devidas(salvador("2026-10-23T12:00:00"), [dia])[0]).toMatchObject({ tipo: "lembrete_1d", validaAte: salvador("2026-10-24T00:00:00") });
    expect(devidas(salvador("2026-10-23T23:00:00"), [dia]).map((d) => d.tipo)).toEqual(["lembrete_1d"]);
  });

  it("só Eventos Planejados ou Confirmados, com Responsável ativo da Liderança que não desligou o tipo", () => {
    const agora = salvador("2026-10-24T17:30:00");
    for (const status of ["rascunho", "cancelado", "adiado", "realizado"] as const) expect(devidas(agora, [evento({ status })]), status).toEqual([]);
    expect(tipos(devidas(agora, [evento({ status: "confirmado" })]))).toEqual(["lembrete_2h:lider"]);
    expect(devidas(agora, [evento()], [pessoa("lider", "lider", { ativo: false })])).toEqual([]);
    expect(devidas(agora, [evento()], [pessoa("lider", "lider", { tiposDesligados: ["lembrete_2h"] })])).toEqual([]);
    // O Professor não recebe lembrete, mesmo sendo o Responsável gravado.
    expect(devidas(agora, [evento({ responsavelId: "prof" })])).toEqual([]);
  });

  it("um Evento que já começou não tem lembrete", () => {
    expect(devidas(salvador("2026-10-24T19:00:00"), [evento()])).toEqual([]);
  });
});

describe("Eventos sem Responsável", () => {
  const agora = salvador("2026-10-24T09:00:00");

  it("avisa só o Admin dos Eventos dos próximos 7 dias sem Responsável", () => {
    const l = devidas(agora, [evento({ responsavelId: null, status: "rascunho", inicio: salvador("2026-10-30T10:00:00"), fim: null })]);
    expect(tipos(l)).toEqual(["sem_responsavel:admin"]);
    expect(l[0]).toMatchObject({ eventoId: "ev-1", janela: "" });
  });

  it("não avisa de Evento além de 7 dias, Cancelado, Realizado ou Adiado, nem de Evento com Responsável ativo", () => {
    expect(devidas(agora, [evento({ responsavelId: null, inicio: salvador("2026-11-02T10:00:00") })])).toEqual([]);
    for (const status of ["cancelado", "realizado", "adiado"] as const) expect(devidas(agora, [evento({ responsavelId: null, status })]), status).toEqual([]);
    expect(devidas(agora, [evento({ status: "planejado", inicio: salvador("2026-10-28T10:00:00") })])).toEqual([]);
  });

  it("um Responsável com a conta desativada conta como sem Responsável", () => {
    const quem = [pessoa("lider", "lider", { ativo: false }), pessoa("admin", "admin")];
    expect(tipos(devidas(agora, [evento({ inicio: salvador("2026-10-28T10:00:00") })], quem))).toEqual(["sem_responsavel:admin"]);
  });
});

describe("Chamada pendente", () => {
  const aula = (parte: Partial<EventoDoPlano> = {}) =>
    evento({
      titulo: "Aula de EBD",
      categoria: "EBD",
      temChamada: true,
      professores: ["prof", "aux"],
      inicio: salvador("2026-10-24T09:00:00"),
      fim: salvador("2026-10-24T10:30:00"),
      ...parte,
    });

  it("avisa o Professor e o Auxiliar quando a aula já passou sem Chamada", () => {
    const l = devidas(salvador("2026-10-24T10:30:00"), [aula({ responsavelId: "lider" })]);
    expect(tipos(l.filter((d) => d.tipo === "chamada_pendente"))).toEqual(["chamada_pendente:aux", "chamada_pendente:prof"]);
  });

  it("antes de a aula acabar, nada; com a Chamada feita, nada", () => {
    expect(devidas(salvador("2026-10-24T10:00:00"), [aula()]).filter((d) => d.tipo === "chamada_pendente")).toEqual([]);
    expect(devidas(salvador("2026-10-24T12:00:00"), [aula({ chamadaFeita: true })])).toEqual([]);
  });

  it("só enquanto o cartão de Chamada está à vista: depois da janela, não cobra mais", () => {
    expect(tipos(devidas(salvador("2026-10-25T10:00:00"), [aula()]))).toContain("chamada_pendente:prof");
    expect(devidas(salvador("2026-10-26T10:00:00"), [aula()])).toEqual([]);
    expect(tipos(devidas(salvador("2026-10-26T10:00:00"), [aula()], pessoas, 2))).toContain("chamada_pendente:prof");
  });

  it("não cobra Chamada de aula Cancelada, Adiada ou Rascunho, nem de Categoria sem Chamada", () => {
    const agora = salvador("2026-10-24T12:00:00");
    for (const status of ["cancelado", "adiado", "rascunho"] as const) expect(devidas(agora, [aula({ status })]), status).toEqual([]);
    expect(devidas(agora, [aula({ temChamada: false })])).toEqual([]);
  });

  it("respeita a preferência de quem desligou o tipo", () => {
    const quem = [pessoa("prof", "professor", { tiposDesligados: ["chamada_pendente"] }), pessoa("aux", "professor")];
    expect(tipos(devidas(salvador("2026-10-24T12:00:00"), [aula()], quem))).toEqual(["chamada_pendente:aux"]);
  });

  it("o texto leva à Chamada e traz só o título de exibição e a data", () => {
    const c = conteudoDaNotificacao("chamada_pendente", { id: "ev-9", titulo: "Aula de EBD", numero: 3, inicio: salvador("2026-10-24T09:00:00"), diaInteiro: false, local: "Sala 2", categoria: "EBD" });
    expect(c).toEqual({ titulo: "Chamada pendente", texto: "Aula de EBD · 3 · sáb., 24/10 às 9h", tag: "chamada_pendente:ev-9", url: "/eventos/ev-9/chamada" });
  });
});

describe("resumo semanal", () => {
  it("a hora do resumo é o último domingo às 19h", () => {
    expect(ultimoResumoSemanal(salvador("2026-10-25T19:00:00"))).toEqual(salvador("2026-10-25T19:00:00"));
    expect(ultimoResumoSemanal(salvador("2026-10-25T18:59:00"))).toEqual(salvador("2026-10-18T19:00:00"));
    expect(ultimoResumoSemanal(salvador("2026-10-28T10:00:00"))).toEqual(salvador("2026-10-25T19:00:00"));
  });

  it("a hora do resumo vem da configuração do Admin", () => {
    expect(ultimoResumoSemanal(salvador("2026-10-25T08:00:00"), 8)).toEqual(salvador("2026-10-25T08:00:00"));
    expect(ultimoResumoSemanal(salvador("2026-10-25T07:59:00"), 8)).toEqual(salvador("2026-10-18T08:00:00"));
    const eventos = [evento({ inicio: salvador("2026-10-27T19:00:00"), fim: null })];
    const dev = (agora: Date) => notificacoesDevidas({ agora, eventos, pessoas, janelaDaChamadaDias: 1, horaDoResumo: 8 }).filter((d) => d.tipo === "resumo_semanal");
    expect(dev(salvador("2026-10-25T07:59:00"))).toEqual([]);
    expect(tipos(dev(salvador("2026-10-25T08:00:00")))).toEqual(["resumo_semanal:lider"]);
  });

  const semana = [
    evento({ id: "a", titulo: "Ensaio", inicio: salvador("2026-10-27T19:00:00"), fim: null }),
    evento({ id: "b", titulo: "Culto", inicio: salvador("2026-10-31T19:00:00"), fim: null, responsavelId: "admin" }),
    evento({ id: "c", titulo: "Muito depois", inicio: salvador("2026-11-03T19:00:00"), fim: null }),
    evento({ id: "d", titulo: "Cancelado", inicio: salvador("2026-10-28T19:00:00"), fim: null, status: "cancelado" }),
  ];

  it("domingo às 19h, cada pessoa da Liderança recebe os Eventos da semana seguinte que são dela", () => {
    const l = devidas(salvador("2026-10-25T19:00:00"), semana).filter((d) => d.tipo === "resumo_semanal");
    expect(tipos(l)).toEqual(["resumo_semanal:admin", "resumo_semanal:lider"]);
    const lider = l.find((d) => d.pessoaId === "lider")!;
    expect(lider).toMatchObject({ eventoId: null, janela: "2026-10-25", validaAte: salvador("2026-10-26T19:00:00") });
    expect(lider.conteudo).toEqual({ titulo: "Seus Eventos da semana", texto: "1 Evento: Ensaio (ter., 27/10 às 19h)", tag: "resumo_semanal:2026-10-25", url: "/" });
  });

  it("antes das 19h do domingo, nada; no meio da semana, nada; na segunda de manhã ainda é devido", () => {
    expect(devidas(salvador("2026-10-25T18:59:00"), semana).filter((d) => d.tipo === "resumo_semanal")).toEqual([]);
    expect(devidas(salvador("2026-10-28T12:00:00"), semana).filter((d) => d.tipo === "resumo_semanal")).toEqual([]);
    expect(devidas(salvador("2026-10-26T08:00:00"), semana).filter((d) => d.tipo === "resumo_semanal")).toHaveLength(2);
  });

  it("o Professor não recebe o resumo; quem não tem Evento na semana não recebe um resumo vazio", () => {
    const l = devidas(salvador("2026-10-25T19:00:00"), [evento({ professores: ["prof"], inicio: salvador("2026-10-27T10:00:00") })]);
    expect(tipos(l)).toEqual(["resumo_semanal:lider"]);
    expect(devidas(salvador("2026-10-25T19:00:00"), [])).toEqual([]);
  });

  it("o texto mostra os dois primeiros e quantos mais, no limite de 160 caracteres", () => {
    const eventos = ["a", "b", "c", "d"].map((id, i) => ({ id, titulo: `Evento ${id}`, numero: null, inicio: salvador(`2026-10-2${6 + i}T19:00:00`), diaInteiro: false, local: "", categoria: "" }));
    const c = conteudoDoResumo(eventos, "2026-10-25");
    expect(c.texto).toBe("4 Eventos: Evento a (seg., 26/10 às 19h); Evento b (ter., 27/10 às 19h) e mais 2");
    expect(conteudoDoResumo([{ ...eventos[0], titulo: "x".repeat(300) }], "2026-10-25").texto.length).toBeLessThanOrEqual(160);
  });
});

describe("mudança e cancelamento: texto", () => {
  const e = { id: "ev-1", titulo: "Ensaio", numero: 2, inicio: salvador("2026-10-24T19:00:00"), diaInteiro: false, local: "Templo", categoria: "Ensaio de louvor" };

  it("diz o que houve no título e traz o Evento como está agora", () => {
    expect(conteudoDaNotificacao("evento_alterado", e)).toEqual({ titulo: "Evento alterado", texto: "Ensaio · 2 · sáb., 24/10 às 19h · Templo", tag: "mudanca:ev-1", url: "/eventos/ev-1" });
    expect(conteudoDaNotificacao("evento_cancelado", e).titulo).toBe("Evento cancelado");
  });

  it("o cancelamento substitui o aviso de mudança na tela (mesma tag)", () => {
    expect(conteudoDaNotificacao("evento_cancelado", e).tag).toBe(conteudoDaNotificacao("evento_alterado", e).tag);
  });

  it("nenhum modelo traz dados de Adolescentes nem local do Pequeno grupo", () => {
    const pg = { ...e, categoria: "Pequeno grupo", local: "Casa da Ana, Rua X", observacoes: "Falar com a mãe do João" } as typeof e;
    for (const tipo of ["lembrete_1d", "lembrete_2h", "evento_alterado", "evento_cancelado", "sem_responsavel", "chamada_pendente"] as const) {
      const c = JSON.stringify(conteudoDaNotificacao(tipo, pg));
      expect(c, tipo).not.toContain("Ana");
      expect(c, tipo).not.toContain("João");
    }
  });
});

describe("o motivo do aviso ainda vale na hora do envio", () => {
  const agora = salvador("2026-10-24T12:00:00");
  const situacao = (parte: Partial<SituacaoDoEvento> = {}): SituacaoDoEvento => ({
    status: "planejado",
    inicio: salvador("2026-10-24T19:00:00"),
    responsavelAtivo: true,
    chamadaFeita: false,
    ...parte,
  });

  it("lembrete e mudança de um Evento cancelado ou já começado não saem", () => {
    expect(aindaVale("lembrete_2h", situacao(), agora)).toBe(true);
    expect(aindaVale("lembrete_2h", situacao({ status: "cancelado" }), agora)).toBe(false);
    expect(aindaVale("lembrete_1d", situacao({ status: "adiado" }), agora)).toBe(false);
    expect(aindaVale("lembrete_1d", situacao({ inicio: salvador("2026-10-24T11:00:00") }), agora)).toBe(false);
    expect(aindaVale("evento_alterado", situacao({ status: "cancelado" }), agora)).toBe(false);
  });

  it("o cancelamento só sai se o Evento segue cancelado", () => {
    expect(aindaVale("evento_cancelado", situacao({ status: "cancelado" }), agora)).toBe(true);
    expect(aindaVale("evento_cancelado", situacao({ status: "planejado" }), agora)).toBe(false);
  });

  it("sem Responsável deixa de valer quando alguém é posto; a Chamada pendente, quando é feita", () => {
    expect(aindaVale("sem_responsavel", situacao({ responsavelAtivo: false }), agora)).toBe(true);
    expect(aindaVale("sem_responsavel", situacao(), agora)).toBe(false);
    expect(aindaVale("chamada_pendente", situacao(), agora)).toBe(true);
    expect(aindaVale("chamada_pendente", situacao({ chamadaFeita: true }), agora)).toBe(false);
  });

  it("a designação vale sempre", () => {
    expect(aindaVale("designacao_aula", situacao({ status: "cancelado" }), agora)).toBe(true);
  });
});
