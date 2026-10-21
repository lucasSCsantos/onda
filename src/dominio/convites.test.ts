import { describe, expect, it } from "vitest";
import { situacaoDoConvite, vencimentoDoConvite } from "./convites";

const agora = new Date("2026-10-21T15:00:00-03:00");
const emSeteDias = new Date("2026-10-28T15:00:00-03:00");

describe("situacaoDoConvite", () => {
  it("um convite novo, dentro da validade, é válido", () => {
    expect(situacaoDoConvite({ expiraEm: emSeteDias, usadoEm: null, revogadoEm: null }, agora)).toBe("valido");
  });

  it("um convite já usado é recusado no segundo uso", () => {
    const convite = { expiraEm: emSeteDias, usadoEm: new Date("2026-10-21T10:00:00-03:00"), revogadoEm: null };
    expect(situacaoDoConvite(convite, agora)).toBe("usado");
  });

  it("um convite passado da validade está vencido", () => {
    const convite = { expiraEm: new Date("2026-10-21T14:59:00-03:00"), usadoEm: null, revogadoEm: null };
    expect(situacaoDoConvite(convite, agora)).toBe("vencido");
  });

  it("um convite revogado pelo Admin não vale mais, mesmo dentro da validade", () => {
    const convite = { expiraEm: emSeteDias, usadoEm: null, revogadoEm: new Date("2026-10-21T12:00:00-03:00") };
    expect(situacaoDoConvite(convite, agora)).toBe("revogado");
  });

  it("um convite usado continua contando como usado depois de vencer", () => {
    const convite = {
      expiraEm: new Date("2026-10-20T00:00:00-03:00"),
      usadoEm: new Date("2026-10-19T10:00:00-03:00"),
      revogadoEm: null,
    };
    expect(situacaoDoConvite(convite, agora)).toBe("usado");
  });
});

describe("vencimentoDoConvite", () => {
  it("a validade padrão é de 7 dias", () => {
    expect(vencimentoDoConvite(agora)).toEqual(emSeteDias);
  });

  it("a validade é editável, em dias", () => {
    expect(vencimentoDoConvite(agora, 2)).toEqual(new Date("2026-10-23T15:00:00-03:00"));
  });

  it("recusa validade fora de 1 a 30 dias", () => {
    expect(() => vencimentoDoConvite(agora, 0)).toThrow();
    expect(() => vencimentoDoConvite(agora, 31)).toThrow();
    expect(() => vencimentoDoConvite(agora, 1.5)).toThrow();
  });
});
