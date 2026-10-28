import { describe, expect, it } from "vitest";
import {
  buscarPorNome,
  erroNoAdolescente,
  lerFiltroDeGenero,
  listarAdolescentes,
  ordenarPorProximoAniversario,
  prazoDoAniversario,
  proximoAniversario,
  totaisPorGenero,
  type Adolescente,
  type FiltroDeGenero,
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

describe("prazoDoAniversario", () => {
  it("diz hoje, amanhã ou em N dias", () => {
    expect(prazoDoAniversario(0)).toBe("hoje");
    expect(prazoDoAniversario(1)).toBe("amanhã");
    expect(prazoDoAniversario(65)).toBe("em 65 dias");
  });
});

describe("listarAdolescentes", () => {
  const lista: Adolescente[] = [
    { id: "1", nome: "Bia", nascimento: "2010-03-02", ativo: true, genero: "feminino" },
    { id: "2", nome: "Caio", nascimento: "2011-10-21", ativo: true, genero: null },
    { id: "3", nome: "Ana", nascimento: "2012-12-25", ativo: false, genero: "feminino" },
  ];
  const nomes = (l: Adolescente[]) => l.map((a) => a.nome);

  it("esconde os inativos, ordena pelo próximo aniversário e conta os inativos", () => {
    const { adolescentes, inativos } = listarAdolescentes(lista, { busca: "", ordem: "aniversario", comInativos: false, genero: null }, agora);
    expect(nomes(adolescentes)).toEqual(["Caio", "Bia"]);
    expect(inativos).toBe(1);
  });

  it("mostra os inativos quando pedido, e ordena por nome", () => {
    const { adolescentes } = listarAdolescentes(lista, { busca: "", ordem: "nome", comInativos: true, genero: null }, agora);
    expect(nomes(adolescentes)).toEqual(["Ana", "Bia", "Caio"]);
  });

  it("a busca vale só entre os que aparecem", () => {
    expect(nomes(listarAdolescentes(lista, { busca: "ana", ordem: "nome", comInativos: false, genero: null }, agora).adolescentes)).toEqual([]);
    expect(nomes(listarAdolescentes(lista, { busca: "ana", ordem: "nome", comInativos: true, genero: null }, agora).adolescentes)).toEqual(["Ana"]);
  });
});

describe("listarAdolescentes: Gênero", () => {
  const todos: Adolescente[] = [
    { id: "1", nome: "Bia", nascimento: "2010-03-02", ativo: true, genero: "feminino" },
    { id: "2", nome: "Caio", nascimento: "2011-10-21", ativo: true, genero: null },
    { id: "3", nome: "Ana", nascimento: "2012-12-25", ativo: false, genero: "feminino" },
    { id: "4", nome: "Davi", nascimento: "2010-01-01", ativo: true, genero: "masculino" },
    { id: "5", nome: "Edu", nascimento: "2010-02-02", ativo: true, genero: "masculino" },
  ];
  const base = { busca: "", ordem: "nome", comInativos: false } as const;
  const nomes = (genero: FiltroDeGenero, comInativos = false) =>
    listarAdolescentes(todos, { ...base, comInativos, genero }, agora).adolescentes.map((a) => a.nome);

  it("filtra por Masculino, Feminino e sem gênero informado", () => {
    expect(nomes("masculino")).toEqual(["Davi", "Edu"]);
    expect(nomes("feminino")).toEqual(["Bia"]);
    expect(nomes("sem")).toEqual(["Caio"]);
  });

  it("os totais contam só os ativos e não mudam com o filtro de Gênero", () => {
    const esperado = { masculino: 2, feminino: 1, naoInformado: 1 };
    for (const genero of [null, "masculino", "sem"] as const) {
      expect(listarAdolescentes(todos, { ...base, genero }, agora).totais).toEqual(esperado);
    }
    expect(listarAdolescentes(todos, { ...base, genero: "feminino", comInativos: true }, agora).totais).toEqual(esperado);
  });
});

describe("totaisPorGenero", () => {
  it("lista vazia zera tudo", () => {
    expect(totaisPorGenero([])).toEqual({ masculino: 0, feminino: 0, naoInformado: 0 });
  });
});

describe("lerFiltroDeGenero", () => {
  it("aceita os dois Gêneros e 'sem'; o resto é sem filtro", () => {
    expect(lerFiltroDeGenero("masculino")).toBe("masculino");
    expect(lerFiltroDeGenero("feminino")).toBe("feminino");
    expect(lerFiltroDeGenero("sem")).toBe("sem");
    expect(lerFiltroDeGenero("")).toBeNull();
    expect(lerFiltroDeGenero("x")).toBeNull();
  });
});

describe("erroNoAdolescente: Gênero", () => {
  const dados = { nome: "Ana", nascimento: "2010-05-10" };
  it("cadastro novo exige o Gênero", () => {
    expect(erroNoAdolescente({ ...dados, genero: "" }, agora, true)).toBe("Escolha o Gênero.");
    expect(erroNoAdolescente(dados, agora, true)).toBe("Escolha o Gênero.");
    expect(erroNoAdolescente({ ...dados, genero: "feminino" }, agora, true)).toBeNull();
  });

  it("registro antigo segue editável sem Gênero, mas um valor inválido é recusado", () => {
    expect(erroNoAdolescente(dados, agora)).toBeNull();
    expect(erroNoAdolescente({ ...dados, genero: "" }, agora)).toBeNull();
    expect(erroNoAdolescente({ ...dados, genero: "x" }, agora)).toBe("Escolha o Gênero.");
  });
});
