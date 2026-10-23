import { describe, expect, it } from "vitest";
import type { NivelDeAcesso, Pessoa } from "./acesso";
import { lerEdicao, lerEvento, type EntradaDeEvento } from "./eventos";
import {
  CAMINHO_DOS_PROFESSORES,
  CAMINHO_DOS_PROFESSORES_NO_ADMIN,
  caminhoDosProfessores,
  eCampoDeAula,
  podeCadastrarProfessor,
  podeEditarSoAsObservacoes,
  podeInativarProfessor,
  podeVerEvento,
  professoresDaAula,
  semProfessor,
} from "./professores";

const pessoa = (id: string, nivel: NivelDeAcesso, ativo = true): Pessoa => ({ id, nivel, ativo });

const definicoes = [
  { id: "p", nome: "Professor", tipo: "pessoa" },
  { id: "a", nome: "Auxiliar", tipo: "pessoa" },
  { id: "r", nome: "Regente", tipo: "pessoa" },
  { id: "t", nome: "Professor", tipo: "texto_curto" },
];
const aula = (campos: Record<string, unknown>) => ({ campos, definicoes });

describe("quem está na aula", () => {
  it("só os campos pessoa Professor e Auxiliar contam", () => {
    expect(eCampoDeAula(definicoes[0])).toBe(true);
    expect(eCampoDeAula(definicoes[2])).toBe(false);
    expect(eCampoDeAula(definicoes[3])).toBe(false);
  });

  it("junta Professor e Auxiliar sem repetir, e ignora outros campos", () => {
    expect(professoresDaAula({ p: "bia", a: "caio", r: "dani", t: "x" }, definicoes)).toEqual(["bia", "caio"]);
    expect(professoresDaAula({ p: "bia", a: "bia" }, definicoes)).toEqual(["bia"]);
    expect(professoresDaAula({}, definicoes)).toEqual([]);
  });

  it("aula sem Professor: a vaga existe e está vazia, mesmo com Auxiliar", () => {
    expect(semProfessor({}, definicoes)).toBe(true);
    expect(semProfessor({ a: "caio" }, definicoes)).toBe(true);
    expect(semProfessor({ p: "bia" }, definicoes)).toBe(false);
  });

  it("Categoria sem a vaga de Professor nunca alerta", () => {
    expect(semProfessor({}, [{ id: "x", nome: "Quem prega", tipo: "texto_curto" }])).toBe(false);
  });
});

describe("cadastrar e inativar Professores", () => {
  it("o Admin e quem tem Função em Ensino cadastram", () => {
    expect(podeCadastrarProfessor(pessoa("lucas", "admin"), [])).toBe(true);
    expect(podeCadastrarProfessor(pessoa("ana", "lider"), ["Ensino"])).toBe(true);
    expect(podeCadastrarProfessor(pessoa("ana", "lider"), ["Louvor", "Ensino"])).toBe(true);
  });

  it("os demais não: Líder de outra Área, Professor, Pendente e desativados", () => {
    expect(podeCadastrarProfessor(pessoa("bia", "lider"), ["Louvor"])).toBe(false);
    expect(podeCadastrarProfessor(pessoa("bia", "lider"), [])).toBe(false);
    expect(podeCadastrarProfessor(pessoa("paulo", "professor"), ["Ensino"])).toBe(false);
    expect(podeCadastrarProfessor(pessoa("novo", "pendente"), ["Ensino"])).toBe(false);
    expect(podeCadastrarProfessor(pessoa("saiu", "admin", false), [])).toBe(false);
    expect(podeCadastrarProfessor(pessoa("saiu", "lider", false), ["Ensino"])).toBe(false);
  });

  it("só o Admin inativa um Professor, nunca o Líder de Ensino", () => {
    const paulo = pessoa("paulo", "professor");
    expect(podeInativarProfessor(pessoa("lucas", "admin"), paulo)).toBe(true);
    expect(podeInativarProfessor(pessoa("ana", "lider"), paulo)).toBe(false);
    expect(podeInativarProfessor(paulo, paulo)).toBe(false);
  });

  it("a regra vale para Professores: outras contas seguem podeMudarAcesso", () => {
    expect(podeInativarProfessor(pessoa("lucas", "admin"), pessoa("ana", "lider"))).toBe(false);
  });
});

describe("o que o Professor vê e edita", () => {
  const paulo = pessoa("paulo", "professor");
  const minha = aula({ p: "paulo" });
  const comoAuxiliar = aula({ p: "bia", a: "paulo" });
  const dosOutros = aula({ p: "bia" });

  it("vê as aulas em que é Professor ou Auxiliar, e só elas", () => {
    expect(podeVerEvento(paulo, minha)).toBe(true);
    expect(podeVerEvento(paulo, comoAuxiliar)).toBe(true);
    expect(podeVerEvento(paulo, dosOutros)).toBe(false);
    expect(podeVerEvento(paulo, aula({}))).toBe(false);
  });

  it("a Liderança vê todos os Eventos", () => {
    expect(podeVerEvento(pessoa("lucas", "admin"), dosOutros)).toBe(true);
    expect(podeVerEvento(pessoa("ana", "lider"), aula({}))).toBe(true);
  });

  it("Pendente e desativados não veem, mesmo colocados na aula", () => {
    expect(podeVerEvento(pessoa("paulo", "pendente"), minha)).toBe(false);
    expect(podeVerEvento(pessoa("paulo", "professor", false), minha)).toBe(false);
  });

  it("edita só as observações das aulas dele", () => {
    expect(podeEditarSoAsObservacoes(paulo, minha)).toBe(true);
    expect(podeEditarSoAsObservacoes(paulo, comoAuxiliar)).toBe(true);
    expect(podeEditarSoAsObservacoes(paulo, dosOutros)).toBe(false);
    expect(podeEditarSoAsObservacoes(pessoa("paulo", "professor", false), minha)).toBe(false);
  });

  it("a Liderança não usa a edição só de observações: ela segue podeEditarEvento", () => {
    expect(podeEditarSoAsObservacoes(pessoa("ana", "lider"), aula({ p: "ana" }))).toBe(false);
  });
});

describe("escolher Professor e Auxiliar na aula", () => {
  const ebd = {
    nome: "EBD",
    campos: [
      { id: "p", nome: "Professor", tipo: "pessoa" as const, obrigatorio: false, opcoes: [], ordem: 1 },
      { id: "a", nome: "Auxiliar", tipo: "pessoa" as const, obrigatorio: false, opcoes: [], ordem: 2 },
      { id: "r", nome: "Regente", tipo: "pessoa" as const, obrigatorio: false, opcoes: [], ordem: 3 },
    ],
  };
  const LIDERANCA = ["lucas", "carol"];
  const PROFESSORES = ["paulo", "bia"];
  const entrada = (campos: Record<string, string>): EntradaDeEvento => ({
    titulo: "EBD",
    data: "2026-10-25",
    hora: "09:00",
    dataFim: "",
    horaFim: "",
    local: "",
    responsavel: "lucas",
    status: "planejado",
    observacoes: "",
    link: "",
    campos,
  });
  const lido = (campos: Record<string, string>) => lerEvento(entrada(campos), ebd, LIDERANCA, PROFESSORES);

  it("Professor e Auxiliar vêm da tabela de Professores ou da Liderança", () => {
    expect(lido({ p: "paulo", a: "carol" })).toMatchObject({ evento: { campos: { p: "paulo", a: "carol" } } });
    expect(lido({ p: "lucas", a: "bia" })).toMatchObject({ evento: { campos: { p: "lucas", a: "bia" } } });
  });

  it("uma aula pode ficar sem Professor, e sair de Rascunho assim", () => {
    expect(lido({})).toMatchObject({ evento: { status: "planejado", campos: {} } });
  });

  it("recusa quem não está em nenhuma das duas listas", () => {
    expect(lido({ p: "estranho" })).toEqual({ erro: "Escolha um Professor ou alguém da Liderança em “Professor”." });
  });

  it("os outros campos pessoa seguem só com a Liderança", () => {
    expect(lido({ r: "paulo" })).toEqual({ erro: "Escolha uma pessoa da Liderança em “Regente”." });
  });

  it("sem a lista de Professores, só a Liderança serve", () => {
    expect(lerEvento(entrada({ p: "paulo" }), ebd, LIDERANCA)).toHaveProperty("erro");
  });

  it("na edição, um Professor já gravado e desativado pode ficar", () => {
    const gravado = lido({ p: "paulo" });
    if ("erro" in gravado) throw new Error(gravado.erro);
    const anterior = gravado.evento;
    const quem = { id: "lucas", nivel: "admin" as const, ativo: true };
    const edicao = lerEdicao(entrada({ p: "paulo" }), ebd, LIDERANCA, { anterior, quem, agora: new Date("2026-10-20T12:00:00Z") }, []);
    expect(edicao).toMatchObject({ evento: { campos: { p: "paulo" } } });
  });
});

describe("para onde leva o link de Professores", () => {
  it("o Admin fica dentro do Admin, com a barra lateral", () => {
    expect(caminhoDosProfessores(pessoa("a", "admin"))).toBe(CAMINHO_DOS_PROFESSORES_NO_ADMIN);
    expect(CAMINHO_DOS_PROFESSORES_NO_ADMIN).toBe("/admin/professores");
  });

  it("quem tem Função em Ensino, sem acesso ao Admin, continua fora dele", () => {
    expect(caminhoDosProfessores(pessoa("l", "lider"))).toBe(CAMINHO_DOS_PROFESSORES);
    expect(CAMINHO_DOS_PROFESSORES).toBe("/professores");
  });
});
