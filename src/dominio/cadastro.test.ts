import { describe, expect, it } from "vitest";
import { dataDeNascimentoValida, erroNosDadosPessoais } from "./cadastro";

// quarta-feira, 21/10/2026, 22h em Salvador (já é dia 22 em UTC)
const agora = new Date("2026-10-21T22:00:00-03:00");

describe("dataDeNascimentoValida", () => {
  it("aceita uma data passada no formato do campo de data", () => {
    expect(dataDeNascimentoValida("2000-05-10", agora)).toBe(true);
  });

  it("aceita hoje, no fuso America/Bahia", () => {
    expect(dataDeNascimentoValida("2026-10-21", agora)).toBe(true);
  });

  it("recusa uma data futura, mesmo que já seja esse dia em UTC", () => {
    expect(dataDeNascimentoValida("2026-10-22", agora)).toBe(false);
  });

  it("recusa datas que não existem e textos fora do formato", () => {
    expect(dataDeNascimentoValida("2001-02-29", agora)).toBe(false);
    expect(dataDeNascimentoValida("10/05/2000", agora)).toBe(false);
    expect(dataDeNascimentoValida("", agora)).toBe(false);
  });

  it("aceita 29/02 em ano bissexto", () => {
    expect(dataDeNascimentoValida("2004-02-29", agora)).toBe(true);
  });
});

describe("erroNosDadosPessoais", () => {
  const ok = { nome: "Carol", nascimento: "1990-05-10", genero: "feminino" };

  it("aceita nome, data de nascimento e Gênero válidos", () => {
    expect(erroNosDadosPessoais(ok, agora)).toBeNull();
  });

  it("exige o nome", () => {
    expect(erroNosDadosPessoais({ ...ok, nome: "   " }, agora)).toBe("Informe seu nome.");
  });

  it("exige uma data de nascimento válida e não futura", () => {
    expect(erroNosDadosPessoais({ ...ok, nascimento: "" }, agora)).toBe("Informe uma data de nascimento válida, que não seja futura.");
    expect(erroNosDadosPessoais({ ...ok, nascimento: "2026-10-22" }, agora)).toBe("Informe uma data de nascimento válida, que não seja futura.");
  });

  it("exige o Gênero, masculino ou feminino", () => {
    expect(erroNosDadosPessoais({ ...ok, genero: "" }, agora)).toBe("Escolha o Gênero.");
    expect(erroNosDadosPessoais({ ...ok, genero: "outro" }, agora)).toBe("Escolha o Gênero.");
  });
});
