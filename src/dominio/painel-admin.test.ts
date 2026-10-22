import { describe, expect, it } from "vitest";
import type { Status } from "./eventos";
import { indicadoresDoPainel } from "./painel-admin";

const agora = new Date("2026-10-21T15:00:00Z");
const em = (dia: string) => new Date(`${dia}T12:00:00-03:00`);

const evento = (dia: string, status: Status, responsavel: string | null = "ana") => ({
  inicio: em(dia),
  fim: null,
  diaInteiro: false,
  status,
  responsavel,
});
const convite = (extra: { expiraEm?: Date; usadoEm?: Date | null; revogadoEm?: Date | null } = {}) => ({
  expiraEm: em("2026-10-28"),
  usadoEm: null,
  revogadoEm: null,
  ...extra,
});
const indicadores = (entrada: Partial<Parameters<typeof indicadoresDoPainel>[0]>) =>
  indicadoresDoPainel({ pessoas: [], convites: [], eventos: [], agora, ...entrada });

describe("indicadoresDoPainel", () => {
  it("zera tudo quando não há dados", () => {
    expect(indicadores({})).toEqual({ pendentes: 0, usuariosAtivos: 0, convitesAtivos: 0, rascunhos: 0, semResponsavel: 0 });
  });

  it("conta só as pessoas ativas que aguardam aprovação", () => {
    const pessoas = [
      { nivel: "pendente" as const, ativo: true },
      { nivel: "pendente" as const, ativo: true },
      { nivel: "pendente" as const, ativo: false },
      { nivel: "lider" as const, ativo: true },
    ];
    expect(indicadores({ pessoas }).pendentes).toBe(2);
    expect(indicadores({ pessoas }).usuariosAtivos).toBe(1);
  });

  it("conta só os convites válidos", () => {
    const convites = [
      convite(),
      convite({ usadoEm: agora }),
      convite({ revogadoEm: agora }),
      convite({ expiraEm: em("2026-10-20") }),
    ];
    expect(indicadores({ convites }).convitesAtivos).toBe(1);
  });

  it("conta os Eventos em Rascunho, mesmo os que já passaram da data", () => {
    const eventos = [evento("2026-10-25", "rascunho"), evento("2026-10-10", "rascunho"), evento("2026-10-25", "planejado")];
    expect(indicadores({ eventos }).rascunhos).toBe(2);
  });

  it("conta os Eventos ativos sem Responsável", () => {
    const eventos = [
      evento("2026-10-25", "rascunho", null),
      evento("2026-10-25", "planejado", null),
      evento("2026-10-25", "confirmado", null),
      evento("2026-10-25", "planejado", "ana"),
    ];
    expect(indicadores({ eventos }).semResponsavel).toBe(3);
  });

  it("ignora Cancelado, Realizado, Adiado e Eventos que já terminaram", () => {
    const eventos = [
      evento("2026-10-25", "cancelado", null),
      evento("2026-10-10", "realizado", null),
      evento("2026-10-25", "adiado", null),
      evento("2026-10-10", "planejado", null),
      evento("2026-10-25", "cancelado"),
    ];
    expect(indicadores({ eventos })).toMatchObject({ rascunhos: 0, semResponsavel: 0 });
  });
});
