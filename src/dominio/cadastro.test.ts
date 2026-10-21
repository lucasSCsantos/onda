import { describe, expect, it } from "vitest";
import { dataDeNascimentoValida } from "./cadastro";

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
