import { describe, expect, it } from "vitest";
import { semanaDe } from "./semana";

describe("semanaDe", () => {
  it("vai de segunda a domingo, no fuso America/Bahia", () => {
    // quarta-feira, 21/10/2026, 15h em Salvador
    const semana = semanaDe(new Date("2026-10-21T15:00:00-03:00"));

    expect(semana.inicio.toISOString()).toBe("2026-10-19T03:00:00.000Z");
    expect(semana.fim.toISOString()).toBe("2026-10-26T03:00:00.000Z");
  });
});

describe("semanaDe no domingo", () => {
  it("o domingo à noite ainda é o último dia da semana que começou na segunda", () => {
    // domingo, 25/10/2026, 22h em Salvador (já é segunda em UTC)
    const semana = semanaDe(new Date("2026-10-25T22:00:00-03:00"));

    expect(semana.inicio.toISOString()).toBe("2026-10-19T03:00:00.000Z");
  });
});
