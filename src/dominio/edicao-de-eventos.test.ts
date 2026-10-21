import { describe, expect, it } from "vitest";
import type { Pessoa } from "./acesso";
import type { CampoCadastrado, CampoDaCategoria } from "./catalogo";
import {
  entradaDoEvento,
  fimDoEvento,
  lerEdicao,
  podeEditarEvento,
  podeExcluirEvento,
  podeMarcarRealizado,
  semResponsavel,
  statusDaEdicao,
  statusNoMomento,
  type EntradaDeEvento,
  type Evento,
  type Status,
} from "./eventos";

const pessoa = (id: string, nivel: Pessoa["nivel"] = "lider", ativo = true): Pessoa => ({ id, nivel, ativo });

const lucas = pessoa("lucas", "admin");
const mariana = pessoa("mariana");
const beythel = pessoa("beythel");
const carolLeal = pessoa("carol-leal");
const paulo = pessoa("paulo", "professor");
const novato = pessoa("novato", "pendente");

const AREAS: Record<string, string[]> = {
  lucas: [],
  mariana: ["Programação"],
  beythel: ["Louvor"],
  "carol-leal": ["Geral", "Louvor"],
  paulo: [],
  novato: [],
};

const culto = { area: "Programação" };

describe("quem edita e muda o Status", () => {
  const doCulto = (responsavel: string | null) => ({ categoria: culto, responsavel });

  it("o Admin, quem tem Função na Área da Categoria (inclusive Geral) e o Responsável", () => {
    expect(podeEditarEvento(lucas, AREAS.lucas, doCulto("beythel"))).toBe(true);
    expect(podeEditarEvento(mariana, AREAS.mariana, doCulto("beythel"))).toBe(true);
    expect(podeEditarEvento(carolLeal, AREAS["carol-leal"], doCulto("beythel"))).toBe(true);
    expect(podeEditarEvento(beythel, AREAS.beythel, doCulto("beythel"))).toBe(true);
  });

  it("os demais líderes só leem", () => {
    expect(podeEditarEvento(beythel, AREAS.beythel, doCulto("mariana"))).toBe(false);
    expect(podeEditarEvento(beythel, AREAS.beythel, doCulto(null))).toBe(false);
  });

  it("Professor, Pendente e desativados não editam, nem como Responsável", () => {
    expect(podeEditarEvento(paulo, [], doCulto("paulo"))).toBe(false);
    expect(podeEditarEvento(novato, [], doCulto("novato"))).toBe(false);
    expect(podeEditarEvento(pessoa("mariana", "lider", false), AREAS.mariana, doCulto("mariana"))).toBe(false);
    expect(podeEditarEvento(pessoa("lucas", "admin", false), [], doCulto("lucas"))).toBe(false);
  });
});

describe("quem exclui", () => {
  it("só o Admin ativo; os demais usam Cancelado", () => {
    expect(podeExcluirEvento(lucas)).toBe(true);
    expect(podeExcluirEvento(pessoa("lucas", "admin", false))).toBe(false);
    for (const quem of [mariana, carolLeal, paulo, novato]) expect(podeExcluirEvento(quem), quem.id).toBe(false);
  });
});

/** 24/10/2026 em Salvador (UTC-3). */
const as = (hora: string, dia = "2026-10-24") => new Date(`${dia}T${hora}:00-03:00`);

type Periodo = Pick<Evento, "inicio" | "fim" | "diaInteiro">;
const comHora: Periodo = { inicio: as("19:00"), fim: as("21:00"), diaInteiro: false };
const semFim: Periodo = { inicio: as("19:00"), fim: null, diaInteiro: false };
const diaInteiro: Periodo = { inicio: as("00:00"), fim: null, diaInteiro: true };
const variosDias: Periodo = { inicio: as("00:00"), fim: as("00:00", "2026-10-26"), diaInteiro: true };

describe("quando o Evento termina", () => {
  it("com fim, no horário de fim", () => {
    expect(fimDoEvento(comHora)).toEqual(as("21:00"));
  });

  it("sem fim, no dia seguinte", () => {
    expect(fimDoEvento(semFim)).toEqual(as("00:00", "2026-10-25"));
    expect(fimDoEvento(diaInteiro)).toEqual(as("00:00", "2026-10-25"));
  });

  it("de dia inteiro e vários dias, no dia seguinte ao último", () => {
    expect(fimDoEvento(variosDias)).toEqual(as("00:00", "2026-10-27"));
  });
});

describe("Realizado automático", () => {
  const confirmado = (periodo: Periodo) => ({ ...periodo, status: "confirmado" as Status });

  it("um Confirmado vira Realizado depois do horário de fim", () => {
    expect(statusNoMomento(confirmado(comHora), as("20:59"))).toBe("confirmado");
    expect(statusNoMomento(confirmado(comHora), as("21:00"))).toBe("realizado");
  });

  it("sem fim, vira Realizado no dia seguinte", () => {
    expect(statusNoMomento(confirmado(semFim), as("23:59"))).toBe("confirmado");
    expect(statusNoMomento(confirmado(semFim), as("00:00", "2026-10-25"))).toBe("realizado");
    expect(statusNoMomento(confirmado(diaInteiro), as("00:00", "2026-10-25"))).toBe("realizado");
  });

  it("Planejado, Rascunho e os demais vencidos ficam parados", () => {
    const depois = as("12:00", "2026-11-01");
    for (const status of ["rascunho", "planejado", "cancelado", "adiado", "realizado"] as const) {
      expect(statusNoMomento({ ...comHora, status }, depois), status).toBe(status);
    }
  });
});

describe("Realizado manual", () => {
  const doBeythel = { ...comHora, responsavel: "beythel" };

  it("o Admin e o Responsável marcam depois do fim", () => {
    expect(podeMarcarRealizado(lucas, doBeythel, as("21:00"))).toBe(true);
    expect(podeMarcarRealizado(beythel, doBeythel, as("21:00"))).toBe(true);
  });

  it("ninguém marca antes do fim", () => {
    expect(podeMarcarRealizado(lucas, doBeythel, as("20:59"))).toBe(false);
    expect(podeMarcarRealizado(beythel, doBeythel, as("20:59"))).toBe(false);
  });

  it("quem só tem Função na Área não marca", () => {
    expect(podeMarcarRealizado(mariana, doBeythel, as("22:00"))).toBe(false);
    expect(podeMarcarRealizado(carolLeal, doBeythel, as("22:00"))).toBe(false);
  });

  it("um Responsável desativado não marca", () => {
    expect(podeMarcarRealizado(pessoa("beythel", "lider", false), doBeythel, as("22:00"))).toBe(false);
  });

  it("o formulário só oferece Realizado a quem pode marcá-lo, ou se já é Realizado", () => {
    const comRealizado = (quem: Pessoa, status: Status, agora: Date) =>
      statusDaEdicao(quem, { ...doBeythel, status }, agora).includes("realizado");
    expect(statusDaEdicao(mariana, { ...doBeythel, status: "planejado" }, as("22:00"))).toEqual([
      "rascunho",
      "planejado",
      "confirmado",
      "cancelado",
      "adiado",
    ]);
    expect(comRealizado(beythel, "confirmado", as("22:00"))).toBe(true);
    expect(comRealizado(beythel, "confirmado", as("20:00"))).toBe(false);
    expect(comRealizado(mariana, "realizado", as("22:00"))).toBe(true);
  });
});

describe("Responsável desativado", () => {
  const ativo = { ativo: true };
  const desativado = { ativo: false };

  it("um Evento futuro com Responsável desativado conta como sem Responsável", () => {
    expect(semResponsavel({ ...comHora, responsavel: desativado }, as("10:00"))).toBe(true);
    expect(semResponsavel({ ...comHora, responsavel: ativo }, as("10:00"))).toBe(false);
    expect(semResponsavel({ ...comHora, responsavel: null }, as("10:00"))).toBe(true);
  });

  it("depois do fim, o Responsável fica para o histórico", () => {
    expect(semResponsavel({ ...comHora, responsavel: desativado }, as("21:00"))).toBe(false);
  });
});

const campo = (id: string, tipo: CampoDaCategoria["tipo"], obrigatorio = false): CampoCadastrado => ({
  id,
  nome: id,
  tipo,
  obrigatorio,
  opcoes: tipo === "escolha" ? ["Instagram", "YouTube"] : [],
});

const extra = {
  nome: "Evento extra",
  campos: [
    campo("valor", "valor"),
    campo("levar", "lista"),
    campo("quando", "data_hora"),
    campo("dia", "data"),
    campo("anfitriao", "pessoa"),
    campo("plataforma", "escolha"),
    campo("tarefas", "checklist"),
  ],
};

const LIDERANCA = ["lucas", "mariana", "beythel"];

const gravado = (mudancas: Partial<Evento> = {}): Evento => ({
  titulo: "Gincana",
  ...comHora,
  local: "Templo",
  responsavel: "mariana",
  status: "planejado",
  observacoes: "Levar som",
  link: "https://onda.app/gincana",
  campos: { valor: 3550, levar: ["Bíblia", "Garrafa"], quando: "2026-10-20T19:30", dia: "2026-10-22", plataforma: "YouTube" },
  ...mudancas,
});

const editar = (anterior: Evento, mudancas: Partial<EntradaDeEvento> = {}, quem = mariana, agora = as("10:00")) =>
  lerEdicao({ ...entradaDoEvento(anterior, extra), ...mudancas }, extra, LIDERANCA, { anterior, quem, agora });

const editado = (resultado: ReturnType<typeof lerEdicao>) => {
  if ("erro" in resultado) throw new Error(resultado.erro);
  return resultado.evento;
};
const erro = (resultado: ReturnType<typeof lerEdicao>) => ("erro" in resultado ? resultado.erro : null);

describe("editar", () => {
  it("o formulário começa com o Evento como está, e salvar sem mudar nada não muda nada", () => {
    for (const periodo of [comHora, semFim, diaInteiro, variosDias]) {
      const anterior = gravado(periodo);
      expect(editado(editar(anterior))).toEqual(anterior);
    }
  });

  it("o formulário mostra os valores como foram digitados", () => {
    expect(entradaDoEvento(gravado(), extra)).toMatchObject({
      data: "2026-10-24",
      hora: "19:00",
      dataFim: "2026-10-24",
      horaFim: "21:00",
      campos: { valor: "35,50", levar: "Bíblia\nGarrafa", quando: "2026-10-20T19:30", anfitriao: "" },
    });
    expect(entradaDoEvento(gravado(variosDias), extra)).toMatchObject({ hora: "", dataFim: "2026-10-26", horaFim: "" });
  });

  it("muda o que foi editado", () => {
    expect(editado(editar(gravado(), { titulo: "Gincana de primavera", hora: "18:00" }))).toMatchObject({
      titulo: "Gincana de primavera",
      inicio: as("18:00"),
    });
  });

  it("confere os campos como na criação", () => {
    expect(erro(editar(gravado(), { titulo: " " }))).toBe("Dê um título ao Evento.");
    expect(erro(editar(gravado(), { responsavel: "" }))).toBe("Escolha o Responsável, ou salve como Rascunho.");
    expect(erro(editar(gravado(), { responsavel: "paulo" }))).toBe("O Responsável precisa ser da Liderança.");
  });

  it("um Responsável desativado pode ficar, mas ninguém escolhe um novo desativado", () => {
    const anterior = gravado({ responsavel: "denize-saiu" });
    expect(editado(editar(anterior, { titulo: "Outro título" })).responsavel).toBe("denize-saiu");
    expect(erro(editar(gravado(), { responsavel: "denize-saiu" }))).toBe("O Responsável precisa ser da Liderança.");
  });

  it("uma pessoa desativada pode ficar num campo pessoa, mas não entra num campo novo", () => {
    const anterior = gravado({ campos: { anfitriao: "denize-saiu" } });
    expect(editado(editar(anterior)).campos.anfitriao).toBe("denize-saiu");
    const outro = gravado({ campos: {} });
    expect(erro(editar(outro, { campos: { anfitriao: "denize-saiu" } }))).toBe("Escolha uma pessoa da Liderança em “anfitriao”.");
  });

  it("o checklist, que o formulário ainda não mostra, fica como estava (ticket 12)", () => {
    const tarefas = [{ texto: "Comprar prêmios", feito: false }] as unknown as string[];
    expect(editado(editar(gravado({ campos: { tarefas } }))).campos.tarefas).toEqual(tarefas);
  });

  it("um campo que saiu da Categoria sai do Evento na edição", () => {
    expect(editado(editar(gravado({ campos: { removido: "x" } }))).campos).toEqual({});
  });
});

describe("mudar o Status na edição", () => {
  it("muda livremente entre Rascunho, Planejado, Confirmado, Cancelado e Adiado, sem ordem", () => {
    const todos = ["rascunho", "planejado", "confirmado", "cancelado", "adiado"] as const;
    for (const de of todos) {
      for (const para of todos) {
        expect(editado(editar(gravado({ status: de }), { status: para })).status, `${de} → ${para}`).toBe(para);
      }
    }
  });

  it("um Realizado pode voltar a outro Status", () => {
    expect(editado(editar(gravado({ status: "realizado" }), { status: "confirmado" })).status).toBe("confirmado");
  });

  it("Realizado manual só para o Admin e o Responsável, depois do fim", () => {
    const anterior = gravado({ status: "confirmado" });
    expect(editado(editar(anterior, { status: "realizado" }, mariana, as("21:00"))).status).toBe("realizado");
    expect(editado(editar(anterior, { status: "realizado" }, lucas, as("21:00"))).status).toBe("realizado");
    expect(erro(editar(anterior, { status: "realizado" }, mariana, as("20:00")))).toBe(
      "Só o Admin e o Responsável marcam Realizado, e só depois do fim.",
    );
    expect(erro(editar(gravado({ responsavel: "beythel" }), { status: "realizado" }, mariana, as("22:00")))).toBe(
      "Só o Admin e o Responsável marcam Realizado, e só depois do fim.",
    );
  });

  it("o fim que conta para o Realizado manual é o que fica gravado", () => {
    const anterior = gravado({ status: "confirmado" });
    expect(erro(editar(anterior, { status: "realizado", horaFim: "23:00" }, mariana, as("22:00")))).not.toBeNull();
  });

  it("quem se põe como Responsável não marca Realizado na mesma edição", () => {
    const anterior = gravado({ responsavel: "beythel", status: "planejado" });
    expect(erro(editar(anterior, { status: "realizado", responsavel: "mariana" }, mariana, as("22:00")))).not.toBeNull();
  });

  it("um Confirmado que terminou já é Realizado na edição, mesmo antes de o banco gravar a mudança", () => {
    const anterior = gravado({ status: "confirmado", responsavel: "beythel" });
    expect(editado(editar(anterior, { status: "realizado", observacoes: "Foi ótimo" }, mariana, as("22:00"))).status).toBe(
      "realizado",
    );
  });

  it("um Realizado não vai para depois de agora: só fica Realizado o que terminou", () => {
    const anterior = gravado({ status: "realizado" });
    expect(erro(editar(anterior, { data: "2026-11-07", dataFim: "2026-11-07" }, lucas, as("22:00")))).toBe(
      "Um Evento só fica Realizado depois do fim.",
    );
  });

  it("um Realizado continua Realizado numa edição de outro campo, por quem for", () => {
    const anterior = gravado({ status: "realizado", responsavel: "beythel" });
    expect(editado(editar(anterior, { observacoes: "Foi ótimo" }, mariana, as("22:00"))).status).toBe("realizado");
  });
});

describe("remarcar um Adiado", () => {
  const adiado = gravado({ status: "adiado" });

  it("mudar a data de um Adiado volta o Evento a Planejado", () => {
    expect(editado(editar(adiado, { data: "2026-11-07", dataFim: "2026-11-07" }))).toMatchObject({
      status: "planejado",
      inicio: as("19:00", "2026-11-07"),
    });
    expect(editado(editar(adiado, { horaFim: "22:00" })).status).toBe("planejado");
  });

  it("um Adiado editado sem mudar a data continua Adiado e mantém a data", () => {
    expect(editado(editar(adiado, { local: "Salão" }))).toMatchObject({ status: "adiado", inicio: as("19:00") });
  });

  it("quem escolhe outro Status ao remarcar fica com ele", () => {
    expect(editado(editar(adiado, { data: "2026-11-07", dataFim: "2026-11-07", status: "confirmado" })).status).toBe(
      "confirmado",
    );
  });
});
