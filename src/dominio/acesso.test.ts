import { describe, expect, it } from "vitest";
import { podeGerenciarContas, podeVerPessoa, telaInicial, type Pessoa } from "./acesso";

const pessoa = (id: string, nivel: Pessoa["nivel"], ativo = true): Pessoa => ({ id, nivel, ativo });

const lucas = pessoa("lucas", "admin");
const carol = pessoa("carol", "lider");
const paulo = pessoa("paulo", "professor");
const novo = pessoa("novo", "pendente");
const saiu = pessoa("saiu", "lider", false);

describe("telaInicial", () => {
  it("a Liderança e o Professor entram no Mural", () => {
    expect(telaInicial(lucas)).toBe("mural");
    expect(telaInicial(carol)).toBe("mural");
    expect(telaInicial(paulo)).toBe("mural");
  });

  it("o Pendente vê só a tela de espera", () => {
    expect(telaInicial(novo)).toBe("aguardando-aprovacao");
  });

  it("quem foi desativado vê só o aviso de conta desativada, qualquer que seja o nível", () => {
    expect(telaInicial(saiu)).toBe("conta-desativada");
    expect(telaInicial(pessoa("ex-admin", "admin", false))).toBe("conta-desativada");
  });
});

describe("podeVerPessoa", () => {
  const todos = [lucas, carol, paulo, novo, saiu];
  const visiveisPara = (quem: Pessoa) => todos.filter((alvo) => podeVerPessoa(quem, alvo)).map((p) => p.id);

  it("o Admin vê todas as contas, inclusive Pendentes e desativadas", () => {
    expect(visiveisPara(lucas)).toEqual(["lucas", "carol", "paulo", "novo", "saiu"]);
  });

  it("o Líder vê a Liderança e os Professores, mas não os Pendentes", () => {
    expect(visiveisPara(carol)).toEqual(["lucas", "carol", "paulo", "saiu"]);
  });

  it("o Professor vê só a própria conta", () => {
    expect(visiveisPara(paulo)).toEqual(["paulo"]);
  });

  it("o Pendente vê só a própria conta", () => {
    expect(visiveisPara(novo)).toEqual(["novo"]);
  });

  it("quem foi desativado vê só a própria conta", () => {
    expect(visiveisPara(saiu)).toEqual(["saiu"]);
  });
});

describe("podeGerenciarContas", () => {
  it("só o Admin ativo convida, aprova, recusa, desativa e promove", () => {
    expect(podeGerenciarContas(lucas)).toBe(true);
    expect(podeGerenciarContas(carol)).toBe(false);
    expect(podeGerenciarContas(paulo)).toBe(false);
    expect(podeGerenciarContas(novo)).toBe(false);
    expect(podeGerenciarContas(pessoa("ex-admin", "admin", false))).toBe(false);
  });
});
