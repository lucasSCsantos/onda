import { describe, expect, it } from "vitest";
import {
  buscarPorNome,
  erroNoAdolescente,
  ordenarPorProximoAniversario,
  proximoAniversario,
} from "./adolescentes";

// quarta-feira, 21/10/2026, 22h em Salvador (já é dia 22 em UTC)
const agora = new Date("2026-10-21T22:00:00-03:00");

describe("proximoAniversario", () => {
  it("é este ano se o dia ainda não passou", () => {
    expect(proximoAniversario("2010-12-25", agora)).toEqual({ data: "2026-12-25", dias: 65, idade: 16 });
  });

  it("é no ano que vem se o dia já passou", () => {
    expect(proximoAniversario("2010-03-02", agora)).toEqual({ data: "2027-03-02", dias: 132, idade: 17 });
  });

  it("hoje é hoje, no fuso do Mural, e não amanhã em UTC", () => {
    expect(proximoAniversario("2010-10-21", agora)).toEqual({ data: "2026-10-21", dias: 0, idade: 16 });
  });

  it("o dia seguinte em UTC ainda é amanhã no fuso do Mural", () => {
    expect(proximoAniversario("2010-10-22", agora)).toEqual({ data: "2026-10-22", dias: 1, idade: 16 });
  });

  it("29/02 cai em 28/02 nos anos não bissextos", () => {
    expect(proximoAniversario("2008-02-29", agora)).toEqual({ data: "2027-02-28", dias: 130, idade: 19 });
  });

  it("29/02 cai em 29/02 no ano bissexto", () => {
    const antes = new Date("2027-12-01T12:00:00-03:00");
    expect(proximoAniversario("2008-02-29", antes)).toEqual({ data: "2028-02-29", dias: 90, idade: 20 });
  });

  it("29/02 em ano bissexto, na própria data, é hoje", () => {
    const dia = new Date("2028-02-29T09:00:00-03:00");
    expect(proximoAniversario("2008-02-29", dia)).toEqual({ data: "2028-02-29", dias: 0, idade: 20 });
  });

  it("virada de ano", () => {
    const fim = new Date("2026-12-31T10:00:00-03:00");
    expect(proximoAniversario("2010-01-01", fim)).toEqual({ data: "2027-01-01", dias: 1, idade: 17 });
  });
});

describe("ordenarPorProximoAniversario", () => {
  it("põe o mais próximo primeiro, desempata pelo nome e não muda a lista original", () => {
    const lista = [
      { nome: "Bia", nascimento: "2010-03-02" },
      { nome: "Caio", nascimento: "2011-10-21" },
      { nome: "Ana", nascimento: "2012-12-25" },
      { nome: "Abel", nascimento: "2009-12-25" },
      { nome: "Dani", nascimento: "2008-02-29" },
    ];
    const copia = [...lista];
    expect(ordenarPorProximoAniversario(lista, agora).map((a) => a.nome)).toEqual(["Caio", "Abel", "Ana", "Dani", "Bia"]);
    expect(lista).toEqual(copia);
  });
});

describe("buscarPorNome", () => {
  const lista = [{ nome: "João Pedro" }, { nome: "Maria Clara" }, { nome: "joana" }];

  it("ignora maiúsculas e acentos", () => {
    expect(buscarPorNome(lista, "JOAO").map((a) => a.nome)).toEqual(["João Pedro"]);
    expect(buscarPorNome(lista, "joan").map((a) => a.nome)).toEqual(["joana"]);
    expect(buscarPorNome(lista, "clará").map((a) => a.nome)).toEqual(["Maria Clara"]);
  });

  it("sem texto devolve todos", () => {
    expect(buscarPorNome(lista, "  ")).toHaveLength(3);
  });
});

describe("erroNoAdolescente", () => {
  it("aceita nome e data de nascimento válidos", () => {
    expect(erroNoAdolescente({ nome: "Ana", nascimento: "2010-05-10" }, agora)).toBeNull();
  });

  it("exige o nome", () => {
    expect(erroNoAdolescente({ nome: "  ", nascimento: "2010-05-10" }, agora)).toMatch(/nome/i);
  });

  it("recusa data de nascimento inexistente, futura ou em branco", () => {
    expect(erroNoAdolescente({ nome: "Ana", nascimento: "2011-02-29" }, agora)).toMatch(/nascimento/i);
    expect(erroNoAdolescente({ nome: "Ana", nascimento: "2026-10-22" }, agora)).toMatch(/nascimento/i);
    expect(erroNoAdolescente({ nome: "Ana", nascimento: "" }, agora)).toMatch(/nascimento/i);
  });
});
