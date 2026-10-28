import { describe, expect, it } from "vitest";
import { cadastroIncompleto, erroNoGenero, lerGenero, NOMES_DOS_GENEROS } from "./genero";

describe("lerGenero", () => {
  it("aceita só masculino e feminino", () => {
    expect(lerGenero("masculino")).toBe("masculino");
    expect(lerGenero("feminino")).toBe("feminino");
    expect(lerGenero("outro")).toBeNull();
    expect(lerGenero("")).toBeNull();
    expect(lerGenero(null)).toBeNull();
    expect(lerGenero(undefined)).toBeNull();
  });
});

describe("erroNoGenero", () => {
  it("exige o Gênero em um cadastro novo", () => {
    expect(erroNoGenero("")).toBe("Escolha o Gênero.");
    expect(erroNoGenero("x")).toBe("Escolha o Gênero.");
    expect(erroNoGenero("feminino")).toBeNull();
  });
});

describe("cadastroIncompleto", () => {
  it("perfil antigo, sem Gênero, está incompleto", () => {
    expect(cadastroIncompleto(null)).toBe(true);
    expect(cadastroIncompleto("masculino")).toBe(false);
  });
});

it("os nomes são os do glossário", () => {
  expect(NOMES_DOS_GENEROS).toEqual({ masculino: "Masculino", feminino: "Feminino" });
});
