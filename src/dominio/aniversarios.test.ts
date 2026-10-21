import { describe, expect, it } from "vitest";
import {
  aniversariantesDoMes,
  aniversariosPorDia,
  aniversariosVisiveis,
  pessoasDoAniversario,
  type Aniversariavel,
} from "./aniversarios";

const ana: Aniversariavel = { nome: "Ana", nascimento: "2010-10-21" };
const bia: Aniversariavel = { nome: "Bia", nascimento: "2011-10-05" };
const caio: Aniversariavel = { nome: "Caio", nascimento: "2012-11-01" };
const bisa: Aniversariavel = { nome: "Bisa", nascimento: "2008-02-29" };

describe("aniversariosPorDia", () => {
  it("põe cada pessoa no dia e mês do nascimento, no ano pedido, com só nome e dia", () => {
    const dias = ["2026-10-04", "2026-10-05", "2026-10-21"];
    expect(aniversariosPorDia([ana, bia, caio], dias)).toEqual({
      "2026-10-04": [],
      "2026-10-05": [{ nome: "Bia", dia: "2026-10-05" }],
      "2026-10-21": [{ nome: "Ana", dia: "2026-10-21" }],
    });
  });

  it("cobre grades que atravessam a virada de mês e de ano", () => {
    const natal: Aniversariavel = { nome: "Noel", nascimento: "2010-12-31" };
    const ano: Aniversariavel = { nome: "Novo", nascimento: "2010-01-01" };
    const porDia = aniversariosPorDia([natal, ano], ["2026-12-31", "2027-01-01"]);
    expect(porDia["2026-12-31"].map((a) => a.nome)).toEqual(["Noel"]);
    expect(porDia["2027-01-01"].map((a) => a.nome)).toEqual(["Novo"]);
  });

  it("quem nasceu em 29/02 comemora em 29/02 nos bissextos", () => {
    expect(aniversariosPorDia([bisa], ["2028-02-28", "2028-02-29"])).toEqual({
      "2028-02-28": [],
      "2028-02-29": [{ nome: "Bisa", dia: "2028-02-29" }],
    });
  });

  it("quem nasceu em 29/02 comemora em 28/02 nos anos não bissextos, sem sumir nem repetir", () => {
    expect(aniversariosPorDia([bisa], ["2027-02-28", "2027-03-01"])).toEqual({
      "2027-02-28": [{ nome: "Bisa", dia: "2027-02-28" }],
      "2027-03-01": [],
    });
  });

  it("ordena os do mesmo dia pelo nome", () => {
    const zeca = { nome: "Zeca", nascimento: "2009-10-21" };
    const agata = { nome: "Ágata", nascimento: "2010-10-21" };
    expect(aniversariosPorDia([zeca, ana, agata], ["2026-10-21"])["2026-10-21"].map((a) => a.nome)).toEqual([
      "Ágata",
      "Ana",
      "Zeca",
    ]);
  });

  it("não mostra o ano de nascimento nem a idade", () => {
    expect(Object.keys(aniversariosPorDia([ana], ["2026-10-21"])["2026-10-21"][0]).sort()).toEqual(["dia", "nome"]);
  });
});

describe("aniversariantesDoMes", () => {
  it("lista só quem faz anos no mês, por dia e depois por nome", () => {
    const alice: Aniversariavel = { nome: "Alice", nascimento: "2013-10-21" };
    expect(aniversariantesDoMes([caio, ana, bia, alice], "2026-10-15")).toEqual([
      { nome: "Bia", dia: "2026-10-05" },
      { nome: "Alice", dia: "2026-10-21" },
      { nome: "Ana", dia: "2026-10-21" },
    ]);
  });

  it("29/02 aparece em fevereiro, no 28 nos anos não bissextos", () => {
    expect(aniversariantesDoMes([bisa], "2027-02-10")).toEqual([{ nome: "Bisa", dia: "2027-02-28" }]);
    expect(aniversariantesDoMes([bisa], "2028-02-10")).toEqual([{ nome: "Bisa", dia: "2028-02-29" }]);
  });

  it("não lista ninguém quando ninguém faz anos", () => {
    expect(aniversariantesDoMes([caio], "2026-10-15")).toEqual([]);
  });
});

describe("pessoasDoAniversario", () => {
  const adolescentes = [
    { nome: "Ana", nascimento: "2010-10-21", ativo: true },
    { nome: "Inativo", nascimento: "2010-10-22", ativo: false },
  ];
  const lideres = [
    { nome: "Lia", nascimento: "1990-10-23", ativo: true },
    { nome: "Desativada", nascimento: "1990-10-24", ativo: false },
    { nome: "Sem data", nascimento: null, ativo: true },
  ];

  it("junta Adolescentes e líderes ativos; tira quem está inativo e quem não tem data", () => {
    expect(pessoasDoAniversario(adolescentes, lideres)).toEqual([
      { nome: "Ana", nascimento: "2010-10-21" },
      { nome: "Lia", nascimento: "1990-10-23" },
    ]);
  });
});

describe("aniversariosVisiveis", () => {
  const todos = [ana, bia];

  it("a Liderança ativa vê todos", () => {
    expect(aniversariosVisiveis({ id: "1", nivel: "admin", ativo: true }, todos)).toEqual(todos);
    expect(aniversariosVisiveis({ id: "1", nivel: "lider", ativo: true }, todos)).toEqual(todos);
  });

  it("Professor, Pendente e desativado não veem nenhum", () => {
    expect(aniversariosVisiveis({ id: "1", nivel: "professor", ativo: true }, todos)).toEqual([]);
    expect(aniversariosVisiveis({ id: "1", nivel: "pendente", ativo: true }, todos)).toEqual([]);
    expect(aniversariosVisiveis({ id: "1", nivel: "lider", ativo: false }, todos)).toEqual([]);
  });
});
