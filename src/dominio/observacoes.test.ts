import { describe, expect, it } from "vitest";
import { cabeNoLimite, erroNaObservacao, foiEditada, LIMITE_DA_OBSERVACAO, ordenarObservacoes, podeMudarObservacao, restantes } from "./observacoes";

const pessoa = (nivel: "admin" | "lider" | "professor" | "pendente", id = "p1", ativo = true) => ({ id, nivel, ativo });

describe("erroNaObservacao", () => {
  it("recusa texto vazio ou só de espaços", () => {
    expect(erroNaObservacao("")).toBe("Escreva a observação.");
    expect(erroNaObservacao("  \n ")).toBe("Escreva a observação.");
  });

  it("aceita até 2.000 caracteres e recusa o que passa disso", () => {
    expect(LIMITE_DA_OBSERVACAO).toBe(2000);
    expect(erroNaObservacao("a".repeat(2000))).toBeNull();
    expect(erroNaObservacao("a".repeat(2001))).toBe("A observação pode ter no máximo 2.000 caracteres.");
  });

  it("não bloqueia nada pelo conteúdo", () => {
    expect(erroNaObservacao("Está com diabetes e os pais se separaram.")).toBeNull();
  });
});

describe("contador", () => {
  it("diz quantos caracteres ainda cabem", () => {
    expect(restantes("")).toBe(2000);
    expect(restantes("abc")).toBe(1997);
    expect(restantes("a".repeat(2005))).toBe(-5);
    expect(cabeNoLimite("a".repeat(2000))).toBe(true);
    expect(cabeNoLimite("a".repeat(2001))).toBe(false);
  });
});

describe("podeMudarObservacao", () => {
  it("só o autor e o Admin editam e apagam", () => {
    expect(podeMudarObservacao(pessoa("lider", "a"), "a")).toBe(true);
    expect(podeMudarObservacao(pessoa("lider", "b"), "a")).toBe(false);
    expect(podeMudarObservacao(pessoa("admin", "z"), "a")).toBe(true);
  });

  it("Professor, Pendente e conta desativada não mudam nada", () => {
    expect(podeMudarObservacao(pessoa("professor", "a"), "a")).toBe(false);
    expect(podeMudarObservacao(pessoa("pendente", "a"), "a")).toBe(false);
    expect(podeMudarObservacao(pessoa("lider", "a", false), "a")).toBe(false);
  });

  it("observação de conta já removida (sem autor) só o Admin muda", () => {
    expect(podeMudarObservacao(pessoa("lider", "a"), null)).toBe(false);
    expect(podeMudarObservacao(pessoa("admin"), null)).toBe(true);
  });
});

describe("ordem e edição", () => {
  it("lista da mais antiga para a mais nova", () => {
    const lista = [
      { id: "2", criadoEm: new Date("2026-10-02T12:00:00Z") },
      { id: "1", criadoEm: new Date("2026-10-01T12:00:00Z") },
      { id: "3", criadoEm: new Date("2026-10-03T12:00:00Z") },
    ];
    expect(ordenarObservacoes(lista).map((o) => o.id)).toEqual(["1", "2", "3"]);
    expect(lista[0].id).toBe("2");
  });

  it("só conta como editada quando a última edição é depois da criação", () => {
    const criado = new Date("2026-10-01T12:00:00Z");
    expect(foiEditada({ criadoEm: criado, editadoEm: criado })).toBe(false);
    expect(foiEditada({ criadoEm: criado, editadoEm: new Date("2026-10-01T12:00:00.500Z") })).toBe(false);
    expect(foiEditada({ criadoEm: criado, editadoEm: new Date("2026-10-02T12:00:00Z") })).toBe(true);
  });
});
