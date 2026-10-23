import { describe, expect, it } from "vitest";
import {
  alertasDeAusencia,
  alternarMarcacao,
  estevePresente,
  faltasSeguidas,
  historicoDoAdolescente,
  lerMarcacao,
  podeFazerChamada,
  resumoDaAula,
  type AulaComChamada,
  type Marcacao,
} from "./presenca";

const marcacao = (id: string, mudancas: Partial<Marcacao> = {}): Marcacao => ({
  id,
  nome: id,
  icone: "check",
  pontos: 1,
  ativa: true,
  contaPresenca: false,
  pedeVisitante: false,
  ordem: 0,
  ...mudancas,
});

const PRESENTE = marcacao("presente", { contaPresenca: true, ordem: 0 });
const BIBLIA = marcacao("biblia", { ordem: 1 });
const VISITANTE = marcacao("visitante", { pedeVisitante: true, pontos: 3, ordem: 2 });
const ATIVIDADE = marcacao("atividade", { pontos: 2, ordem: 3 });
const MARCACOES = [PRESENTE, BIBLIA, VISITANTE, ATIVIDADE];

// domingo, 25/10/2026, 11h em Salvador
const agora = new Date("2026-10-25T11:00:00-03:00");

describe("alternarMarcacao", () => {
  it("marcar qualquer uma marca também a presença, na ordem do cadastro", () => {
    expect(alternarMarcacao([], "biblia", MARCACOES)).toEqual(["presente", "biblia"]);
    expect(alternarMarcacao(["presente"], "atividade", MARCACOES)).toEqual(["presente", "atividade"]);
  });

  it("desmarcar uma tira só ela; desmarcar a presença tira todas", () => {
    expect(alternarMarcacao(["presente", "biblia", "atividade"], "biblia", MARCACOES)).toEqual(["presente", "atividade"]);
    expect(alternarMarcacao(["presente", "biblia"], "presente", MARCACOES)).toEqual([]);
  });

  it("sem Marcação de presença ativa, só alterna a tocada", () => {
    const semPresenca = [{ ...PRESENTE, ativa: false }, BIBLIA];
    expect(alternarMarcacao([], "biblia", semPresenca)).toEqual(["biblia"]);
  });
});

describe("estevePresente", () => {
  it("vale a Marcação de presença; sem uma, qualquer Marcação", () => {
    expect(estevePresente(["presente"], MARCACOES)).toBe(true);
    expect(estevePresente([], MARCACOES)).toBe(false);
    expect(estevePresente(["biblia"], [BIBLIA])).toBe(true);
  });
});

describe("podeFazerChamada", () => {
  const aula = (mudancas: Record<string, unknown> = {}) => ({
    categoria: { area: "Ensino", temChamada: true },
    status: "confirmado" as const,
    inicio: new Date("2026-10-25T09:00:00-03:00"),
    professores: [] as string[],
    ...mudancas,
  });
  const lider = { id: "l", nivel: "lider" as const, ativo: true };
  const admin = { id: "a", nivel: "admin" as const, ativo: true };

  it("o Admin e quem tem Função na Área, a partir do dia da aula", () => {
    expect(podeFazerChamada(admin, [], aula(), agora)).toBe(true);
    expect(podeFazerChamada(lider, ["Ensino"], aula(), agora)).toBe(true);
    expect(podeFazerChamada(lider, ["Geral"], aula(), agora)).toBe(true);
    expect(podeFazerChamada(lider, ["Louvor"], aula(), agora)).toBe(false);
    expect(podeFazerChamada({ ...admin, ativo: false }, [], aula(), agora)).toBe(false);
    expect(podeFazerChamada({ id: "p", nivel: "professor", ativo: true }, [], aula(), agora)).toBe(false);
  });

  it("o Professor e o Auxiliar daquela aula, mesmo sem Função na Área, e só dela", () => {
    const professor = { id: "p", nivel: "professor" as const, ativo: true };
    expect(podeFazerChamada(professor, [], aula({ professores: ["p"] }), agora)).toBe(true);
    expect(podeFazerChamada(professor, [], aula({ professores: ["outro", "p"] }), agora)).toBe(true);
    expect(podeFazerChamada(professor, [], aula({ professores: ["outro"] }), agora)).toBe(false);
    expect(podeFazerChamada({ ...professor, ativo: false }, [], aula({ professores: ["p"] }), agora)).toBe(false);
    expect(podeFazerChamada({ ...professor, nivel: "pendente" }, [], aula({ professores: ["p"] }), agora)).toBe(false);
    // Líder de outra Área escolhido como Professor também faz a Chamada da aula dele.
    expect(podeFazerChamada(lider, ["Louvor"], aula({ professores: ["l"] }), agora)).toBe(true);
  });

  it("o Professor segue as mesmas regras de dia, Cancelada e Categoria sem chamada", () => {
    const professor = { id: "p", nivel: "professor" as const, ativo: true };
    const dele = { professores: ["p"] };
    expect(podeFazerChamada(professor, [], aula({ ...dele, inicio: new Date("2026-10-26T09:00:00-03:00") }), agora)).toBe(false);
    expect(podeFazerChamada(professor, [], aula({ ...dele, status: "cancelado" }), agora)).toBe(false);
    expect(podeFazerChamada(professor, [], aula({ ...dele, categoria: { area: "Ensino", temChamada: false } }), agora)).toBe(false);
  });

  it("nem aula futura, nem Cancelada, nem Categoria sem chamada", () => {
    // Mais tarde no mesmo dia ainda vale; no dia seguinte, não.
    expect(podeFazerChamada(admin, [], aula({ inicio: new Date("2026-10-25T20:00:00-03:00") }), agora)).toBe(true);
    expect(podeFazerChamada(admin, [], aula({ inicio: new Date("2026-10-26T09:00:00-03:00") }), agora)).toBe(false);
    expect(podeFazerChamada(admin, [], aula({ status: "cancelado" }), agora)).toBe(false);
    expect(podeFazerChamada(admin, [], aula({ categoria: { area: "Ensino", temChamada: false } }), agora)).toBe(false);
  });
});

describe("resumoDaAula", () => {
  it("conta presentes, cada Marcação e os visitantes anotados", () => {
    const resumo = resumoDaAula(
      [
        { adolescente: "a", marcacoes: ["presente", "biblia", "visitante"], visitante: "Rafa" },
        { adolescente: "b", marcacoes: ["presente", "atividade"], visitante: null },
        { adolescente: "c", marcacoes: [], visitante: null },
      ],
      MARCACOES,
      10,
    );
    expect(resumo.presentes).toBe(2);
    expect(resumo.ativos).toBe(10);
    expect(resumo.porMarcacao.map((p) => [p.marcacao.id, p.quantos])).toEqual([
      ["presente", 2],
      ["biblia", 1],
      ["visitante", 1],
      ["atividade", 1],
    ]);
    expect(resumo.visitantes).toEqual(["Rafa"]);
  });

  it("uma Marcação desativada só aparece se foi usada na aula", () => {
    const resumo = resumoDaAula([{ adolescente: "a", marcacoes: ["presente"], visitante: null }], [PRESENTE, { ...BIBLIA, ativa: false }], 1);
    expect(resumo.porMarcacao.map((p) => p.marcacao.id)).toEqual(["presente"]);
  });
});

describe("ausências", () => {
  const domingo = (dia: number): AulaComChamada => ({ id: `d${dia}`, titulo: `EBD ${dia}`, inicio: new Date(`2026-10-${String(dia).padStart(2, "0")}T09:00:00-03:00`) });
  const aulas = [domingo(4), domingo(11), domingo(18), domingo(25)];
  const desde = new Date("2026-01-01T00:00:00-03:00");

  it("conta as faltas seguidas a partir da aula mais recente", () => {
    expect(faltasSeguidas(aulas, new Set(["d4"]), desde)).toBe(3);
    expect(faltasSeguidas(aulas, new Set(["d25"]), desde)).toBe(0);
    expect(faltasSeguidas(aulas, new Set(), desde)).toBe(4);
  });

  it("aulas de antes do cadastro não contam como falta", () => {
    expect(faltasSeguidas(aulas, new Set(), new Date("2026-10-15T10:00:00-03:00"))).toBe(2);
  });

  it("alerta quem está ativo e chegou ao limite, de quem falta há mais tempo para quem falta há menos", () => {
    const adolescentes = [
      { id: "ana", nome: "Ana", ativo: true, criadoEm: desde },
      { id: "bia", nome: "Bia", ativo: true, criadoEm: desde },
      { id: "caio", nome: "Caio", ativo: false, criadoEm: desde },
      { id: "davi", nome: "Davi", ativo: true, criadoEm: desde },
    ];
    const presencas = new Map([
      ["ana", new Set(["d4"])],
      ["davi", new Set(["d25"])],
    ]);
    const alertas = alertasDeAusencia(adolescentes, aulas, presencas, 3);
    expect(alertas.map((a) => [a.adolescente.nome, a.faltas])).toEqual([
      ["Bia", 4],
      ["Ana", 3],
    ]);
    expect(alertas[1].ultimaPresenca).toEqual(domingo(4).inicio);
    expect(alertas[0].ultimaPresenca).toBeNull();
  });

  it("o histórico mostra cada aula desde o cadastro, com as Marcações ou a falta", () => {
    const historico = historicoDoAdolescente(aulas, new Map([["d18", ["presente", "biblia"]]]), new Date("2026-10-15T00:00:00-03:00"), MARCACOES);
    expect(historico.map((h) => [h.aula.id, h.presente, h.marcacoes.map((m) => m.id)])).toEqual([
      ["d25", false, []],
      ["d18", true, ["presente", "biblia"]],
    ]);
  });
});

describe("cadastro de Marcações", () => {
  const entrada = { nome: " Cantou ", icone: "music", pontos: "2", ativa: "on", contaPresenca: "", pedeVisitante: "" };

  it("lê nome, ícone, pontos e as opções", () => {
    expect(lerMarcacao(entrada)).toEqual({ nome: "Cantou", icone: "music", pontos: 2, ativa: true, contaPresenca: false, pedeVisitante: false });
  });

  it("recusa nome vazio, ícone fora da lista e pontos inválidos", () => {
    expect(lerMarcacao({ ...entrada, nome: "  " })).toHaveProperty("erro");
    expect(lerMarcacao({ ...entrada, icone: "foguete" })).toHaveProperty("erro");
    for (const pontos of ["", "-1", "101", "1.5", "dois"]) expect(lerMarcacao({ ...entrada, pontos }), pontos).toHaveProperty("erro");
  });
});
