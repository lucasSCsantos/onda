import { describe, expect, it } from "vitest";
import type { Pessoa } from "./acesso";
import {
  CATALOGO_INICIAL,
  categoriasQuePodeCriar,
  erroNaCategoria,
  erroNaFuncao,
  erroNasFuncoes,
  erroNoCampo,
  erroNosCampos,
  podeCriarEvento,
  temFuncoes,
  TIPOS_DE_CAMPO,
  type TipoDeCampo,
} from "./catalogo";

const pessoa = (id: string, nivel: Pessoa["nivel"], ativo = true): Pessoa => ({ id, nivel, ativo });

/** Área de cada Função do catálogo inicial. */
const areaDa = (funcao: string) => {
  const encontrada = CATALOGO_INICIAL.funcoes.find((f) => f.nome === funcao);
  if (!encontrada) throw new Error(`Função desconhecida: ${funcao}`);
  return encontrada.area;
};

/** A Liderança de hoje com as Funções da spec. */
const lideranca = {
  lucas: { pessoa: pessoa("lucas", "admin"), funcoes: ["Líder do ministério", "Líder do ensino"] },
  carolLeal: { pessoa: pessoa("carol-leal", "lider"), funcoes: ["Co-líder do ministério", "Líder do louvor dos adolescentes"] },
  beythel: { pessoa: pessoa("beythel", "lider"), funcoes: ["Líder do louvor"] },
  carolFranca: { pessoa: pessoa("carol-franca", "lider"), funcoes: ["Líder de comunicação e mídia"] },
  mariana: { pessoa: pessoa("mariana", "lider"), funcoes: ["Líder de integração e programação"] },
  denize: { pessoa: pessoa("denize", "lider"), funcoes: ["Co-líder de integração e programação"] },
};

const podeCriar = (quem: { pessoa: Pessoa; funcoes: string[] }) =>
  categoriasQuePodeCriar(quem.pessoa, quem.funcoes.map(areaDa), CATALOGO_INICIAL.categorias).map((c) => c.nome);

const TODAS = [
  "EBD",
  "Pequeno grupo",
  "Culto",
  "Ensaio de louvor",
  "Reunião de liderança",
  "Postagem",
  "Evento extra",
  "Acampamento",
  "Serviço",
];

describe("quem pode criar Evento de qual Categoria", () => {
  it("Mariana e Denize criam Culto, Evento extra e Serviço", () => {
    expect(podeCriar(lideranca.mariana)).toEqual(["Culto", "Evento extra", "Serviço"]);
    expect(podeCriar(lideranca.denize)).toEqual(["Culto", "Evento extra", "Serviço"]);
  });

  it("Carol França cria só Postagem", () => {
    expect(podeCriar(lideranca.carolFranca)).toEqual(["Postagem"]);
  });

  it("Beythel cria só Ensaio de louvor", () => {
    expect(podeCriar(lideranca.beythel)).toEqual(["Ensaio de louvor"]);
  });

  it("uma Função Geral cria todas as Categorias, inclusive Reunião de liderança", () => {
    expect(podeCriar(lideranca.carolLeal)).toEqual(TODAS);
    expect(podeCriar(lideranca.lucas)).toEqual(TODAS);
  });

  it("com várias Funções, a pessoa cria a união das Categorias das Áreas delas", () => {
    const ensinoELouvor = { pessoa: pessoa("x", "lider"), funcoes: ["Líder do ensino", "Líder do louvor"] };
    expect(podeCriar(ensinoELouvor)).toEqual(["EBD", "Pequeno grupo", "Ensaio de louvor"]);
  });

  it("Reunião de liderança é só da Geral", () => {
    const reuniao = { area: "Geral" };
    for (const quem of [lideranca.beythel, lideranca.carolFranca, lideranca.mariana]) {
      expect(podeCriarEvento(quem.pessoa, quem.funcoes.map(areaDa), reuniao)).toBe(false);
    }
  });

  it("o Admin cria todas as Categorias, mesmo sem Função", () => {
    expect(podeCriar({ pessoa: pessoa("admin", "admin"), funcoes: [] })).toEqual(TODAS);
  });

  it("Professor, Pendente e quem foi desativado não criam nada, mesmo com Função", () => {
    expect(podeCriar({ pessoa: pessoa("p", "professor"), funcoes: ["Líder do ministério"] })).toEqual([]);
    expect(podeCriar({ pessoa: pessoa("n", "pendente"), funcoes: ["Líder do ministério"] })).toEqual([]);
    expect(podeCriar({ pessoa: pessoa("s", "lider", false), funcoes: ["Líder do ministério"] })).toEqual([]);
    expect(podeCriar({ pessoa: pessoa("s", "admin", false), funcoes: [] })).toEqual([]);
  });

  it("um Líder sem Função não cria nada", () => {
    expect(podeCriar({ pessoa: pessoa("l", "lider"), funcoes: [] })).toEqual([]);
  });
});

describe("erroNoCampo", () => {
  const campo = (nome: string, tipo: TipoDeCampo, opcoes: string[] = []) => ({ nome, tipo, obrigatorio: false, opcoes });

  it("os dez tipos existem na configuração", () => {
    expect(TIPOS_DE_CAMPO).toHaveLength(10);
    for (const tipo of TIPOS_DE_CAMPO.filter((t) => t !== "escolha")) {
      expect(erroNoCampo(campo("Qualquer", tipo))).toBeNull();
    }
  });

  it("um campo precisa de nome", () => {
    expect(erroNoCampo(campo("  ", "texto_curto"))).toBe("Dê um nome ao campo.");
  });

  it("uma escolha precisa de pelo menos uma opção, sem repetir", () => {
    expect(erroNoCampo(campo("Grupo", "escolha"))).toBe("Uma escolha precisa de pelo menos uma opção.");
    expect(erroNoCampo(campo("Grupo", "escolha", ["A", " "]))).toBe("Preencha todas as opções.");
    expect(erroNoCampo(campo("Grupo", "escolha", ["A", "a"]))).toBe("As opções não podem se repetir.");
    expect(erroNoCampo(campo("Grupo", "escolha", ["Grupo único"]))).toBeNull();
  });

  it("só a escolha tem opções", () => {
    expect(erroNoCampo(campo("Tema", "texto_curto", ["A"]))).toBe("Só o tipo escolha tem opções.");
  });

  it("o tipo precisa ser um dos dez", () => {
    expect(erroNoCampo(campo("Tema", "anexo" as TipoDeCampo))).toBe("Escolha um tipo de campo.");
  });
});

describe("erroNosCampos", () => {
  it("os nomes dos campos de uma Categoria não se repetem", () => {
    const tema = { nome: "Tema", tipo: "texto_curto" as const, obrigatorio: false, opcoes: [] };
    expect(erroNosCampos([tema, { ...tema, nome: "tema " }])).toBe("Já existe um campo chamado “tema”.");
  });

  it("os campos do catálogo inicial são válidos", () => {
    for (const categoria of CATALOGO_INICIAL.categorias) expect(erroNosCampos(categoria.campos)).toBeNull();
  });
});

describe("erroNaCategoria", () => {
  it("uma Categoria precisa de nome, Área e cor no formato #rrggbb", () => {
    expect(erroNaCategoria({ nome: "", area: "Ensino", cor: "#2f6fb5" })).toBe("Dê um nome à Categoria.");
    expect(erroNaCategoria({ nome: "Retiro", area: "", cor: "#2f6fb5" })).toBe("Escolha a Área da Categoria.");
    expect(erroNaCategoria({ nome: "Retiro", area: "Ensino", cor: "azul" })).toBe("Escolha uma cor válida.");
    expect(erroNaCategoria({ nome: "Retiro", area: "Ensino", cor: "#2F6FB5" })).toBeNull();
  });

  it("as cores do catálogo inicial são válidas e distintas", () => {
    const cores = CATALOGO_INICIAL.categorias.map((c) => c.cor);
    for (const categoria of CATALOGO_INICIAL.categorias) expect(erroNaCategoria(categoria)).toBeNull();
    expect(new Set(cores).size).toBe(cores.length);
  });
});

describe("erroNasFuncoes", () => {
  it("um Líder tem ao menos uma Função e pode ter várias", () => {
    expect(erroNasFuncoes("lider", [])).toBe("Um Líder precisa de uma Função.");
    expect(erroNasFuncoes("lider", ["ministerio", "ensino"])).toBeNull();
  });

  it("um Admin pode ter nenhuma ou várias Funções", () => {
    expect(erroNasFuncoes("admin", [])).toBeNull();
    expect(erroNasFuncoes("admin", ["ministerio", "ensino"])).toBeNull();
  });

  it("Professor e Pendente não têm Função", () => {
    expect(erroNasFuncoes("professor", ["ensino"])).toBe("Só a Liderança tem Funções.");
    expect(erroNasFuncoes("pendente", ["ensino"])).toBe("Só a Liderança tem Funções.");
    expect(erroNasFuncoes("professor", [])).toBeNull();
  });
});

describe("temFuncoes", () => {
  it("só a Liderança tem Funções", () => {
    expect(temFuncoes("admin")).toBe(true);
    expect(temFuncoes("lider")).toBe(true);
    expect(temFuncoes("professor")).toBe(false);
    expect(temFuncoes("pendente")).toBe(false);
  });
});

describe("erroNaFuncao", () => {
  it("uma Função precisa de nome e Área", () => {
    expect(erroNaFuncao({ nome: " ", area: "Louvor" })).toBe("Dê um nome à Função.");
    expect(erroNaFuncao({ nome: "Líder do som", area: "" })).toBe("Escolha a Área da Função.");
    expect(erroNaFuncao({ nome: "Líder do som", area: "Louvor" })).toBeNull();
  });
});

describe("Acampamento e Evento extra", () => {
  const categoria = (nome: string) => CATALOGO_INICIAL.categorias.find((c) => c.nome === nome)!;
  const campos = (nome: string) => categoria(nome).campos.map((c) => [c.nome, c.tipo]);

  it("o Acampamento tem os campos da spec, com o checklist; local e período vêm do Evento", () => {
    expect(campos("Acampamento")).toEqual([
      ["Tema", "texto_curto"],
      ["Valor", "valor"],
      ["Link de inscrição", "link"],
      ["Link da autorização dos pais", "link"],
      ["Itens a levar", "lista"],
      ["Checklist", "checklist"],
      ["Anotações", "texto_longo"],
      ["Link dos materiais", "link"],
    ]);
  });

  it("o Evento extra tem tipo, parceiro, valor, link de inscrição e o que levar", () => {
    expect(campos("Evento extra")).toEqual([
      ["Tipo", "escolha"],
      ["Parceiro", "texto_curto"],
      ["Valor", "valor"],
      ["Link de inscrição", "link"],
      ["O que levar", "lista"],
    ]);
    expect(categoria("Evento extra").campos[0].opcoes).toEqual(["Gincana", "Intercâmbio", "Campeonato", "Outro"]);
  });

  it("o checklist pode ser acrescentado a qualquer Categoria pela configuração", () => {
    for (const { campos: existentes } of CATALOGO_INICIAL.categorias) {
      const comChecklist = [...existentes, { nome: "Providências", tipo: "checklist" as const, obrigatorio: false, opcoes: [] }];
      expect(erroNosCampos(comChecklist)).toBeNull();
    }
  });
});
